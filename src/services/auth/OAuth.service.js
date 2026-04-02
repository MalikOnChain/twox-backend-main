import crypto from 'crypto';
import axios from 'axios';
import { google } from 'googleapis';

import config from '@/config';
import User from '@/models/users/User';
import { generateIdentifier, getClientIP, getClientUserAgent } from '@/utils/helpers/auth';
import { logger } from '@/utils/logger';

class OAuthService {
  constructor() {
    this.FRONTEND_URL = config.site.frontendUrl || 'http://localhost:3000';
    this.BACKEND_URL = config.site.backendUrl || 'http://localhost:5000';
  }

  /**
   * Generate Google OAuth URL
   */
  generateGoogleAuthUrl(ref = '') {
    const callbackUrl = `${this.BACKEND_URL}/api/auth/google/callback`;
    
    logger.info('Generating Google OAuth URL', {
      backendUrl: this.BACKEND_URL,
      callbackUrl: callbackUrl,
    });

    const oauth2Client = new google.auth.OAuth2(
      config.authentication.googleOauth.clientId,
      config.authentication.googleOauth.clientSecret,
      callbackUrl
    );

    const redirectUrl = `${this.FRONTEND_URL}${ref ? `?ref=${ref}` : ''}`;
    
    const scopes = ['profile', 'email'];
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent',
      state: Buffer.from(JSON.stringify({ redirect: redirectUrl, ref })).toString('base64'),
    });

    return authUrl;
  }

  /**
   * Handle Google OAuth callback
   */
  async handleGoogleCallback(code, state, clientIP, userAgent) {
    try {
      const oauth2Client = new google.auth.OAuth2(
        config.authentication.googleOauth.clientId,
        config.authentication.googleOauth.clientSecret,
        `${this.BACKEND_URL}/api/auth/google/callback`
      );

      const { tokens } = await oauth2Client.getToken(code);
      oauth2Client.setCredentials(tokens);

      const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
      const { data: profile } = await oauth2.userinfo.get();

      if (!profile.email || !profile.id) {
        throw new Error('Failed to get user information from Google');
      }

      // Find or create user
      let user = await User.findOne({ googleId: profile.id });
      
      if (!user) {
        // Check if email already exists
        const existingUser = await User.findOne({ email: profile.email.toLowerCase() });
        if (existingUser) {
          // Link Google account to existing user
          existingUser.googleId = profile.id;
          if (!existingUser.verified.includes('google')) {
            existingUser.verified.push('google');
          }
          await existingUser.save();
          user = existingUser;
        } else {
          // Create new user
          const username = this.generateUsernameFromEmail(profile.email);
          user = await User.create({
            email: profile.email.toLowerCase(),
            googleId: profile.id,
            username: username,
            fullName: profile.name || '',
            avatar: profile.picture || 'default-avatar.png',
            isEmailVerified: true,
            verified: ['google'],
          });
        }
      }

      // Generate identifier for token exchange
      const identifier = await generateIdentifier(user, clientIP, userAgent);
      
      let decodedState = {};
      try {
        decodedState = JSON.parse(Buffer.from(state, 'base64').toString());
      } catch (e) {
        // State parsing failed, use defaults
      }

      return {
        success: true,
        identifier,
        redirect: decodedState.redirect || this.FRONTEND_URL,
      };
    } catch (error) {
      logger.error('Google OAuth callback error:', error);
      throw error;
    }
  }

  /**
   * Generate Discord OAuth URL
   */
  generateDiscordAuthUrl(ref = '') {
    const redirectUrl = `${this.BACKEND_URL}/api/auth/discord/callback`;
    const redirect = `${this.FRONTEND_URL}${ref ? `?ref=${ref}` : ''}`;
    const state = Buffer.from(JSON.stringify({ redirect, ref })).toString('base64');

    const params = new URLSearchParams({
      client_id: config.authentication.discordOauth.clientId,
      redirect_uri: redirectUrl,
      response_type: 'code',
      scope: 'identify email',
      state: state,
    });

    return `https://discord.com/api/oauth2/authorize?${params.toString()}`;
  }

  /**
   * Handle Discord OAuth callback
   */
  async handleDiscordCallback(code, state, clientIP, userAgent) {
    try {
      const redirectUrl = `${this.BACKEND_URL}/api/auth/discord/callback`;
      
      // Exchange code for token
      const tokenResponse = await axios.post(
        'https://discord.com/api/oauth2/token',
        new URLSearchParams({
          client_id: config.authentication.discordOauth.clientId,
          client_secret: config.authentication.discordOauth.clientSecret,
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: redirectUrl,
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      const { access_token } = tokenResponse.data;

      // Get user info
      const userResponse = await axios.get('https://discord.com/api/users/@me', {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      });

      const profile = userResponse.data;

      if (!profile.email || !profile.id) {
        throw new Error('Failed to get user information from Discord');
      }

      // Find or create user
      let user = await User.findOne({ discordId: profile.id });
      
      if (!user) {
        // Check if email already exists
        const existingUser = await User.findOne({ email: profile.email.toLowerCase() });
        if (existingUser) {
          // Link Discord account to existing user
          existingUser.discordId = profile.id;
          if (!existingUser.verified.includes('discord')) {
            existingUser.verified.push('discord');
          }
          await existingUser.save();
          user = existingUser;
        } else {
          // Create new user
          const username = this.generateUsernameFromEmail(profile.email);
          user = await User.create({
            email: profile.email.toLowerCase(),
            discordId: profile.id,
            username: username,
            fullName: profile.username || '',
            avatar: profile.avatar 
              ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`
              : 'default-avatar.png',
            isEmailVerified: true,
            verified: ['discord'],
          });
        }
      }

      // Generate identifier for token exchange
      const identifier = await generateIdentifier(user, clientIP, userAgent);
      
      let decodedState = {};
      try {
        decodedState = JSON.parse(Buffer.from(state, 'base64').toString());
      } catch (e) {
        // State parsing failed, use defaults
      }

      return {
        success: true,
        identifier,
        redirect: decodedState.redirect || this.FRONTEND_URL,
      };
    } catch (error) {
      logger.error('Discord OAuth callback error:', error);
      throw error;
    }
  }

  /**
   * Generate Telegram OAuth URL (Telegram Login Widget)
   */
  generateTelegramAuthUrl(ref = '') {
    // Telegram uses a different OAuth flow - it uses Login Widget
    // For now, we'll redirect to a page with Telegram Login Widget
    // Or we can use Telegram Bot API for authentication
    const redirect = `${this.FRONTEND_URL}${ref ? `?ref=${ref}` : ''}`;
    const state = Buffer.from(JSON.stringify({ redirect, ref })).toString('base64');
    
    // Return a URL that will trigger Telegram Login Widget
    // The frontend will handle the Telegram widget
    return `${this.FRONTEND_URL}/telegram-auth?state=${state}`;
  }

  /**
   * Handle Telegram authentication (via bot webhook or widget)
   * This handles the data from Telegram Login Widget
   */
  async handleTelegramAuth(telegramData, clientIP, userAgent) {
    try {
      // Verify Telegram data hash (security check)
      if (!this.verifyTelegramAuth(telegramData)) {
        throw new Error('Invalid Telegram authentication data');
      }

      const { id, first_name, last_name, username, photo_url } = telegramData;

      if (!id) {
        throw new Error('Failed to get user information from Telegram');
      }

      // Find or create user
      let user = await User.findOne({ telegramId: id.toString() });
      
      if (!user) {
        // Create new user with Telegram data
        // Note: Telegram doesn't provide email, so we'll create without email
        const generatedUsername = username || `telegram_${id}`;
        const existingUsername = await User.findOne({ username: generatedUsername });
        const finalUsername = existingUsername 
          ? `${generatedUsername}_${Date.now()}`
          : generatedUsername;

        user = await User.create({
          telegramId: id.toString(),
          username: finalUsername,
          fullName: `${first_name || ''} ${last_name || ''}`.trim() || generatedUsername,
          avatar: photo_url || 'default-avatar.png',
          verified: ['telegram'],
          // Email not required for Telegram users
        });
      }

      // Generate identifier for token exchange
      const identifier = await generateIdentifier(user, clientIP, userAgent);
      
      return {
        success: true,
        identifier,
        redirect: this.FRONTEND_URL,
      };
    } catch (error) {
      logger.error('Telegram auth error:', error);
      throw error;
    }
  }

  /**
   * Verify Telegram authentication hash
   */
  verifyTelegramAuth(data) {
    if (!data.hash || !config.authentication.telegramOauth.botToken) {
      return false;
    }

    const { hash, ...userData } = data;
    const dataCheckString = Object.keys(userData)
      .sort()
      .map(key => `${key}=${userData[key]}`)
      .join('\n');

    const secretKey = crypto
      .createHash('sha256')
      .update(config.authentication.telegramOauth.botToken)
      .digest();

    const calculatedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    return calculatedHash === hash;
  }

  /**
   * Generate username from email
   */
  generateUsernameFromEmail(email) {
    const baseUsername = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '_');
    const timestamp = Date.now().toString().slice(-6);
    return `${baseUsername}_${timestamp}`;
  }
}

export default new OAuthService();

