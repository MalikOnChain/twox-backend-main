import crypto from 'crypto';

import bcrypt from 'bcrypt';
import md5 from 'md5';

import config from '@/config';
import Promotion from '@/models/promotion/Promotion';
import User from '@/models/users/User';
import UserReferralService from '@/services/affiliate/UserReferral.service';
import ipController from '@/services/IP';
import { getEmailTemplate } from '@/utils/email/emails';
import { convertEmailToLowerCase, sanitizeInput, sendEmail, generateSecurityCode } from '@/utils/helpers';
import { createNewUser } from '@/utils/helpers/auth';
import { logger } from '@/utils/logger';

export class AuthService {
  constructor() {
    this.SALT_ROUNDS = 12;
    this.SECURITY_CODE_EXPIRY = 600000; // 10 minutes
    this.EMAIL_VERIFICATION_EXPIRY = 3600000; // 1 hour
    this.USERNAME_MIN_LENGTH = 3;
    this.USERNAME_MAX_LENGTH = 16;
    this.PASSWORD_MIN_LENGTH = 8;
    this.PASSWORD_MAX_LENGTH = 30;

    this.FRONTEND_URL = config.site.frontendUrl;
    this.userReferralService = UserReferralService;
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

  async sendVerificationEmail(user, token) {
    const verificationUrl = `${this.FRONTEND_URL}?emailVerificationToken=${token}`;

    const { subject, html } = getEmailTemplate('verifyEmail', {
      verificationUrl,
      username: user.username,
    });

    const emailTemplate = {
      to: user.email,
      subject,
      html,
    };

    try {
      await sendEmail(emailTemplate.to, emailTemplate.subject, emailTemplate.html);
      logger.info('Verification email sent successfully', { email: user.email });
    } catch (error) {
      logger.error('Email sending failed:', { error: error.message, email: user.email });
      throw { status: 500, message: 'Failed to send verification email' };
    }
  }

  async generateEmailVerificationToken(user) {
    try {
      const emailVerificationToken = crypto.randomBytes(32).toString('hex');

      user.emailVerificationToken = emailVerificationToken;
      user.verificationExpiresAt = Date.now() + this.EMAIL_VERIFICATION_EXPIRY;

      await user.save();

      logger.info('Email verification token generated', { userId: user._id });
      return emailVerificationToken;
    } catch (error) {
      logger.error('Token generation failed:', error);
      throw { status: 500, message: 'Failed to generate verification token' };
    }
  }

  async validateIpAddress(clientIP) {
    if (process.env.NODE_ENV !== 'production') {
      return true;
    }

    try {
      const isBanned = await ipController.hasAlreadyCreatedAccount(clientIP);
      return !isBanned;
    } catch (error) {
      logger.error('IP validation error:', { error: error.message, clientIP });
      return true; // Allow registration if IP check fails
    }
  }

  async loginUser(email, password) {
    const sanitizedEmail = convertEmailToLowerCase(sanitizeInput(email));

    try {
      const dbUser = await User.findOne({ email: sanitizedEmail });

      if (!dbUser) {
        throw new Error('Invalid email or password');
      }

      // Use legacy MD5 check for existing users, bcrypt for new users
      const isValidPassword =
        dbUser.password.length === 32
          ? this.verifyLegacyPassword(password, dbUser.password)
          : await this.verifyPassword(password, dbUser.password);

      if (!isValidPassword) {
        throw new Error('Invalid email or password');
      }

      if (dbUser.isBanned) {
        throw new Error('Account has been suspended');
      }

      // if (!dbUser.isEmailVerified) {
      //   await this.handleUnverifiedEmailLogin(dbUser);
      //   throw new Error('Email verification required. Please check your email.');
      // }

      // Migrate legacy password to bcrypt
      if (dbUser.password.length === 32) {
        await this.migrateLegacyPassword(dbUser, password);
      }

      logger.info('User login successful', {
        userId: dbUser._id,
        email: sanitizedEmail,
      });

      return dbUser;
    } catch (error) {
      logger.error('Login attempt failed:', {
        error: error.message,
        email: sanitizedEmail,
      });
      throw error;
    }
  }

  verifyLegacyPassword(password, hash) {
    const LEGACY_SALT = 'BestAuthSystemv1.0InTheBuilding-';
    return md5(LEGACY_SALT + password) === hash;
  }

  async migrateLegacyPassword(user, password) {
    try {
      const hashedPassword = await this.hashPassword(password);
      await User.updateOne({ _id: user._id }, { $set: { password: hashedPassword } });
      logger.info('Password migrated to bcrypt', { userId: user._id });
    } catch (error) {
      logger.error('Password migration failed:', {
        error: error.message,
        userId: user._id,
      });
    }
  }

  async handleUnverifiedEmailLogin(user) {
    if (user.verificationExpiresAt < Date.now()) {
      const emailVerificationToken = await this.generateEmailVerificationToken(user);
      await this.sendVerificationEmail(user, emailVerificationToken);
      logger.info('New verification email sent', { userId: user._id });
    }
  }

  async forgotPassword(rawEmail) {
    const email = convertEmailToLowerCase(sanitizeInput(rawEmail));

    try {
      const dbUser = await User.findOne({ email });

      if (!dbUser) {
        throw new Error('No account found with this email address');
      }

      const securityCode = generateSecurityCode();

      const { subject, html } = getEmailTemplate('forgotPassword', {
        securityCode,
      });

      const payload = {
        to: email,
        subject,
        html,
      };

      await sendEmail(payload.to, payload.subject, payload.html);

      await User.updateOne(
        { email },
        {
          $set: {
            resetPasswordToken: securityCode,
            resetPasswordExpires: Date.now() + this.SECURITY_CODE_EXPIRY,
          },
        }
      );

      logger.info('Password reset initiated', { email });

      return {
        message: 'Código de segurança enviado para seu e-mail!',
        verificationCode: securityCode,
      };
    } catch (error) {
      logger.error('Forgot password error:', { error: error.message, email });
      throw error;
    }
  }

  async verifySecurityCode(rawEmail, code) {
    const email = convertEmailToLowerCase(sanitizeInput(rawEmail));

    try {
      const dbUser = await User.findOne({ email });

      if (!dbUser) {
        throw new Error('No account found with this email address');
      }

      if (dbUser.resetPasswordExpires < Date.now()) {
        throw new Error('Security code has expired. Please request a new one.');
      }

      if (dbUser.resetPasswordToken !== code) {
        throw new Error('Invalid security code. Please try again.');
      }

      return true;
    } catch (error) {
      logger.error('Security code verification failed:', { error: error.message, email });
      throw error;
    }
  }

  async resetPassword(rawEmail, code, password) {
    const email = convertEmailToLowerCase(sanitizeInput(rawEmail));

    try {
      // Verify the code first
      await this.verifySecurityCode(email, code);

      const hashedPassword = await this.hashPassword(password);

      await User.updateOne(
        { email },
        {
          $set: { password: hashedPassword },
          $unset: { resetPasswordToken: '', resetPasswordExpires: '' },
        }
      );

      logger.info('Password reset successful', { email });

      return 'Password has been updated successfully!';
    } catch (error) {
      logger.error('Password reset failed:', { error: error.message, email });
      throw error;
    }
  }

  async registerUser({
    username: rawUsername,
    email: rawEmail,
    password,
    utm_source,
    utm_campaign,
    CPFNumber,
    phoneNumber,
    clientIP,
    referralCode,
  }) {
    try {
      // Sanitize inputs
      const username = sanitizeInput(rawUsername);
      const email = convertEmailToLowerCase(sanitizeInput(rawEmail));
      const sanitizedCPFNumber = CPFNumber ? sanitizeInput(CPFNumber) : null;
      const sanitizedPhoneNumber = phoneNumber ? sanitizeInput(phoneNumber) : null;

      // Validate registration data
      await this.validateRegistrationData({
        email,
        username,
        password,
        clientIP,
        CPFNumber: sanitizedCPFNumber,
        phoneNumber: sanitizedPhoneNumber,
      });

      // Handle existing users
      const existingUser = await this.handleExistingUser(email, username, password);
      if (existingUser) {
        return existingUser;
      }

      // Create user data object
      const userData = await this.prepareUserData({
        email,
        username,
        password,
        clientIP,
        utm_source,
        utm_campaign,
        CPFNumber: sanitizedCPFNumber,
        phoneNumber: sanitizedPhoneNumber,
      });

      // Create the user
      const newUser = await this.createUserAccount(userData);

      // Process referral if provided
      if (referralCode) {
        await this.processUserReferral(referralCode, newUser);
      }

      logger.info('User registration successful', {
        userId: newUser._id,
        email: newUser.email,
      });

      return newUser;
    } catch (error) {
      logger.error('Registration failed:', {
        error: error.message,
        email: rawEmail,
        username: rawUsername,
      });
      throw this.formatRegistrationError(error);
    }
  }

  async validateRegistrationData({ email, username, password, clientIP }) {
    const validations = [
      {
        condition: !(await this.validateIpAddress(clientIP)),
        message: 'Registration limit reached for this IP address',
      },
      {
        condition: !this.validateEmail(email),
        message: 'Invalid email address format',
      },
      {
        condition: !this.validateUsername(username),
        message: 'Username must be 3-16 characters with only letters, numbers, and underscores',
      },
      {
        condition: password.length < this.PASSWORD_MIN_LENGTH || password.length > this.PASSWORD_MAX_LENGTH,
        message: `Password must be ${this.PASSWORD_MIN_LENGTH}-${this.PASSWORD_MAX_LENGTH} characters long`,
      },
    ];

    for (const { condition, message } of validations) {
      if (condition) {
        throw { status: 400, message };
      }
    }
  }

  async handleExistingUser(email, username, password) {
    const [existingEmail, existingUsername] = await Promise.all([User.findOne({ email }), User.findOne({ username })]);

    if (existingUsername && existingUsername.email !== email) {
      throw { status: 400, message: 'Username is already taken' };
    }

    if (existingEmail) {
      if (!existingEmail.isEmailVerified) {
        // Update unverified account
        existingEmail.password = await this.hashPassword(password);
        existingEmail.username = username;
        await existingEmail.save();

        logger.info('Updated existing unverified user', {
          userId: existingEmail._id,
          email,
        });

        return existingEmail;
      } else {
        throw { status: 400, message: 'Email address is already registered' };
      }
    }

    return null;
  }

  async prepareUserData({ email, username, password, clientIP, utm_source, utm_campaign, CPFNumber, phoneNumber }) {
    const hashedPassword = await this.hashPassword(password);

    let userData = {
      email,
      username,
      password: hashedPassword,
      clientIP,
      isEmailVerified: false,
      registrationDate: new Date(),
      lastLoginDate: null,
    };

    // Add UTM parameters
    if (utm_source) {
      userData.utm_source = sanitizeInput(utm_source);
    }

    if (utm_campaign) {
      try {
        const promotion = await Promotion.findOne({ name: utm_campaign });
        if (promotion) {
          userData.utm_campaign = promotion._id;
        } else {
          logger.warn('Promotion not found for campaign', { utm_campaign });
        }
      } catch (error) {
        logger.error('Error finding promotion:', { error: error.message, utm_campaign });
      }
    }

    // Add optional fields
    if (CPFNumber) {
      userData.CPFNumber = CPFNumber;
    }

    if (phoneNumber) {
      userData.phoneNumber = phoneNumber;
    }

    return userData;
  }

  async createUserAccount(userData) {
    try {
      const newUser = await createNewUser(userData);

      // Track IP in production
      if (process.env.NODE_ENV === 'production') {
        await ipController.addIPAddress(userData.clientIP);
      }

      return newUser;
    } catch (error) {
      logger.error('User creation failed:', {
        message: error.message,
        stack: error.stack,
        email: userData.email,
      });
      const detail =
        process.env.NODE_ENV !== 'production' && error.message
          ? `${error.message}`
          : 'Failed to create user account';
      throw { status: 500, message: detail };
    }
  }

  async processUserReferral(referralCode, user) {
    try {
      const referralResult = await this.userReferralService.processReferral(referralCode, user);

      if (referralResult.success) {
        logger.info('Referral processed successfully', {
          userId: user._id,
          referralCode,
        });
      } else {
        logger.warn('Referral processing failed', {
          userId: user._id,
          referralCode,
          message: referralResult.message,
        });
      }
    } catch (error) {
      logger.error('Referral processing error:', {
        error: error.message,
        userId: user._id,
        referralCode,
      });
      // Don't throw error - registration should continue even if referral fails
    }
  }

  formatRegistrationError(error) {
    return {
      status: error.status || 500,
      message: error.message || 'Registration failed',
      code: error.code || 'REGISTRATION_ERROR',
    };
  }

  async verifyEmailUser(emailVerificationToken) {
    try {
      const user = await User.findOne({ emailVerificationToken });

      if (!user) {
        throw { status: 400, message: 'Invalid or expired verification token' };
      }

      // Check token expiration
      if (user.verificationExpiresAt < Date.now()) {
        // Delete expired unverified user
        await User.deleteOne({ _id: user._id });
        throw {
          status: 400,
          message: 'Verification token has expired. Please register again.',
        };
      }

      // Mark email as verified
      user.isEmailVerified = true;
      user.emailVerificationToken = undefined;
      user.verificationExpiresAt = undefined;
      await user.save();

      logger.info('Email verification successful', {
        userId: user._id,
        email: user.email,
      });

      return user;
    } catch (error) {
      logger.error('Email verification failed:', {
        error: error.message,
        token: emailVerificationToken,
      });
      throw error;
    }
  }

  async getUserByEmail(email) {
    const sanitizedEmail = convertEmailToLowerCase(sanitizeInput(email));

    try {
      const user = await User.findOne({ email: sanitizedEmail });

      if (!user) {
        throw { status: 404, message: 'User not found' };
      }

      if (user.isEmailVerified) {
        throw { status: 400, message: 'Email is already verified' };
      }

      return user;
    } catch (error) {
      logger.error('Get user by email failed:', { error: error.message, email: sanitizedEmail });
      throw error;
    }
  }

  async updateUsers() {
    try {
      // Implementation depends on what kind of update is needed
      // This is a placeholder for the actual update logic
      const users = await User.find({}).select('-password -resetPasswordToken');

      logger.info('Users retrieved for update', { count: users.length });

      return users;
    } catch (error) {
      logger.error('Update users failed:', error);
      throw { status: 500, message: 'Failed to update users' };
    }
  }
}

export default new AuthService();
