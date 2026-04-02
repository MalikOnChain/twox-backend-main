// import mongoose from 'mongoose';

// import WagerRace from '../models/v2/wagerRace/WagerRace';
// import WagerRaceService from '../services/WagerRaceService';
// import { logger } from '../utils/logger';

// // async function testWagerRace() {
// //   try {
// //     // Connect to MongoDB
// //     await mongoose.connect(process.env.MONGODB_URI, {
// //       useNewUrlParser: true,
// //       useUnifiedTopology: true,
// //     });

// //     // Create wager race from mock data
// //     const mockData = import('../mocks/wagerRace.json');

// //     const wagerRace = new WagerRace(mockData);
// //     await wagerRace.save();

// //     logger.info('Created test wager race:', wagerRace._id);

// //     // Get WagerRaceService instance
// //     const wagerRaceService = WagerRaceService.getInstance();

// //     // Simulate some wagers
// //     const testWagers = [
// //       { userId: '65f9a1b2c3d4e5f6g7h8i9j0', amount: 1000 },
// //       { userId: '65f9a1b2c3d4e5f6g7h8i9j1', amount: 800 },
// //       { userId: '65f9a1b2c3d4e5f6g7h8i9j2', amount: 600 },
// //     ];

// //     // Update wager amounts
// //     for (const wager of testWagers) {
// //       await wagerRaceService.updateTotalWageredAmount(wager.userId, wager.amount);
// //       logger.info(`Updated wager amount for user ${wager.userId}: ${wager.amount}`);
// //     }

// //     // Get ranking data
// //     const rankingData = await wagerRaceService.getRankingDataByWagerRaceId(testWagers[0].userId, wagerRace._id);
// //     logger.info('Current ranking:', rankingData);

// //     // Wait for race to end (in real scenario, this would be handled by the cron job)
// //     logger.info('Waiting for race to end...');
// //     await new Promise((resolve) => setTimeout(resolve, 10 * 60 * 1000)); // 10 minutes

// //     // Check and update race status
// //     await wagerRaceService.checkWagerRace();
// //     logger.info('Race status updated');

// //     // Get final ranking
// //     const finalRanking = await wagerRaceService.getRankingDataByWagerRaceId(testWagers[0].userId, wagerRace._id);
// //     logger.info('Final ranking:', finalRanking);
// //   } catch (error) {
// //     logger.error('Error in test:', error);
// //   } finally {
// //     await mongoose.disconnect();
// //   }
// // }

// // Run the test
// testWagerRace();
