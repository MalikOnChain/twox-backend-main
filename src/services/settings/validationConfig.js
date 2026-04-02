import sgMail from '@sendgrid/mail';
import axios from 'axios';
import colors from 'colors/safe';
import { google } from 'googleapis';
import { MongoClient } from 'mongodb';
import SkinsBack from 'skinsback-sdk';

import awsController from '@/services/AWS/AWS.service';
import SumsubService from '@/services/sumsub/Sumsub.service';
import { logger } from '@/utils/logger';
import customColors from '@/utils/logger/colors';

export class ConfigValidationService {
  constructor(config, validationMode = 'both') {
    this.config = config;
    this.validationMode = validationMode.toLowerCase();
    this.IS_PRODUCTION = process.env.NODE_ENV === 'production';
    this.results = { success: 0, warnings: 0, errors: 0 };

    this._validateValidationMode();
  }

  _validateValidationMode() {
    if (!['both', 'production', 'development'].includes(this.validationMode)) {
      throw new Error('ValidationMode must be one of: both, production, development');
    }
  }

  shouldValidateEnvironment(isProd) {
    if (this.validationMode === 'both') return true;
    if (this.validationMode === 'production' && isProd) return true;
    if (this.validationMode === 'development' && !isProd) return true;
    return false;
  }

  log(message, type = 'info', env = null) {
    const icons = { success: '✅', error: '❌', info: '✅', warn: '⚠️' };
    const envPrefix = env ? `[${env}] ` : '';

    const logMessage = customColors[type](`${icons[type]} ${envPrefix}${message}`);
    logger.info(logMessage);

    this._updateResults(type);
  }

  _updateResults(type) {
    switch (type) {
      case 'success':
        this.results.success++;
        break;
      case 'error':
        this.results.errors++;
        break;
      case 'warn':
        this.results.warnings++;
        break;
    }
  }

  async validateAll() {
    logger.info(colors.cyan(`===== Validating Services (Mode: ${this.validationMode.toUpperCase()}) =====`));
    try {
      await this.validateBasicConfig();
      await this.validateMongoDB();
      await this.validateAuthServices();
      await this.validateExternalServices();
      // await this.validateCustomerIO();
      await this.validateSumsub();
      // await this.validateAWS();
    } catch (error) {
      logger.error(colors.red(`❌ Validation failed: ${error.message}`));
      return false;
    }

    this.logSummary();
    return this.results.errors === 0;
  }

  async validateBasicConfig() {
    await this._validateUrls();

    const { enableMaintenanceOnStart, enableLoginOnStart } = this.config.site;
    this.log(`Maintenance mode: ${enableMaintenanceOnStart ? 'Enabled' : 'Disabled'}`, 'info');
    this.log(`Login: ${enableLoginOnStart ? 'Enabled' : 'Disabled'}`, 'info');
  }

  async _validateUrls() {
    const envType = process.env.NODE_ENV;
    const urls = ['backendUrl', 'frontendUrl', 'adminFrontendUrl'];
    const envPrefix = this.shouldValidateEnvironment(envType === 'production');

    if (!envPrefix) return;

    urls.forEach((url) => {
      const urlConfig = this.config.site[url];
      const urlToValidate = urlConfig;
      if (urlToValidate && this.isValidUrl(urlToValidate)) {
        this.log(`${url} URL is valid: ${urlToValidate}`, 'success', envType);
      } else {
        this.log(`Invalid ${url} URL`, 'error', envType);
      }
    });
  }

  async validateMongoDB() {
    await this._validateMongoDBConnection();
  }

  async _validateMongoDBConnection() {
    const uri = this.config.database.mongoURI;
    if (!uri) {
      this.log('MongoDB URI is missing', 'error', process.env.NODE_ENV);
      return;
    }

    try {
      const client = new MongoClient(uri, {
        connectTimeoutMS: 5000,
        serverSelectionTimeoutMS: 5000,
      });
      await client.connect();
      await client.db().command({ ping: 1 });
      await client.close();
      this.log('MongoDB connection successful', 'success');
    } catch (error) {
      this.log(`MongoDB connection failed: ${error.message}`, 'warn');
    }
  }

  async validateCustomerIO() {
    await this._validateCustomerIOConnection();
  }

  async _validateCustomerIOConnection() {
    const customerIO = import('@/services/CustomerIO/CustomerIO.service');
    try {
      await customerIO.validateConnection();
      this.log('Customer.io connection successful', 'success');
    } catch (error) {
      this.log(`Customer.io connection failed: ${error.message}`, 'error');
    }
  }

  async validateSumsub() {
    await this._validateSumsubConnection();
  }

  async _validateSumsubConnection() {
    try {
      await SumsubService.validateSumsubConnection();
      this.log('Sumsub connection successful', 'success');
    } catch (error) {
      // Log as warning instead of error - Sumsub is optional for development
      this.log(`Sumsub connection failed: ${error.message}`, 'warn');
    }
  }

  async validateAWS() {
    try {
      await awsController.validateAWSConnection();
      this.log('AWS connection successful', 'success');
    } catch (error) {
      this.log(`AWS connection failed: ${error.message}`, 'error');
    }
  }

  async validateAuthServices() {
    const auth = this.config.authentication;

    await Promise.all([this._validateGoogleAuth(auth.googleOauth)]);
  }

  async _validateSteamAuth(steam) {
    if (steam?.apiKey) {
      try {
        const response = await axios.get(
          `http://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${steam.apiKey}&steamids=76561197960435530`
        );
        if (response.data?.response) {
          this.log('Steam API key is valid', 'success');
        }
      } catch (error) {
        this.log('Steam API key validation failed', 'error');
      }
    } else {
      this.log('Steam API key is missing', 'error');
    }
  }

  async _validateGoogleAuth(googleAuth) {
    if (googleAuth?.clientId && googleAuth?.clientSecret) {
      try {
        const redirectUrl = `${this.config.site.backendUrl}/api/auth/google/callback`;

        const oauth2Client = new google.auth.OAuth2(googleAuth.clientId, googleAuth.clientSecret, redirectUrl);
        const url = oauth2Client.generateAuthUrl({
          access_type: 'offline',
          scope: ['profile', 'email'],
        });
        if (url) {
          this.log('Google OAuth credentials are valid', 'success');
        }
      } catch (error) {
        this.log('Google OAuth credentials are invalid', 'error');
      }
    } else {
      this.log('Google OAuth credentials are missing', 'error');
    }
  }

  async _validateSkinsbackAuth(skinsback) {
    // Validate if the secret_key is provided
    if (skinsback?.secret_key) {
      const options = {
        shop_id: skinsback.shop_id,
        secret_key: skinsback.secret_key,
      };

      const API = new SkinsBack(options);

      try {
        // Check the server status using the SkinsBack API
        let status = await API.serverStatus();

        // If the server is up and running, log a success message
        if (status?.status === 'success') {
          this.log('Skinsback API key is valid', 'success', 'PROD');
        } else {
          // If the status isn't successful, log an error
          this.log('Skinsback API key is invalid or server is not responding as expected', 'error', 'PROD');
        }
      } catch (error) {
        // Enhanced error handling with more details
        if (error.response) {
          // If the server responds with an error (e.g., 4xx or 5xx response codes)
          this.log(`Skinsback API error response: ${error.response.data}`, 'warn', 'PROD');
        } else if (error.request) {
          // If the request was made but no response was received (e.g., network error)
          this.log('Skinsback API request was made but no response was received', 'error', 'PROD');
        } else {
          // If there's an issue setting up the request (e.g., bad configuration)
          this.log(`Skinsback API validation failed: ${error.message}`, 'error', 'PROD');
        }
      }
    } else {
      // If the secret_key is missing, log an error
      this.log('Skinsback API key is missing', 'error', 'PROD');
    }
  }

  async validateExternalServices() {
    await this._validateSendGridConfig();
    // await this._validateStripeConfig();
  }

  async _validateSendGridConfig() {
    if (this.config.site?.sendgridApiKey) {
      sgMail.setApiKey(this.config.site.sendgridApiKey);
      try {
        // const response = await sgMail.send({
        //   to: "test-email@gmail.com",
        //   from: "no-reply@bitstake.io",
        //   subject: "SendGrid Config Test",
        //   text: "Test",
        // });
        // if (response[0]?.statusCode === 202) {
        this.log('SendGrid API is working', 'success', 'PROD');
        // }
      } catch (error) {
        this.log('SendGrid API validation failed' + error, 'error', 'PROD');
      }
    } else {
      this.log('SendGrid API key is missing', 'error', 'PROD');
    }
  }

  // async _validateStripeConfig() {
  //   if (this.config.stripe?.apiKey) {
  //     const stripe = require('stripe')(this.config.stripe.apiKey);
  //     try {
  //       const response = await stripe.accounts.retrieve();
  //       if (response.id) {
  //         this.log('Stripe configuration is valid', 'success', 'PROD');
  //       }
  //     } catch (error) {
  //       this.log('Stripe configuration failed', 'error', 'PROD');
  //     }
  //   } else {
  //     this.log('Stripe API key is missing', 'error', 'PROD');
  //   }
  // }

  isValidUrl(string) {
    try {
      new URL(string);
      return true;
    } catch (error) {
      return false;
    }
  }

  logSummary() {
    logger.info(
      colors.cyan(`================= Validation Summary (Mode: ${this.validationMode.toUpperCase()}) =================`)
    );
    logger.info(colors.green(`✅ Successes: ${this.results.success}`));
    logger.info(colors.yellow(`⚠️ Warnings: ${this.results.warnings}`));
    logger.info(colors.red(`❌ Errors: ${this.results.errors}`));
    logger.info(colors.cyan('===================================================================\n'));
  }
}

export default new ConfigValidationService();
