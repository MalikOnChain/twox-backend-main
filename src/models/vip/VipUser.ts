import mongoose from 'mongoose';

import { BALANCE_UPDATE_TYPES } from '@/types/balance/balance';

import userSocketController from '../../controllers/SocketControllers/user-socket';
import vipService from '../../services/vip/vip.service';
import Settings from '../settings/Settings';

import VipTierHistory from './VipTierHistory';
const { Schema } = mongoose;

// Schema for VIP users
const VipUserSchema = new Schema<IVipUser>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    totalWagered: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalXP: {
      type: Number,
      default: 0,
      min: 0,
    },
    loyaltyTierId: {
      type: Schema.Types.ObjectId,
      ref: 'VipTier',
      required: true,
    },
    currentTier: {
      type: String,
    },
    currentLevel: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
VipUserSchema.index({ totalWagered: 1 });
VipUserSchema.index({ currentTier: 1 });

VipUserSchema.statics.processWagerUpdate = async function (vipUser, wagerAmount, xpAmount, type) {
  const oldTier = vipUser.currentTier;
  const oldLevel = vipUser.currentLevel;
  const newTotalWagered = vipUser.totalWagered + (type === BALANCE_UPDATE_TYPES.GAME ? wagerAmount : 0);
  const newTotalXP = vipUser.totalXP + xpAmount;

  const tier = await vipService.getTierByXP(newTotalXP);

  const updates = {
    totalWagered: newTotalWagered,
    totalXP: newTotalXP,
    currentTier: tier.name,
    currentLevel: tier.levelName,
    loyaltyTierId: tier.id,
  };

  const updatedVipUser = await this.findOneAndUpdate({ userId: vipUser.userId }, updates, {
    new: true,
  });

  //add tier history if tier is changed
  if (oldLevel !== updatedVipUser.currentLevel || oldTier !== updatedVipUser.currentTier) {
    await VipTierHistory.addTierHistory(vipUser.userId, tier.name + ' ' + tier.levelName);
  }

  return {
    updatedVipUser,
    tierChanged: oldLevel !== updatedVipUser.currentLevel || oldTier !== updatedVipUser.currentTier,
  };
};

VipUserSchema.statics.calculateVipStatusData = async function (vipUser) {
  const startTier = await vipService.getTierByXP(vipUser.totalXP);
  const nextTier = await vipService.getNextTier(startTier.name, startTier.levelName);
  const tierData = await vipService.getTierByName(startTier.name, startTier.levelName);

  if (!nextTier) {
    return {
      endTier: null,
      endLevel: null,
      currentTier: startTier.name,
      currentLevel: startTier.levelName,
      progress: 100,
      remainingXP: 0,
      totalRequired: tierData.currentLevel.minXP,
      currentXP: vipUser.totalXP,
      totalXP: vipUser.totalXP,
    };
  }

  const startMinXP = tierData.currentLevel.minXP;
  const endMinXP = nextTier.nextLevel.minXP;
  const progressRange = endMinXP - startMinXP;
  const currentProgress = Math.max(vipUser.totalXP - startMinXP, 0);
  const progressPercentage = Math.min((currentProgress / progressRange) * 100, 100);

  return {
    startTier: startTier.name,
    startTierLevel: startTier.levelName,
    endTier: nextTier.name,
    endLevel: nextTier.nextLevel.levelName,
    currentTier: vipUser.currentTier,
    currentLevel: vipUser.currentLevel,
    progress: Math.round(progressPercentage * 100) / 100,
    remainingXP: Math.max(endMinXP - vipUser.totalXP, 0),
    totalRequired: progressRange,
    currentXP: vipUser.totalXP,
    totalXP: endMinXP,
  };
};

VipUserSchema.statics.emitVipStatusEvents = async function (userId, vipStatusData, tierChanged) {
  const userIdString = userId.toString();

  if (tierChanged) {
    const { currentTier, currentLevel, startTier, startTierLevel } = vipStatusData;
    userSocketController.emitVipTierUp(
      userIdString,
      currentTier + ' ' + currentLevel,
      startTier + ' ' + startTierLevel
    );
  }

  userSocketController.emitVipStatusUpdate(userIdString, vipStatusData);
};

// Get VIP statistics
VipUserSchema.statics.getVipStatistics = async function (userId) {
  const vipUser = await this.findOne({ userId });
  if (!vipUser) {
    throw new Error('VIP user not found: ' + userId);
  }

  const currentXP = vipUser.totalXP;

  // Get current tier data
  const startTier = await vipService.getTierByXP(currentXP);
  const nextTier = await vipService.getNextTier(startTier.name, startTier.levelName);
  const tierData = await vipService.getTierByName(startTier.name, startTier.levelName);

  // If max tier
  if (!nextTier) {
    return {
      endTier: null,
      endLevel: null,
      currentTier: startTier.name,
      currentLevel: startTier.levelName,
      progress: 100,
      remainingXP: tierData.currentLevel.minXP - currentXP,
      totalRequired: tierData.currentLevel.minXP,
      currentXP: currentXP,
      totalXP: currentXP,
    };
  }

  const startMinXP = tierData.currentLevel.minXP;
  const endMinXP = nextTier.nextLevel.minXP;
  const progressRange = endMinXP - startMinXP;
  const currentProgress = Math.max(currentXP - startMinXP, 0);

  // Calculate progress percentage
  const progressPercentage = Math.min((currentProgress / progressRange) * 100, 100);

  return {
    endTier: nextTier.name,
    endLevel: nextTier.nextLevel.name,
    currentTier: startTier.name,
    currentLevel: startTier.levelName,
    progress: Math.round(progressPercentage * 100) / 100,
    remainingXP: Math.max(endMinXP - currentXP, 0),
    totalRequired: progressRange,
    currentXP: currentXP,
    totalXP: endMinXP,
  };
};

// Keep other statistical methods (they don't need modification as they work with stored data)
VipUserSchema.statics.getWagerLeaderboard = async function (limit = 10) {
  return this.find({})
    .sort({ totalWagered: -1 })
    .limit(limit)
    .select('userId totalWagered currentTier')
    .populate('userId', 'username');
};

VipUserSchema.statics.getTierDistribution = async function () {
  return this.aggregate([
    {
      $group: {
        _id: '$currentTier',
        count: { $sum: 1 },
        totalWagered: { $sum: '$totalWagered' },
      },
    },
    {
      $sort: {
        _id: 1,
      },
    },
  ]);
};

VipUserSchema.statics.getVipUserData = async function (userId) {
  try {
    const vipUser = await this.findOne({ userId }).lean();
    return vipUser;
  } catch (error) {
    console.error('Error getting current tier:', error);
    throw error;
  }
};

// Static methods for VIP operations
VipUserSchema.statics.updateVipStatus = async function (userId, wagerAmount, type, gameCategory): Promise<IVipUser> {
  const vipUser = await this.findOne({ userId });
  if (!vipUser) {
    throw new Error('VIP user not found');
  }
  let xpAmount = 0;
  let multiplier = 0 as any;
  const xpSetting = await Settings.getXpSettingStatus();
  if (xpSetting && xpSetting.xpSetting.status === 'ACTIVE') {
    if (type === BALANCE_UPDATE_TYPES.DEPOSIT) {
      multiplier = await Settings.getDepositXpMultiplier();
      xpAmount = wagerAmount * multiplier;
    } else if (type === BALANCE_UPDATE_TYPES.GAME) {
      multiplier = await Settings.getWagerXpMultiplier(gameCategory);
      xpAmount = wagerAmount * multiplier.wagerXpAmount;
    }
  }
  const { updatedVipUser, tierChanged } = await VipUser.processWagerUpdate(vipUser, wagerAmount, xpAmount, type);
  const vipStatusData = await VipUser.calculateVipStatusData(updatedVipUser);
  // Emit socket events
  await VipUser.emitVipStatusEvents(userId, vipStatusData, tierChanged);

  return updatedVipUser;
};

const VipUser = mongoose.model<IVipUser, IVipUserModel>('VipUser', VipUserSchema);

export default VipUser;
