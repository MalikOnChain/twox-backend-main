import { Buffer } from 'buffer';

import axios from 'axios';

import config from '@/config';
import { logger } from '@/utils/logger';

class CustomerIO {
  constructor() {
    this.CUSTOMER_IO_AUTH = Buffer.from(`${config.customerio.siteId}:${config.customerio.apiKey}`).toString('base64');
  }

  async registerWithCustomerIO(userId, email, username) {
    const customerData = {
      email: email,
      created_at: Math.floor(Date.now() / 1000), // Convert to Unix timestamp (seconds)
      attributes: {
        username: username,
        email_subscription: true,
      },
    };

    try {
      await axios({
        method: 'put',
        url: `https://track.customer.io/api/v1/customers/${userId}`,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${this.CUSTOMER_IO_AUTH}`,
        },
        data: { ...customerData, id: userId.toString() },
      });
      logger.info(`User ${userId} registered with Customer.io successfully`);
    } catch (error) {
      logger.error('Customer.io registration failed:', error.response?.data || error.message);
      // Don't throw the error to prevent blocking the registration process
    }
  }

  async trackEvent(userId, eventName, data = {}) {
    try {
      await axios({
        method: 'post',
        url: `https://track.customer.io/api/v1/customers/${userId}/events`,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${this.CUSTOMER_IO_AUTH}`,
        },
        data: {
          name: eventName,
          data: data,
        },
      });
      logger.info(`Event ${eventName} tracked for user ${userId}`);
    } catch (error) {
      logger.error(`Failed to track event ${eventName}:`, error.response?.data || error.message);
    }
  }

  async updateCustomer(userId, attributes) {
    try {
      await axios({
        method: 'put',
        url: `https://track.customer.io/api/v1/customers/${userId}`,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${this.CUSTOMER_IO_AUTH}`,
        },
        data: { ...attributes, id: userId.toString() },
      });
      logger.info(`Customer ${userId} updated successfully`);
    } catch (error) {
      logger.error('Failed to update customer:', error.response?.data || error.message);
    }
  }

  async deleteCustomer(userId) {
    try {
      await axios({
        method: 'delete',
        url: `https://api.customer.io/v1/customers/${userId}`,
        headers: {
          Authorization: `Basic ${this.CUSTOMER_IO_AUTH}`,
        },
      });
      logger.info(`Customer ${userId} deleted successfully`);
    } catch (error) {
      logger.error('Failed to delete customer:', error.response?.data || error.message);
    }
  }

  async validateConnection() {
    // Use the ping endpoint instead of trying to fetch a customer
    await axios({
      method: 'get',
      url: 'https://track.customer.io/api/v1/accounts/ping',
      headers: {
        Authorization: `Basic ${this.CUSTOMER_IO_AUTH}`,
      },
    });
  }
}

const customerIO = new CustomerIO();

export default customerIO;
