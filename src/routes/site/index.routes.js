// Require Dependencies
import express from 'express';
import VipUser from '@/models/vip/VipUser';
import sessionManager from '@/utils/session/session-manager';

class SiteRouter {
  constructor() {
    this.router = express.Router();
    this.initializeRoutes();
  }

  initializeRoutes() {
    this.router.get('/', this.getSiteInfo.bind(this));
    this.router.get('/stats', this.getSiteStats.bind(this));
  }

  async getSiteInfo(req, res) {
    const launchDate = new Date('2020-07-05T19:00:00');

    return res.json({
      launchDate: launchDate.toISOString(),
      launched: Date.now() > launchDate.getTime(),
    });
  }

  async getSiteStats(req, res) {
    try {
      // Get total wagered amount from all VIP users
      const result = await VipUser.aggregate([
        {
          $group: {
            _id: null,
            totalWagered: { $sum: '$totalWagered' }
          }
        }
      ]);

      const totalWagered = result.length > 0 ? result[0].totalWagered : 0;

      // Get online users count from session manager
      const onlineUsers = sessionManager.getActiveUserCount();

      return res.json({
        success: true,
        data: {
          totalWagered: Math.round(totalWagered * 100) / 100, // Round to 2 decimal places
          onlineUsers,
        },
      });
    } catch (error) {
      console.error('Failed to fetch site stats:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch site statistics',
        data: {
          totalWagered: 0,
          onlineUsers: 0,
        },
      });
    }
  }

  getRouter() {
    return this.router;
  }
}

// Create and export the router instance
const siteRouter = new SiteRouter();
export default siteRouter.getRouter();
