import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../../.env') });

// Import models
import GameTransaction from '../models/transactions/GameTransactions';
import ServiceTransaction from '../models/transactions/ServiceTransactions';
import CryptoTransaction from '../models/transactions/CryptoTransactions';
import User from '../models/users/User';
import Bonus from '../models/bonus/Bonuses';

// Define schemas for backend-admin models (since they're in a different project)
const OperatingProviderSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    description: { type: String },
    metadata: { type: Object },
  },
  { timestamps: true }
);

const OperatingProviderInvoiceSchema = new mongoose.Schema(
  {
    providerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'OperatingProvider',
      required: true,
    },
    issueDate: { type: Date, required: true },
    amount: { type: Number, required: true },
    description: { type: String },
    metadata: { type: Object },
  },
  { timestamps: true }
);

const UserBonusRedemptionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    bonusId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Bonuses',
      required: true,
    },
    type: { type: String, required: true },
    claimMethod: { type: String, default: 'auto' },
    code: { type: String, default: null },
    amount: { type: Number, required: true },
    claimedAt: { type: Date, default: null },
    isConsumed: { type: Boolean, default: false },
    consumedAt: { type: Date },
    requirements: {
      depositRequirement: {
        required: { type: Boolean, default: false },
        totalRequired: { type: Number, default: 0 },
        currentAmount: { type: Number, default: 0 },
        completed: { type: Boolean, default: false },
        completedAt: { type: Date },
      },
      wageringRequirement: {
        required: { type: Boolean, default: false },
        totalRequired: { type: Number, default: 0 },
        currentAmount: { type: Number, default: 0 },
        completed: { type: Boolean, default: false },
        completedAt: { type: Date },
      },
      updatedAt: { type: Date, default: Date.now },
    },
  },
  { timestamps: true }
);

// Get or create models (handle case where they might already exist)
const OperatingProvider = mongoose.models.OperatingProvider || mongoose.model('OperatingProvider', OperatingProviderSchema);
const OperatingProviderInvoice = mongoose.models.OperatingProviderInvoice || mongoose.model('OperatingProviderInvoice', OperatingProviderInvoiceSchema);
const UserBonusRedemption = mongoose.models.UserBonusRedemption || mongoose.model('UserBonusRedemption', UserBonusRedemptionSchema);

// Import enums
import { GAME_CATEGORIES, TRANSACTION_TYPES, GAME_TRANSACTION_STATUS } from '../types/game/game';
import { SERVICE_TRANSACTION_TYPES, SERVICE_TRANSACTION_STATUS } from '../types/bonus/service';
import { CRYPTO_TRANSACTION_TYPES } from '../types/crypto/crypto';
// TRANSACTION_STATUS for crypto transactions
const TRANSACTION_STATUS = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  APPROVED: 'APPROVED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
  EXPIRED: 'EXPIRED',
};
import { BLOCKCHAIN_PROTOCOL_NAME, NETWORK, VAULTODY_TX_EVENTS } from '../types/vaultody/vaultody';

const seedFinanceData = async () => {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/twox';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Get or create sample users
    let users = await User.find().limit(2);
    if (users.length < 2) {
      console.log('⚠️  Not enough users found. Creating sample users...');
      const newUsers = await User.insertMany([
        {
          username: 'testuser1',
          email: 'testuser1@example.com',
          password: 'hashedpassword123',
          balance: 1000,
        },
        {
          username: 'testuser2',
          email: 'testuser2@example.com',
          password: 'hashedpassword123',
          balance: 500,
        },
      ]);
      users = newUsers;
    }
    const [user1, user2] = users;
    console.log(`✅ Using users: ${user1.username} (${user1._id}), ${user2.username} (${user2._id})`);

    // Get or create sample bonuses (need 2 for redemptions)
    let bonuses = await Bonus.find().limit(2);
    if (bonuses.length < 2) {
      console.log('⚠️  Not enough bonuses found. Creating sample bonuses...');
      const newBonuses = await Bonus.insertMany([
        {
          name: 'Welcome Bonus',
          type: 'welcome',
          status: 'active',
          code: 'WELCOME123',
        },
        {
          name: 'Deposit Bonus',
          type: 'deposit',
          status: 'active',
          code: 'DEPOSIT456',
        },
      ]);
      bonuses = newBonuses;
    }
    const [bonus, bonus2] = bonuses;
    console.log(`✅ Using bonuses: ${bonus.name} (${bonus._id}), ${bonus2.name} (${bonus2._id})`);

    // Get or create sample provider for invoices
    let provider = await OperatingProvider.findOne();
    if (!provider) {
      console.log('⚠️  No provider found. Creating sample provider...');
      try {
        provider = await OperatingProvider.create({
          name: 'Provider A',
          code: 'PROV_A',
          isActive: true,
        });
      } catch (error) {
        console.log('⚠️  Could not create provider. Using dummy ObjectId...');
        // Use a dummy ObjectId if provider creation fails
        provider = { _id: new mongoose.Types.ObjectId() };
      }
    }
    console.log(`✅ Using provider: ${provider.name} (${provider._id})`);

    // Clear existing seed data (optional - comment out if you want to keep existing data)
    // await GameTransaction.deleteMany({});
    // await ServiceTransaction.deleteMany({});
    // await CryptoTransaction.deleteMany({});
    // await OperatingProviderInvoice.deleteMany({});
    // await UserBonusRedemption.deleteMany({});

    // 1. Seed GameTransaction data (2 records)
    console.log('\n📊 Seeding GameTransaction data...');
    const gameTransactions = [
      {
        category: GAME_CATEGORIES.SLOTS,
        userId: user1._id,
        betAmount: 150,
        winAmount: 70,
        userBalance: {
          before: 1000,
          after: 920,
        },
        bonusBalances: {},
        cashbackBalances: {},
        referBonusBalances: {},
        wagerRaceBalances: {},
        freeSpinBalances: {},
        type: TRANSACTION_TYPES.BET,
        status: GAME_TRANSACTION_STATUS.COMPLETED,
        game: {
          id: 'game_12345',
          name: 'Starburst',
          provider: 'NetEnt',
        },
        createdAt: new Date('2025-01-25T12:00:00Z'),
        updatedAt: new Date('2025-01-25T12:00:00Z'),
      },
      {
        category: GAME_CATEGORIES.LIVE_CASINO,
        userId: user2._id,
        betAmount: 200,
        winAmount: 300,
        userBalance: {
          before: 500,
          after: 600,
        },
        bonusBalances: {},
        cashbackBalances: {},
        referBonusBalances: {},
        wagerRaceBalances: {},
        freeSpinBalances: {},
        type: TRANSACTION_TYPES.BET,
        status: GAME_TRANSACTION_STATUS.COMPLETED,
        game: {
          id: 'game_67890',
          name: 'Blackjack Live',
          provider: 'Evolution',
        },
        createdAt: new Date('2025-01-25T13:15:00Z'),
        updatedAt: new Date('2025-01-25T13:15:00Z'),
      },
    ];

    const createdGameTransactions = await GameTransaction.insertMany(gameTransactions);
    console.log(`✅ Created ${createdGameTransactions.length} GameTransaction records`);

    // 2. Seed ServiceTransaction data (2 records)
    console.log('\n📊 Seeding ServiceTransaction data...');
    const serviceTransactions = [
      {
        userId: user1._id,
        type: SERVICE_TRANSACTION_TYPES.BONUS,
        amount: 50,
        userBalance: {
          before: 600,
          after: 650,
        },
        bonusBalances: {},
        cashbackBalances: {},
        referBonusBalances: {},
        wagerRaceBalances: {},
        freeSpinsBalances: {},
        status: SERVICE_TRANSACTION_STATUS.COMPLETED,
        referenceId: bonus._id,
        metadata: {
          bonusType: 'welcome',
          bonusName: 'Welcome Bonus',
        },
        createdAt: new Date('2025-01-25T10:00:00Z'),
        updatedAt: new Date('2025-01-25T10:00:00Z'),
      },
      {
        userId: user2._id,
        type: SERVICE_TRANSACTION_TYPES.BONUS,
        amount: 75,
        userBalance: {
          before: 200,
          after: 275,
        },
        bonusBalances: {},
        cashbackBalances: {},
        referBonusBalances: {},
        wagerRaceBalances: {},
        freeSpinsBalances: {},
        status: SERVICE_TRANSACTION_STATUS.COMPLETED,
        referenceId: bonus._id,
        metadata: {
          bonusType: 'deposit',
          bonusName: 'Deposit Bonus',
        },
        createdAt: new Date('2025-01-25T11:30:00Z'),
        updatedAt: new Date('2025-01-25T11:30:00Z'),
      },
    ];

    const createdServiceTransactions = await ServiceTransaction.insertMany(serviceTransactions);
    console.log(`✅ Created ${createdServiceTransactions.length} ServiceTransaction records`);

    // 3. Seed OperatingProviderInvoice data (2 records)
    console.log('\n📊 Seeding OperatingProviderInvoice data...');
    const providerInvoices = [
      {
        providerId: provider._id,
        amount: 120,
        issueDate: new Date('2025-01-25T00:00:00Z'),
        description: 'Monthly provider fee - January 2025',
        metadata: {
          period: '2025-01',
          invoiceNumber: 'INV-2025-001',
        },
        createdAt: new Date('2025-01-25T00:00:00Z'),
        updatedAt: new Date('2025-01-25T00:00:00Z'),
      },
      {
        providerId: provider._id,
        amount: 200,
        issueDate: new Date('2025-01-26T00:00:00Z'),
        description: 'Monthly provider fee - January 2025 (Extended)',
        metadata: {
          period: '2025-01',
          invoiceNumber: 'INV-2025-002',
        },
        createdAt: new Date('2025-01-26T00:00:00Z'),
        updatedAt: new Date('2025-01-26T00:00:00Z'),
      },
    ];

    const createdProviderInvoices = await OperatingProviderInvoice.insertMany(providerInvoices);
    console.log(`✅ Created ${createdProviderInvoices.length} OperatingProviderInvoice records`);

    // 4. Seed UserBonusRedemption data (2 records)
    console.log('\n📊 Seeding UserBonusRedemption data...');
    
    // Check for existing redemptions and delete them to avoid duplicate key errors
    await UserBonusRedemption.deleteMany({
      $or: [
        { userId: user1._id, bonusId: bonus._id },
        { userId: user2._id, bonusId: bonus2._id },
      ],
    });
    console.log('🗑️  Cleared existing bonus redemptions for sample data');

    const bonusRedemptions = [
      {
        userId: user1._id,
        bonusId: bonus._id,
        type: 'referral',
        claimMethod: 'auto',
        code: null,
        amount: 30,
        claimedAt: new Date('2025-01-25T09:00:00Z'),
        isConsumed: false,
        requirements: {
          depositRequirement: {
            required: false,
            totalRequired: 0,
            currentAmount: 0,
            completed: true,
          },
          wageringRequirement: {
            required: true,
            totalRequired: 900,
            currentAmount: 450,
            completed: false,
          },
          updatedAt: new Date('2025-01-25T09:00:00Z'),
        },
        createdAt: new Date('2025-01-25T09:00:00Z'),
        updatedAt: new Date('2025-01-25T09:00:00Z'),
      },
      {
        userId: user2._id,
        bonusId: bonus2._id, // Use second bonus to avoid duplicate key error
        type: 'referral',
        claimMethod: 'auto',
        code: null,
        amount: 45,
        claimedAt: new Date('2025-01-25T14:20:00Z'),
        isConsumed: true,
        consumedAt: new Date('2025-01-25T15:00:00Z'),
        requirements: {
          depositRequirement: {
            required: false,
            totalRequired: 0,
            currentAmount: 0,
            completed: true,
          },
          wageringRequirement: {
            required: true,
            totalRequired: 1350,
            currentAmount: 1350,
            completed: true,
            completedAt: new Date('2025-01-25T15:00:00Z'),
          },
          updatedAt: new Date('2025-01-25T15:00:00Z'),
        },
        createdAt: new Date('2025-01-25T14:20:00Z'),
        updatedAt: new Date('2025-01-25T15:00:00Z'),
      },
    ];

    const createdBonusRedemptions = await UserBonusRedemption.insertMany(bonusRedemptions);
    console.log(`✅ Created ${createdBonusRedemptions.length} UserBonusRedemption records`);

    // 5. Seed CryptoTransaction data (2 records - withdrawals)
    console.log('\n📊 Seeding CryptoTransaction data...');
    const cryptoTransactions = [
      {
        userId: user1._id,
        blockchain: BLOCKCHAIN_PROTOCOL_NAME.ETHEREUM,
        network: NETWORK.MAINNET,
        type: CRYPTO_TRANSACTION_TYPES.WITHDRAW,
        status: 'COMPLETED',
        amount: 0.05, // ETH amount
        exchangeRate: 2400, // USDT per ETH
        exchangedAmount: 120, // USDT equivalent
        unit: 'ETH',
        transactionId: '0x' + Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join(''),
        address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
        userBalance: {
          before: 1000,
          after: 880,
        },
        metadata: {
          fee: 0.001,
        },
        createdAt: new Date('2025-01-25T08:00:00Z'),
        updatedAt: new Date('2025-01-25T08:05:00Z'),
      },
      {
        userId: user2._id,
        blockchain: BLOCKCHAIN_PROTOCOL_NAME.BITCOIN,
        network: NETWORK.MAINNET,
        type: CRYPTO_TRANSACTION_TYPES.WITHDRAW,
        status: 'COMPLETED',
        amount: 0.002, // BTC amount
        exchangeRate: 40000, // USDT per BTC
        exchangedAmount: 80, // USDT equivalent
        unit: 'BTC',
        transactionId: '0x' + Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join(''),
        address: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
        userBalance: {
          before: 500,
          after: 420,
        },
        metadata: {
          fee: 0.0001,
        },
        createdAt: new Date('2025-01-25T15:45:00Z'),
        updatedAt: new Date('2025-01-25T15:50:00Z'),
      },
    ];

    const createdCryptoTransactions = await CryptoTransaction.insertMany(cryptoTransactions);
    console.log(`✅ Created ${createdCryptoTransactions.length} CryptoTransaction records`);

    // Summary
    console.log('\n✅ Finance data seeding completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`   GameTransaction: ${createdGameTransactions.length} records`);
    console.log(`   ServiceTransaction: ${createdServiceTransactions.length} records`);
    console.log(`   OperatingProviderInvoice: ${createdProviderInvoices.length} records`);
    console.log(`   UserBonusRedemption: ${createdBonusRedemptions.length} records`);
    console.log(`   CryptoTransaction: ${createdCryptoTransactions.length} records`);

  } catch (error) {
    console.error('❌ Error seeding finance data:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
    process.exit(0);
  }
};

// Run the seed function
seedFinanceData();

