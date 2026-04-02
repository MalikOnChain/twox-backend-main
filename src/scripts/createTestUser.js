import 'module-alias/register';
import mongoDBServer from '@/servers/mongoDB-server.js';
import User from '@/models/users/User.js';
import { createNewUser } from '@/utils/helpers/auth.js';
import { logger } from '@/utils/logger';

const createTestUser = async () => {
  try {
    // Connect to MongoDB
    await mongoDBServer.connect();
    logger.info('Connected to MongoDB');

    // User data
    const email = 'malic@twox.gg';
    const passwordHash = '$2a$10$0fyFCW0rbf2C3U9vQm0NAeyfvPzuY1I6WEyIR9/RTN0N59Bo348uK';
    
    // Generate username from email (take part before @)
    const username = email.split('@')[0];

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [
        { email: email.toLowerCase() },
        { username: username }
      ]
    });

    if (existingUser) {
      logger.warn(`User already exists with email: ${email} or username: ${username}`);
      logger.info(`Existing user ID: ${existingUser._id}`);
      await mongoDBServer.disconnect();
      process.exit(0);
    }

    // Create user using the helper function
    const newUser = await createNewUser({
      email: email.toLowerCase(),
      username: username,
      password: passwordHash,
      role: 'user',
      isEmailVerified: true, // Set to true for test user
    });

    logger.info('✅ Test user created successfully!');
    logger.info(`User ID: ${newUser._id}`);
    logger.info(`Email: ${newUser.email}`);
    logger.info(`Username: ${newUser.username}`);
    logger.info(`Role: ${newUser.role}`);

    await mongoDBServer.disconnect();
    process.exit(0);
  } catch (error) {
    logger.error('❌ Error creating test user:', error);
    await mongoDBServer.disconnect();
    process.exit(1);
  }
};

createTestUser();



