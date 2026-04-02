import CryptoTransaction from '@/models/transactions/CryptoTransactions';
import GameTransaction from '@/models/transactions/GameTransactions';
import ServiceTransaction from '@/models/transactions/ServiceTransactions';

export class TransactionService {
  constructor() {
    this.pageSize = 20;
  }

  async getGameTransactions(userId, page = 1, limit = this.pageSize, filter = null) {
    const query = { userId };
    if (typeof filter === 'object') {
      if (filter?.category && filter.category !== 'ALL') {
        query.category = { $regex: filter.category, $options: 'i' };
      }
      if (filter?.type && filter.type !== 'ALL') {
        query.type = { $regex: filter.type, $options: 'i' };
      }
      if (filter?.date_from || filter?.date_to) {
        query.createdAt = {};
        if (filter.date_from) {
          const startDate = new Date(filter.date_from);
          startDate.setHours(0, 0, 0, 0);
          query.createdAt.$gte = startDate;
        }
        if (filter.date_to) {
          const endDate = new Date(filter.date_to);
          endDate.setHours(23, 59, 59, 999);
          query.createdAt.$lte = endDate;
        }
      }
    } else if (typeof filter === 'string') {
      query.category = { $regex: filter, $options: 'i' };
    }
    const transactions = await GameTransaction.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const totalTransactions = await GameTransaction.countDocuments(query);
    const totalPages = Math.ceil(totalTransactions / limit);

    return {
      transactions: transactions,
      pagination: {
        total: totalTransactions,
        totalPages,
        currentPage: page,
      },
    };
  }

  async getCryptoTransactions(userId, page = 1, limit = this.pageSize) {
    const transactions = await CryptoTransaction.find({ userId })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const totalTransactions = await CryptoTransaction.countDocuments({ userId });
    const totalPages = Math.ceil(totalTransactions / limit);

    return {
      transactions: transactions,
      pagination: {
        total: totalTransactions,
        totalPages,
        currentPage: page,
      },
    };
  }

  async getServiceTransactions(userId, page = 1, limit = this.pageSize, filter = null) {
    const query = { userId };
    if (filter?.type && filter.type !== 'ALL') {
      query.type = { $regex: filter.type, $options: 'i' };
    }

    if (filter?.date_from || filter?.date_to) {
      query.updatedAt = {};
      if (filter.date_from) {
        const startDate = new Date(filter.date_from);
        startDate.setHours(0, 0, 0, 0);
        query.updatedAt.$gte = startDate;
      }
      if (filter.date_to) {
        const endDate = new Date(filter.date_to);
        endDate.setHours(23, 59, 59, 999);
        query.updatedAt.$lte = endDate;
      }
    }

    const transactions = await ServiceTransaction.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const totalTransactions = await ServiceTransaction.countDocuments(query);
    const totalPages = Math.ceil(totalTransactions / limit);
    return {
      transactions: transactions,
      pagination: {
        total: totalTransactions,
        totalPages,
        currentPage: page,
      },
    };
  }
}

export default new TransactionService();
