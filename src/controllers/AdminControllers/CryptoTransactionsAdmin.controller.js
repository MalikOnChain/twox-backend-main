import { submitFystackWithdrawal } from '@/services/custody/CryptoWithdrawal.service';
import { paymentDebugTrace } from '@/utils/paymentDebugTrace';
import CryptoTransaction from '@/models/transactions/CryptoTransactions';
import { CRYPTO_TRANSACTION_TYPES } from '@/types/crypto/crypto';
import { TRANSACTION_STATUS } from '@/controllers/TransactionControllers/BaseTransactionManager.js';

function adminStatusIndex(dbStatus) {
  const s = String(dbStatus || '').toUpperCase();
  if (s === 'PENDING' || s === 'PROCESSING' || s === 'TRANSACTION_REQUEST') return 0;
  if (s === 'COMPLETED' || s === 'APPROVED' || s === 'INCOMING_CONFIRMED_COIN_TX') return 1;
  if (s === 'FAILED' || s === 'REJECTED' || s === 'CANCELLED') return 2;
  if (s === 'EXPIRED') return 3;
  return 0;
}

function formatAdminRow(doc) {
  const o = doc.toObject ? doc.toObject() : doc;
  const uid = o.userId;
  return {
    _id: o._id,
    userId: uid,
    amount: o.exchangedAmount != null ? o.exchangedAmount : o.amount,
    currency: 'USD',
    method: 'fystack_crypto',
    pixKey: o.metadata?.recipientAddress || o.address || null,
    updatedAt: o.updatedAt || o.createdAt,
    status: adminStatusIndex(o.status),
    rawStatus: o.status,
    type: o.type,
    unit: o.unit,
    transactionId: o.transactionId,
  };
}

function buildQuery(filters = {}) {
  const q = {};
  if (filters.type === 'deposit') q.type = CRYPTO_TRANSACTION_TYPES.DEPOSIT;
  if (filters.type === 'withdraw') q.type = CRYPTO_TRANSACTION_TYPES.WITHDRAW;
  if (filters.currency) q.unit = new RegExp(`^${filters.currency}$`, 'i');
  if (filters.status) {
    const map = {
      PENDING: TRANSACTION_STATUS.PENDING,
      COMPLETED: TRANSACTION_STATUS.COMPLETED,
      FAILED: TRANSACTION_STATUS.FAILED,
    };
    if (map[filters.status]) q.status = map[filters.status];
  }
  if (filters.search) {
    q.$or = [
      { transactionId: new RegExp(filters.search, 'i') },
      { address: new RegExp(filters.search, 'i') },
    ];
  }
  return q;
}

export async function listCryptoTransactions(req, res) {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip = (page - 1) * limit;

    const filters = {
      type: req.query['filters[type]'],
      search: req.query['filters[search]'],
      method: req.query['filters[method]'],
      currency: req.query['filters[currency]'],
      status: req.query['filters[status]'],
      country: req.query['filters[country]'],
    };

    const q = buildQuery(filters);
    const [total, rows] = await Promise.all([
      CryptoTransaction.countDocuments(q),
      CryptoTransaction.find(q)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('userId', 'username avatar _id'),
    ]);

    // #region agent log
    paymentDebugTrace({
      flow: 'admin',
      step: 'crypto_transactions_list',
      data: { total, rowCount: rows.length, page, limit },
    });
    // #endregion

    return res.json({
      rows: rows.map(formatAdminRow),
      pagination: {
        totalPages: Math.ceil(total / limit) || 1,
        currentPage: page,
      },
    });
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
}

export async function getSeedData(req, res) {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const type =
      req.query.type === 'withdraw' ? CRYPTO_TRANSACTION_TYPES.WITHDRAW : CRYPTO_TRANSACTION_TYPES.DEPOSIT;
    const [paidAgg, pendingAgg] = await Promise.all([
      CryptoTransaction.aggregate([
        { $match: { type, status: TRANSACTION_STATUS.COMPLETED } },
        { $group: { _id: null, count: { $sum: 1 }, totalAmount: { $sum: '$exchangedAmount' } } },
      ]),
      CryptoTransaction.aggregate([
        { $match: { type, status: { $in: [TRANSACTION_STATUS.PENDING, TRANSACTION_STATUS.PROCESSING] } } },
        { $group: { _id: null, count: { $sum: 1 }, totalAmount: { $sum: '$exchangedAmount' } } },
      ]),
    ]);
    const paid = paidAgg[0] || { count: 0, totalAmount: 0 };
    const pending = pendingAgg[0] || { count: 0, totalAmount: 0 };
    return res.json({
      paid: { count: paid.count, totalAmount: paid.totalAmount || 0 },
      pending: { count: pending.count, totalAmount: pending.totalAmount || 0 },
    });
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
}

export async function getCharts(req, res) {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const type =
      req.query.type === 'withdraw' ? CRYPTO_TRANSACTION_TYPES.WITHDRAW : CRYPTO_TRANSACTION_TYPES.DEPOSIT;
    const days = parseInt(req.query.days, 10) || 30;
    const since = new Date();
    since.setDate(since.getDate() - days);

    const txs = await CryptoTransaction.find({ type, createdAt: { $gte: since } })
      .select('createdAt exchangedAmount unit')
      .lean();

    const byDay = {};
    const byUnit = {};
    for (const t of txs) {
      const d = new Date(t.createdAt).toISOString().slice(0, 10);
      byDay[d] = byDay[d] || { count: 0, amount: 0 };
      byDay[d].count += 1;
      byDay[d].amount += t.exchangedAmount || 0;
      const u = t.unit || 'UNK';
      byUnit[u] = byUnit[u] || { count: 0, amount: 0 };
      byUnit[u].count += 1;
      byUnit[u].amount += t.exchangedAmount || 0;
    }

    const labels = Object.keys(byDay).sort();
    return res.json({
      success: true,
      data: {
        volume: {
          labels,
          counts: labels.map((l) => byDay[l].count),
          amounts: labels.map((l) => byDay[l].amount),
        },
        methodSplit: {
          labels: Object.keys(byUnit),
          counts: Object.values(byUnit).map((x) => x.count),
          amounts: Object.values(byUnit).map((x) => x.amount),
        },
        processingTime: {
          labels: [],
          counts: [],
        },
      },
    });
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
}

export async function listUserCryptoTransactions(req, res) {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip = (page - 1) * limit;
    const q = { userId };

    const filterType = req.query['filter[type]'];
    const ft = String(filterType || '').toLowerCase();
    if (ft === 'deposits' || ft === 'deposit') {
      q.type = CRYPTO_TRANSACTION_TYPES.DEPOSIT;
    } else if (ft === 'withdrawals' || ft === 'withdrawal' || ft === 'withdraw') {
      q.type = CRYPTO_TRANSACTION_TYPES.WITHDRAW;
    }

    const filterCurrency = req.query['filter[currency]'];
    if (filterCurrency && String(filterCurrency).toLowerCase() !== 'all') {
      const esc = String(filterCurrency).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      q.unit = new RegExp(`^${esc}$`, 'i');
    }

    const dateFrom = req.query['filter[date_from]'];
    const dateTo = req.query['filter[date_to]'];
    if (dateFrom || dateTo) {
      q.updatedAt = {};
      if (dateFrom) {
        const startDate = new Date(dateFrom);
        startDate.setHours(0, 0, 0, 0);
        q.updatedAt.$gte = startDate;
      }
      if (dateTo) {
        const endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59, 999);
        q.updatedAt.$lte = endDate;
      }
    }

    const search = req.query['filter[search]'];
    if (search && String(search).trim()) {
      const re = new RegExp(String(search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      q.$or = [{ transactionId: re }, { address: re }];
    }

    const [total, rows] = await Promise.all([
      CryptoTransaction.countDocuments(q),
      CryptoTransaction.find(q).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    ]);
    return res.json({
      rows,
      pagination: {
        total,
        totalPages: Math.ceil(total / limit) || 1,
        currentPage: page,
      },
    });
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
}

export async function approveWithdrawal(req, res) {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const { transactionId } = req.body;
    if (!transactionId) {
      return res.status(400).json({ error: 'transactionId required' });
    }
    const out = await submitFystackWithdrawal(transactionId);
    // #region agent log
    paymentDebugTrace({
      flow: 'admin',
      step: 'approve_withdraw_fystack',
      data: { ok: Boolean(out.ok), messageLen: out.message ? String(out.message).length : 0 },
    });
    // #endregion
    if (!out.ok) {
      return res.status(400).json({ error: out.message || 'Approve failed' });
    }
    return res.json({ success: true });
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
}
