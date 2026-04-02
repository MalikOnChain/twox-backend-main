import http from 'http';
import https from 'https';
import { URL } from 'url';

import GameList from '@/models/slotGames/nexusggr/NexusggrGames';
import { logger } from '@/utils/logger';

export async function validateSlotGameImageUrl() {
  const games = await GameList.find().lean();

  for (const game of games) {
    const isValid = await checkImageUrl(game.banner);
    if (!isValid) {
      await GameList.updateOne({ _id: game._id }, { $set: { status: 0 } });
    }
  }

  logger.info('All have done!');
  process.exit(0);
}

async function checkImageUrl(url) {
  return new Promise((resolve) => {
    try {
      const parsedUrl = new URL(url);
      const client = parsedUrl.protocol === 'https:' ? https : http;

      const req = client.request(
        url,
        { method: 'HEAD' }, // HEAD = faster, we only check headers
        (res) => {
          const isImage = res.headers['content-type']?.startsWith('image/');
          resolve(res.statusCode === 200 && isImage);
        }
      );

      req.on('error', () => resolve(false));
      req.end();
    } catch (error) {
      resolve(false);
    }
  });
}
