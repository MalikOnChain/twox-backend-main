import md5 from 'md5';

import FavoriteGame from '@/models/slotGames/FavoriteGame';
import KYC from '@/models/users/KYC';
import User from '@/models/users/User';
import UserLogin from '@/models/users/UserLogin';
import BonusService from '@/services/bonus/BonusService.service';
import { convertEmailToLowerCase, generateSecurityCode, sanitizeInput, sendEmail } from '@/utils/helpers';
import { getIPInfo } from '@/utils/helpers/ip';
import { logger } from '@/utils/logger';

export class UserService {
  constructor(walletService) {
    this.walletService = walletService;
    this.bonusService = BonusService;
    this.SECURITY_CODE_EXPIRY = 600000; // 10 minutes
  }

  encryptPassword(password) {
    return md5('BestAuthSystemv1.0InTheBuilding-' + password);
  }

  async getUserById(userId) {
    return await User.findById(userId)
      .select('-resetPasswordToken -resetPasswordExpires')
      .exec();
  }

  async sendEmailChangeCode(rawOldEmail, rawNewEmail) {
    const oldEmail = convertEmailToLowerCase(sanitizeInput(rawOldEmail));
    const newEmail = convertEmailToLowerCase(sanitizeInput(rawNewEmail));
    const dbUser = await User.findOne({ email: oldEmail });
    if (!dbUser) {
      throw new Error("We couldn't find any account associated with this email address!");
    }

    // Check if new email is already in use
    const existingUser = await User.findOne({ email: newEmail });
    if (existingUser && existingUser._id.toString() !== dbUser._id.toString()) {
      throw new Error("This email address is already in use by another account");
    }

    // Generate single security code
    const securityCode = generateSecurityCode();

    // Send confirmation email to NEW email address only
    const emailContent = `
      <div style="font-size: 18px;">
        <div>You (or someone with access to your account) requested to change the email address for your TWOX account.</div>
        <br/>
        <div><strong>New Email Address:</strong> ${newEmail}</div>
        <br/>
        <div>Your <span style="font-weight: bold;">Verification Code</span> is:</div>
        <div style="font-weight: bold; font-size: 24px;">${securityCode}</div>
        <br/>
        <div>This code will expire in 15 minutes.</div>
        <br/>
        <div>Enter this code on the settings page to complete your email change.</div>
        <br/>
        <div>If you did not request this email change, please ignore this email and your email address will remain unchanged.</div>
      </div>
    `;

    await sendEmail(newEmail, 'Email Change Verification Code', emailContent);

    // Store security code in database
    await User.updateOne(
      { email: oldEmail },
      {
        $set: {
          resetPasswordToken: securityCode,
          resetPasswordExpires: Date.now() + this.SECURITY_CODE_EXPIRY,
        },
      }
    );

    return "We've sent a verification code to your new email address!";
  }

  async verifySecurityCodeAndChangeEmail(oldRawEmail, newRawEmail, code) {
    const oldEmail = convertEmailToLowerCase(sanitizeInput(oldRawEmail));
    const newEmail = convertEmailToLowerCase(sanitizeInput(newRawEmail));
    const dbUser = await User.findOne({ email: oldEmail });
    if (!dbUser) {
      throw new Error("We couldn't find any account associated with this email address!");
    }

    // Verify security code
    if (dbUser.resetPasswordToken !== code) {
      throw new Error('Invalid verification code. Please try again.');
    }

    // Check if code expired
    if (dbUser.resetPasswordExpires < Date.now()) {
      throw new Error('The verification code has expired. Please request a new one.');
    }

    // Check if new email is already in use
    const existingUser = await User.findOne({ email: newEmail });
    if (existingUser && existingUser._id.toString() !== dbUser._id.toString()) {
      throw new Error("This email address is already in use by another account");
    }

    // Update email and clear reset tokens
    dbUser.email = newEmail;
    dbUser.resetPasswordToken = '';
    dbUser.resetPasswordExpires = Date.now();
    await dbUser.save();

    return 'Email address updated successfully!';
  }

  async setPassword(userId, password) {
    const user = await User.findOne({ _id: userId });
    user.password = this.encryptPassword(password);
    await user.save();

    return {
      emailLinked: !!user.email,
      googleLinked: !!user.googleId,
      steamLinked: !!user.steamId,
      isSetPass: !!user.password,
    };
  }

  async updatePassword(userId, currentPass, newPass) {
    const user = await User.findOne({ _id: userId });
    if (!user) {
      return {
        success: false,
        msg: 'User not found',
      };
    }

    if (user.password && user.password !== this.encryptPassword(currentPass)) {
      return {
        success: false,
        msg: 'Incorrect password',
      };
    }

    user.password = this.encryptPassword(newPass);
    await user.save();

    return {
      success: true,
    };
  }

  async updateProfile({ userId, username, fullName, phoneNumber, CPFNumber, address, city, state, zipCode }) {
    const user = await User.findOne({ _id: userId });
    if (!user) {
      return {
        success: false,
        msg: 'User not found',
      };
    }

    let sanitizedCPFNumber = null;

    if (CPFNumber) {
      sanitizedCPFNumber = this.sanitizeCPFNumber(CPFNumber);
      if (!this.checkValidCPFNumber(sanitizedCPFNumber)) {
        return {
          success: false,
          msg: 'Invalid CPF number',
        };
      }
    }

    user.username = username;
    user.fullName = fullName;
    user.phoneNumber = phoneNumber || null;
    user.CPFNumber = sanitizedCPFNumber || null;
    user.address = address || null;
    user.city = city || null;
    user.state = state || null;
    user.zipCode = zipCode || null;
    await user.save();

    return {
      success: true,
    };
  }

  async updateUserAvatar(userId, avatar) {
    try {
      const user = await User.findOne({ _id: userId });
      if (!user) {
        return {
          success: false,
          msg: 'User not found',
        };
      }
      user.avatar = avatar;
      await user.save();

      return {
        success: true,
        avatar,
      };
    } catch (error) {
      return {
        success: false,
        msg: 'Failed to update avatar',
      };
    }
  }

  async isFirstLogin(userId) {
    // Get the UserLogin model

    // Count existing login records for this user
    const loginCount = await UserLogin.countDocuments({ userId });

    // First login if there are no previous login records
    return loginCount === 1;
  }

  async getKYCStatus(userId) {
    logger.debug('userId', userId);
    const kyc = await KYC.findOne({ userId }).select(
      'status adminReview.status adminReview.notes adminReview.rejectionReason adminReview.reviewedAt'
    );
    return kyc;
  }

  async recordLogin(userId, clientIP, userAgent) {
    const ipInfo = await getIPInfo(clientIP);
    // Create a new login record
    const loginRecord = new UserLogin({
      userId,
      ipAddress: clientIP,
      userAgent,
      ipInfo,
    });

    return loginRecord.save();
  }

  async updateCPFNumber(userId, cpfNumber) {
    const user = await User.findOne({ _id: userId });
    if (!user) {
      return {
        success: false,
        msg: 'User not found',
      };
    }

    user.CPFNumber = cpfNumber;
    await user.save();

    return {
      success: true,
    };
  }

  sanitizeCPFNumber(cpfNumber) {
    // Remove all non-numeric characters
    return cpfNumber.replace(/\D/g, '');
  }

  checkValidCPFNumber(cpfNumber) {
    // Check if the CPF number is valid
    return cpfNumber.length === 11;
  }

  async toggleFavoriteGame(userId, gameId) {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const favoriteGame = await FavoriteGame.findOne({ user: userId, game: gameId });
    if (favoriteGame) {
      await FavoriteGame.deleteOne({ _id: favoriteGame._id });

      return {
        state: 'removed',
        message: 'Game removed from favorites',
      };
    } else {
      await FavoriteGame.create({ user: userId, game: gameId });

      return {
        state: 'added',
        message: 'Game added to favorites',
      };
    }
  }

  async getFavoriteGameIds(userId) {
    const favoriteGames = await FavoriteGame.find({ user: userId }).select('game');
    return favoriteGames.map((game) => game.game);
  }
}

export default new UserService();
