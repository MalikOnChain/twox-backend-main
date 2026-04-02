import '@/config/load-env';
import mongoose from 'mongoose';

import NexusGGRService from '@/services/casino/Nexusggr/Nexusggr.service';

import mongoDBServer from '../servers/mongoDB-server';
import { logger } from '../utils/logger';

async function dropCollections() {
  try {
    logger.debug('Dropping existing collections...');

    // Drop GameProviders collection if exists
    const gameProvidersExists = await mongoose.connection.db.listCollections({ name: 'gameproviders' }).hasNext();
    if (gameProvidersExists) {
      await mongoose.connection.db.dropCollection('gameproviders');
      logger.debug('gameproviders collection dropped successfully');
    } else {
      logger.debug('gameproviders collection does not exist');
    }

    // Drop GameList collection if exists
    const gameListExists = await mongoose.connection.db.listCollections({ name: 'gamelists' }).hasNext();
    if (gameListExists) {
      await mongoose.connection.db.dropCollection('gamelists');
      logger.debug('gamelists collection dropped successfully');
    } else {
      logger.debug('gamelists collection does not exist');
    }

    logger.debug('Collections drop completed');
  } catch (error) {
    console.error('Error dropping collections:', error);
    throw error;
  }
}

export async function main() {
  try {
    await mongoDBServer.connect();
    logger.debug('Connected to MongoDB');

    // Drop existing collections
    await dropCollections();

    // Run the initialization
    logger.debug('Starting game provider initialization...');
    await NexusGGRService.initGameProviders();
    logger.debug('Game provider initialization completed successfully');
  } catch (error) {
    console.error('Initialization failed:', error);
    // eslint-disable-next-line no-process-exit
  } finally {
    // Close MongoDB connection
    await mongoose.connection.close();
    logger.debug('MongoDB connection closed');
    // eslint-disable-next-line no-process-exit
    process.exit(0);
  }
}
