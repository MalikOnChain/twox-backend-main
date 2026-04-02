import OAuthService from '@/services/auth/OAuth.service';
import { getClientIP, getClientUserAgent } from '@/utils/helpers/auth';
import { logger } from '@/utils/logger';

export class OAuthController {
  /**
   * Google OAuth - Redirect to Google
   */
  googleAuth = async (req, res) => {
    try {
      const { ref, redirect } = req.query;
      const authUrl = OAuthService.generateGoogleAuthUrl(ref || '');
      
      return res.redirect(authUrl);
    } catch (error) {
      logger.error('Google auth error:', error);
      return res.redirect(`${OAuthService.FRONTEND_URL}?error=google_auth_failed`);
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
          // Return HTML redirect page with ngrok skip header
          return res.setHeader('ngrok-skip-browser-warning', 'true').redirect(`${OAuthService.FRONTEND_URL}?error=${error}`);
        }
        return res.redirect(`${OAuthService.FRONTEND_URL}?error=${error}`);
      }

      if (!code) {
        if (isNgrok) {
          return res.setHeader('ngrok-skip-browser-warning', 'true').redirect(`${OAuthService.FRONTEND_URL}?error=missing_code`);
        }
        return res.redirect(`${OAuthService.FRONTEND_URL}?error=missing_code`);
      }

      const result = await OAuthService.handleGoogleCallback(code, state || '', clientIP, userAgent);
      
      logger.info('Google OAuth success', { identifier: result.identifier });

      // Redirect to frontend with identifier
      const redirectUrl = `${result.redirect}${result.redirect.includes('?') ? '&' : '?'}identifier=${result.identifier}`;
      
      if (isNgrok) {
        // Set ngrok skip warning header for redirect
        return res.setHeader('ngrok-skip-browser-warning', 'true').redirect(redirectUrl);
      }
      
      return res.redirect(redirectUrl);
    } catch (error) {
      logger.error('Google callback error:', error);
      const errorMessage = error instanceof Error ? error.message : 'google_auth_failed';
      const isNgrok = req.headers.host?.includes('ngrok') || 
                      req.headers['x-forwarded-host']?.includes('ngrok');
      
      if (isNgrok) {
        return res.setHeader('ngrok-skip-browser-warning', 'true').redirect(`${OAuthService.FRONTEND_URL}?error=${encodeURIComponent(errorMessage)}`);
      }
      return res.redirect(`${OAuthService.FRONTEND_URL}?error=${encodeURIComponent(errorMessage)}`);
    }
  };

  /**
   * Discord OAuth - Redirect to Discord
   */
  discordAuth = async (req, res) => {
    try {
      const { ref, redirect } = req.query;
      const authUrl = OAuthService.generateDiscordAuthUrl(ref || '');
      
      return res.redirect(authUrl);
    } catch (error) {
      logger.error('Discord auth error:', error);
      return res.redirect(`${OAuthService.FRONTEND_URL}?error=discord_auth_failed`);
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
        return res.redirect(`${OAuthService.FRONTEND_URL}?error=${error}`);
      }

      if (!code) {
        return res.redirect(`${OAuthService.FRONTEND_URL}?error=missing_code`);
      }

      const result = await OAuthService.handleDiscordCallback(code, state || '', clientIP, userAgent);
      
      logger.info('Discord OAuth success', { identifier: result.identifier });

      // Redirect to frontend with identifier
      const redirectUrl = `${result.redirect}${result.redirect.includes('?') ? '&' : '?'}identifier=${result.identifier}`;
      return res.redirect(redirectUrl);
    } catch (error) {
      logger.error('Discord callback error:', error);
      const errorMessage = error instanceof Error ? error.message : 'discord_auth_failed';
      return res.redirect(`${OAuthService.FRONTEND_URL}?error=${encodeURIComponent(errorMessage)}`);
    }
  };

  /**
   * Telegram OAuth - Redirect to Telegram Auth Page
   */
  telegramAuth = async (req, res) => {
    try {
      const { ref, redirect } = req.query;
      const authUrl = OAuthService.generateTelegramAuthUrl(ref || '');
      
      return res.redirect(authUrl);
    } catch (error) {
      logger.error('Telegram auth error:', error);
      return res.redirect(`${OAuthService.FRONTEND_URL}?error=telegram_auth_failed`);
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
        const isJsonRequest = req.headers.accept?.includes('application/json');
        if (isJsonRequest) {
          return res.status(400).json({
            success: false,
            error: 'Invalid Telegram authentication data',
          });
        }
        // Redirect for form submissions
        return res.redirect(`${OAuthService.FRONTEND_URL}?error=invalid_telegram_data`);
      }

      const result = await OAuthService.handleTelegramAuth(telegramData, clientIP, userAgent);
      
      logger.info('Telegram auth success', { identifier: result.identifier });

      let decodedState = {};
      try {
        if (state) {
          decodedState = JSON.parse(Buffer.from(state, 'base64').toString());
        }
      } catch (e) {
        // State parsing failed, use defaults
        logger.warn('Failed to decode Telegram state:', e);
      }

      // Redirect to frontend with identifier
      const redirect = decodedState.redirect || OAuthService.FRONTEND_URL || 'http://localhost:3000';
      const redirectUrl = `${redirect}${redirect.includes('?') ? '&' : '?'}identifier=${result.identifier}`;
      
      // Check if it's a JSON request (fetch API) or form submission
      const isJsonRequest = req.headers.accept?.includes('application/json');
      if (isJsonRequest) {
        // Return JSON for fetch API calls
        return res.json({
          success: true,
          identifier: result.identifier,
          redirect: redirectUrl,
        });
      }
      
      // Redirect for form submissions
      return res.redirect(redirectUrl);
    } catch (error) {
      logger.error('Telegram callback error:', error);
      const errorMessage = error instanceof Error ? error.message : 'telegram_auth_failed';
      
      const isJsonRequest = req.headers.accept?.includes('application/json');
      if (isJsonRequest) {
        return res.status(500).json({
          success: false,
          error: errorMessage,
        });
      }
      
      return res.redirect(`${OAuthService.FRONTEND_URL}?error=${encodeURIComponent(errorMessage)}`);
    }
  };
}

export default new OAuthController();

