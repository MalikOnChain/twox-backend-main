import WaitingListOAuthService from '@/services/auth/WaitingListOAuth.service';
import { getClientIP, getClientUserAgent } from '@/utils/helpers/waiting-list-auth';
import { logger } from '@/utils/logger';

export class WaitingListOAuthController {
  /**
   * Google OAuth - Redirect to Google
   */
  googleAuth = async (req, res) => {
    try {
      const { ref, redirect } = req.query;
      const authUrl = WaitingListOAuthService.generateGoogleAuthUrl(ref || '');
      
      return res.redirect(authUrl);
    } catch (error) {
      logger.error('Google auth error for waiting list:', error);
      return res.redirect(`${WaitingListOAuthService.FRONTEND_URL}?error=google_auth_failed`);
    }
  };

  /**
   * Google OAuth Callback
   */
  googleCallback = async (req, res) => {
    try {
      const { code, state, error } = req.query;
      const clientIP = getClientIP(req);
      const userAgent = getClientUserAgent(req);

      // Check if request is coming through ngrok
      const isNgrok = req.headers.host?.includes('ngrok') || 
                      req.headers['x-forwarded-host']?.includes('ngrok');

      if (error) {
        if (isNgrok) {
          return res.setHeader('ngrok-skip-browser-warning', 'true').redirect(`${WaitingListOAuthService.FRONTEND_URL}?error=${error}`);
        }
        return res.redirect(`${WaitingListOAuthService.FRONTEND_URL}?error=${error}`);
      }

      if (!code) {
        if (isNgrok) {
          return res.setHeader('ngrok-skip-browser-warning', 'true').redirect(`${WaitingListOAuthService.FRONTEND_URL}?error=missing_code`);
        }
        return res.redirect(`${WaitingListOAuthService.FRONTEND_URL}?error=missing_code`);
      }

      const result = await WaitingListOAuthService.handleGoogleCallback(code, state || '', clientIP, userAgent);
      
      logger.info('Google OAuth success for waiting list', { identifier: result.identifier });

      // Redirect to frontend with identifier
      const redirectUrl = `${result.redirect}${result.redirect.includes('?') ? '&' : '?'}identifier=${result.identifier}`;
      
      if (isNgrok) {
        return res.setHeader('ngrok-skip-browser-warning', 'true').redirect(redirectUrl);
      }
      return res.redirect(redirectUrl);
    } catch (error) {
      logger.error('Google callback error for waiting list:', error);
      const errorMessage = error instanceof Error ? error.message : 'google_auth_failed';
      const isNgrok = req.headers.host?.includes('ngrok') || 
                      req.headers['x-forwarded-host']?.includes('ngrok');
      if (isNgrok) {
        return res.setHeader('ngrok-skip-browser-warning', 'true').redirect(`${WaitingListOAuthService.FRONTEND_URL}?error=${encodeURIComponent(errorMessage)}`);
      }
      return res.redirect(`${WaitingListOAuthService.FRONTEND_URL}?error=${encodeURIComponent(errorMessage)}`);
    }
  };

  /**
   * Discord OAuth - Redirect to Discord
   */
  discordAuth = async (req, res) => {
    try {
      const { ref, redirect } = req.query;
      const authUrl = WaitingListOAuthService.generateDiscordAuthUrl(ref || '');
      
      return res.redirect(authUrl);
    } catch (error) {
      logger.error('Discord auth error for waiting list:', error);
      return res.redirect(`${WaitingListOAuthService.FRONTEND_URL}?error=discord_auth_failed`);
    }
  };

  /**
   * Discord OAuth Callback
   */
  discordCallback = async (req, res) => {
    try {
      const { code, state, error } = req.query;
      const clientIP = getClientIP(req);
      const userAgent = getClientUserAgent(req);

      if (error) {
        return res.redirect(`${WaitingListOAuthService.FRONTEND_URL}?error=${error}`);
      }

      if (!code) {
        return res.redirect(`${WaitingListOAuthService.FRONTEND_URL}?error=missing_code`);
      }

      const result = await WaitingListOAuthService.handleDiscordCallback(code, state || '', clientIP, userAgent);
      
      logger.info('Discord OAuth success for waiting list', { identifier: result.identifier });

      // Redirect to frontend with identifier
      const redirectUrl = `${result.redirect}${result.redirect.includes('?') ? '&' : '?'}identifier=${result.identifier}`;
      return res.redirect(redirectUrl);
    } catch (error) {
      logger.error('Discord callback error for waiting list:', error);
      const errorMessage = error instanceof Error ? error.message : 'discord_auth_failed';
      return res.redirect(`${WaitingListOAuthService.FRONTEND_URL}?error=${encodeURIComponent(errorMessage)}`);
    }
  };

  /**
   * Telegram OAuth - Redirect to Telegram Auth Page
   */
  telegramAuth = async (req, res) => {
    try {
      const { ref, redirect } = req.query;
      const authUrl = WaitingListOAuthService.generateTelegramAuthUrl(ref || '');
      
      return res.redirect(authUrl);
    } catch (error) {
      logger.error('Telegram auth error for waiting list:', error);
      return res.redirect(`${WaitingListOAuthService.FRONTEND_URL}?error=telegram_auth_failed`);
    }
  };

  /**
   * Telegram Auth Handler (receives data from widget)
   */
  telegramCallback = async (req, res) => {
    try {
      const { state, ...telegramData } = req.body;
      const clientIP = getClientIP(req);
      const userAgent = getClientUserAgent(req);

      if (!telegramData || !telegramData.id) {
        return res.status(400).json({
          success: false,
          error: 'Invalid Telegram authentication data',
        });
      }

      const result = await WaitingListOAuthService.handleTelegramAuth(telegramData, clientIP, userAgent);

      logger.info('Telegram auth success for waiting list', { identifier: result.identifier });

      let decodedState = {};
      try {
        decodedState = JSON.parse(Buffer.from(state, 'base64').toString());
      } catch (e) {
        logger.warn('Failed to decode Telegram state:', e);
      }

      const redirect = decodedState.redirect || WaitingListOAuthService.FRONTEND_URL || 'http://localhost:3000';
      const redirectUrl = `${redirect}${redirect.includes('?') ? '&' : '?'}identifier=${result.identifier}`;
      
      return res.redirect(redirectUrl);
    } catch (error) {
      logger.error('Telegram callback error for waiting list:', error);
      const errorMessage = error instanceof Error ? error.message : 'telegram_auth_failed';
      return res.redirect(`${WaitingListOAuthService.FRONTEND_URL}?error=${encodeURIComponent(errorMessage)}`);
    }
  };
}

export default new WaitingListOAuthController();

