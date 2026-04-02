import mongoose from 'mongoose';
import config from '@/config/index';
import { logger } from '@/utils/logger';
import BlueOceanWalletTransaction from '@/models/slotGames/blueocean/BlueOceanWalletTransaction';
import BlueOceanGame from '@/models/slotGames/blueocean/BlueOceanGames';
import User from '@/models/users/User';

/**
 * Seed sample BlueOcean wallet transactions for testing
 */
async function seedTransactions() {
  try {
    // Connect to database
    await mongoose.connect(config.database.mongoURI);
    logger.info('Connected to MongoDB');

    // Get some real users and games from the database
    const users = await User.find({}).limit(10).lean();
    const games = await BlueOceanGame.find({ status: 'active', isEnabled: true }).limit(20).lean();

    if (users.length === 0) {
      logger.error('No users found in database. Please create users first.');
      process.exit(1);
    }

    if (games.length === 0) {
      logger.error('No games found in database. Please sync BlueOcean games first.');
      process.exit(1);
    }

    logger.info(`Found ${users.length} users and ${games.length} games`);

    // Clear existing test transactions (optional)
    const deleteResult = await BlueOceanWalletTransaction.deleteMany({
      remote_id: { $in: users.map(u => u._id.toString()) }
    });
    logger.info(`Deleted ${deleteResult.deletedCount} existing test transactions`);

    // Generate sample transactions
    const transactions = [];
    const sessionIds = [];

    // Create 10 game sessions with bet-win pairs
    for (let i = 0; i < 10; i++) {
      const user = users[i % users.length];
      const game = games[i % games.length];
      const sessionId = `session_${Date.now()}_${i}`;
      sessionIds.push(sessionId);

      // Random bet amount between $5 and $1000
      const betAmount = Math.floor(Math.random() * 995) + 5;
      
      // Random multiplier between 0.1x and 50x
      const multiplier = parseFloat((Math.random() * 49.9 + 0.1).toFixed(2));
      
      // Calculate win amount
      const winAmount = parseFloat((betAmount * multiplier).toFixed(2));
      
      // User's balance (assuming they had enough to bet)
      const balanceBefore = betAmount + Math.floor(Math.random() * 1000);
      const balanceAfterBet = balanceBefore - betAmount;
      const balanceAfterWin = balanceAfterBet + winAmount;

      const now = new Date();
      const betTime = new Date(now.getTime() - Math.random() * 24 * 60 * 60 * 1000); // Random time in last 24h
      const winTime = new Date(betTime.getTime() + Math.random() * 60000); // Win 0-60s after bet

      // Debit transaction (bet)
      transactions.push({
        remote_id: user._id.toString(),
        session_id: sessionId,
        transaction_id: `txn_bet_${Date.now()}_${i}`,
        action: 'debit',
        amount: betAmount,
        balance_before: balanceBefore,
        balance_after: balanceAfterBet,
        status: 'completed',
        user_id: user._id,
        game_id: game.gameId,
        created_at: betTime,
        updated_at: betTime,
      });

      // Credit transaction (win) - only if multiplier > 0
      if (winAmount > 0) {
        transactions.push({
          remote_id: user._id.toString(),
          session_id: sessionId,
          transaction_id: `txn_win_${Date.now()}_${i}`,
          action: 'credit',
          amount: winAmount,
          balance_before: balanceAfterBet,
          balance_after: balanceAfterWin,
          status: 'completed',
          user_id: user._id,
          game_id: game.gameId,
          created_at: winTime,
          updated_at: winTime,
        });
      }
    }

    // Insert all transactions
    const insertedTransactions = await BlueOceanWalletTransaction.insertMany(transactions);
    logger.info(`✅ Successfully inserted ${insertedTransactions.length} sample transactions`);

    // Display summary
    console.log('\n=== Sample Transactions Summary ===');
    console.log(`Total Sessions: 10`);
    console.log(`Total Transactions: ${insertedTransactions.length}`);
    console.log(`Users involved: ${new Set(transactions.map(t => t.remote_id)).size}`);
    console.log(`Games played: ${new Set(transactions.map(t => t.game_id)).size}`);
    
    // Show some sample data
    console.log('\n=== Sample Winners ===');
    const winTransactions = transactions.filter(t => t.action === 'credit').slice(0, 5);
    for (const win of winTransactions) {
      const user = users.find(u => u._id.toString() === win.remote_id);
      const game = games.find(g => g.gameId === win.game_id);
      const bet = transactions.find(t => t.session_id === win.session_id && t.action === 'debit');
      
      console.log(`\n${user?.username} won $${win.amount.toFixed(2)}`);
      console.log(`  Game: ${game?.name || 'Unknown'}`);
      console.log(`  Bet: $${bet?.amount.toFixed(2) || 0}`);
      console.log(`  Multiplier: ${bet ? (win.amount / bet.amount).toFixed(2) : 0}x`);
      console.log(`  Session: ${win.session_id}`);
    }

    console.log('\n✅ Seed completed successfully!');
    console.log('You can now test the Latest Winners and Game Rank Table on the frontend.\n');

  } catch (error) {
    logger.error('Failed to seed transactions:', error);
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    logger.info('Disconnected from MongoDB');
  }
}

// Run the seed function
seedTransactions();

