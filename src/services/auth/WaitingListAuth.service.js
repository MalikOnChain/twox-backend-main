import crypto from 'crypto';
import bcrypt from 'bcrypt';

import WaitingList from '@/models/waiting-list/WaitingList';
import { convertEmailToLowerCase, sanitizeInput, generateAvatarUrl } from '@/utils/helpers';
import { logger } from '@/utils/logger';

export class WaitingListAuthService {
  constructor() {
    this.SALT_ROUNDS = 12;
    this.USERNAME_MIN_LENGTH = 3;
    this.USERNAME_MAX_LENGTH = 16;
    this.PASSWORD_MIN_LENGTH = 8;
    this.PASSWORD_MAX_LENGTH = 30;
  }

  async hashPassword(password) {
    try {
      return await bcrypt.hash(password, this.SALT_ROUNDS);
    } catch (error) {
      logger.error('Password hashing error:', error);
      throw new Error('Password processing failed');
    }
  }

  async verifyPassword(password, hash) {
    try {
      return await bcrypt.compare(password, hash);
    } catch (error) {
      logger.error('Password verification error:', error);
      return false;
    }
  }

  validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  validateUsername(username) {
    const regex = /^[a-zA-Z0-9_]{3,16}$/;
    return regex.test(username);
  }

  generateUsernameFromEmail(email) {
    const baseUsername = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
    const randomSuffix = Math.floor(Math.random() * 10000);
    return `${baseUsername}${randomSuffix}`;
  }

  async loginUser(email, password) {
    try {
      const normalizedEmail = convertEmailToLowerCase(sanitizeInput(email));

      // Find user by email
      const waitingListUser = await WaitingList.findOne({ email: normalizedEmail });

      if (!waitingListUser) {
        throw { status: 401, message: 'Invalid email or password' };
      }

      // Check if user has password (OAuth users might not have password)
      if (!waitingListUser.password) {
        throw { status: 401, message: 'Please use social login for this account' };
      }

      // Verify password
      const isPasswordValid = await this.verifyPassword(password, waitingListUser.password);
      if (!isPasswordValid) {
        throw { status: 401, message: 'Invalid email or password' };
      }

      // Check status
      if (waitingListUser.status !== 'approved' && waitingListUser.status !== 'pending') {
        throw { status: 403, message: 'Your account has been rejected' };
      }

      return waitingListUser;
    } catch (error) {
      if (error.status) {
        throw error;
      }
      logger.error('Login error:', error);
      throw { status: 500, message: 'Login failed' };
    }
  }

  async registerUser({
    username: rawUsername,
    email: rawEmail,
    password,
    utm_source,
    utm_campaign,
    phoneNumber,
    clientIP,
    referralCode,
  }) {
    try {
      // Sanitize inputs
      const username = rawUsername ? sanitizeInput(rawUsername) : null;
      const email = convertEmailToLowerCase(sanitizeInput(rawEmail));
      const sanitizedPhoneNumber = phoneNumber ? sanitizeInput(phoneNumber) : null;

      // Validate email
      if (!this.validateEmail(email)) {
        throw { status: 400, message: 'Invalid email format' };
      }

      // Check if email already exists
      const existingUser = await WaitingList.findOne({ email });
      if (existingUser) {
        throw { status: 409, message: 'Email already registered in waiting list' };
      }

      // Generate username if not provided
      const finalUsername = username || this.generateUsernameFromEmail(email);

      // Validate username
      if (!this.validateUsername(finalUsername)) {
        throw { status: 400, message: 'Invalid username format' };
      }

      // Check if username already exists
      const existingUsername = await WaitingList.findOne({ username: finalUsername });
      if (existingUsername) {
        // If username exists, generate a new one
        const randomSuffix = Math.floor(Math.random() * 10000);
        const newUsername = `${finalUsername}${randomSuffix}`;
        if (await WaitingList.findOne({ username: newUsername })) {
          throw { status: 409, message: 'Username already taken' };
        }
      }

      // Hash password
      const hashedPassword = await this.hashPassword(password);

      // Generate avatar
      const avatarUrl = generateAvatarUrl(finalUsername) || 'default-avatar.png';

      // Create waiting list user
      const newWaitingListUser = await WaitingList.create({
        email,
        username: finalUsername,
        password: hashedPassword,
        avatar: avatarUrl,
        phoneNumber: sanitizedPhoneNumber || '',
        utm_source: utm_source || '',
        utm_campaign: utm_campaign || '',
        referralCode: referralCode || '',
        registrationIP: clientIP || '',
        status: 'pending',
        verified: [],
      });

      logger.info('Waiting list user registered successfully', {
        userId: newWaitingListUser._id,
        email: newWaitingListUser.email,
      });

      return newWaitingListUser;
    } catch (error) {
      if (error.status) {
        throw error;
      }
      logger.error('Waiting list registration failed:', {
        error: error.message,
        email: rawEmail,
        username: rawUsername,
      });
      throw { status: 500, message: 'Registration failed' };
    }
  }
}

export default new WaitingListAuthService();

