import 'module-alias/register';
import cleanGameTransactions from '@/scripts/cleanDB.js';
import { createFakeUsers, deleteFakeUsers, updateFakeUsers } from '@/scripts/createFakeUsers.js';
import { main } from '@/scripts/initGameProviders.js';
import { initRecentWinsList } from '@/scripts/initRecentWinsList.js';
import { validateSlotGameImageUrl } from '@/scripts/validateSlotGameImageUrl.js';
import mongoDBServer from '@/servers/mongoDB-server.js';

/* eslint-disable */

const validTypes = [
  'bot-user',
  'vip-tiers',
  'game-providers',
  'recent-wins',
  'filter-slot-image',
  'update-bot-user',
  'clean-db',
];

const seed = async (type) => {
  try {
    await mongoDBServer.connect();
    switch (type) {
      case 'bot-user':
        await deleteFakeUsers();
        await createFakeUsers();
        break;
      case 'game-providers':
        await main();
        break;
      case 'recent-wins':
        await initRecentWinsList();
        break;
      case 'filter-slot-image':
        await validateSlotGameImageUrl();
        break;
      case 'update-bot-user':
        await updateFakeUsers();
        break;
      case 'clean-db':
        await cleanGameTransactions();
        break;
    }
    console.log('Done!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding:', error);
    throw error;
  } finally {
    await mongoDBServer.disconnect();
  }
};

// Get the type from command line arguments
const type = process.argv[2];

if (!type) {
  console.error(
    'Please provide a type: bot-user, vip-tiers, game-providers, filter-slot-image, recent-wins or update-bot-user'
  );
  console.error('Usage: node seed.js <type>');
  // eslint-disable-next-line no-process-exit
  process.exit(1);
}

if (!validTypes.includes(type)) {
  console.error(`Invalid type. Please use one of: ${validTypes.join(', ')}`);
  // eslint-disable-next-line no-process-exit
  process.exit(1);
}

seed(type).catch(console.error);

export { seed, validTypes };
