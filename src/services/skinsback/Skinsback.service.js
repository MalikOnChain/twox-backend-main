import skinsbackSdk from 'skinsback-sdk';

import config from '@/config';
import { TRANSACTION_TYPE, TRANSACTION_STATUS } from '@/controllers/TransactionControllers/BaseTransactionManager';
import { SkinsbackTransactionHandler } from '@/controllers/TransactionControllers/SkinsbackTransactionManager';
import { logger } from '@/utils/logger';

export class SkinsbackService {
  constructor() {
    // const options = {
    //   shop_id: config.authentication.skinsback.shop_id,
    //   secret_key: config.authentication.skinsback.secret_key,
    // };
    this.api = skinsbackSdk;
  }

  async createOrder(user_id) {
    const transactionHandler = new SkinsbackTransactionHandler();
    const { skinsbackTransaction } = await transactionHandler.startTransaction(user_id, {
      type: TRANSACTION_TYPE.DEPOSIT,
      status: TRANSACTION_STATUS.PENDING,
    });
    const data = await this.api.createOrder(skinsbackTransaction.id);
    return { url: data.url };
  }

  async getServerStatus() {
    const status = await this.api.serverStatus();
    return status;
  }

  /**
   * Get available items for a specific game with pagination
   * @param {string} gameType - The game type (csgo, rust, dota2)
   * @param {number} offset - Number of items to skip (pagination)
   * @param {number} limit - Maximum number of items to return (pagination, use 0 to get all items)
   * @returns {Promise<Object>} - Paginated list of game items and total count
   */
  async getGameItems(gameType, offset = 0, limit = 10) {
    try {
      // Normalize game type to lowercase for API consistency
      const game = gameType.toLowerCase();

      // Validate game type
      if (!['csgo', 'rust', 'dota2'].includes(game)) {
        throw new Error(`Invalid game type: ${gameType}`);
      }

      // Get market price list from API
      const response = await this.api.getMarketPriceList(game);

      // Filter items based on availability and minimum price
      const allItems = response.items
        .filter((item) => {
          return item.count > 0 && item.price > config.authentication.skinsback.withdrawMinItemPrice;
        })
        .map((item) => {
          // Calculate commission for items in withdraw
          const WITHDRAW_COMMISSION = config.authentication.skinsback.withdrawCommission || 5; // Default to 5% if not specified
          const price = parseFloat(parseFloat(item.price + item.price * (WITHDRAW_COMMISSION / 100)).toFixed(2));

          // Format image URL based on game type
          let imageUrl;
          switch (game) {
            case 'dota2':
              imageUrl = `https://steamcommunity-a.akamaihd.net/economy/image/class/570/${item.classid}/300fx300f`;
              break;
            case 'csgo':
              imageUrl = `https://steamcommunity-a.akamaihd.net/economy/image/class/730/${item.classid}/300fx300f`;
              break;
            case 'rust':
              imageUrl = item.image;
              break;
            default:
              imageUrl = null;
          }

          return {
            ...item,
            image: imageUrl,
            price: price,
          };
        });

      // Apply pagination
      const totalItems = allItems.length;
      // If limit is 0, return all items without pagination
      const paginatedItems = limit === 0 ? allItems : allItems.slice(offset, offset + limit);

      // Log info about loaded items
      if (typeof logger !== 'undefined') {
        logger.info(
          `[SKINSBACK SHOP] Loaded ${paginatedItems.length} of ${totalItems} ${game.toUpperCase()} items from the API (offset: ${offset}, limit: ${limit}).`
        );
      } else {
        logger.info(
          `[SKINSBACK SHOP] Loaded ${paginatedItems.length} of ${totalItems} ${game.toUpperCase()} items from the API (offset: ${offset}, limit: ${limit}).`
        );
      }

      // Return paginated results with metadata
      return {
        items: paginatedItems,
        pagination: {
          total: totalItems,
          offset,
          limit: limit === 0 ? totalItems : limit,
          currentPage: limit === 0 ? 1 : Math.floor(offset / limit) + 1,
          totalPages: limit === 0 ? 1 : Math.ceil(totalItems / limit),
          hasMore: totalItems > Number(offset) + Number(limit),
        },
      };
    } catch (error) {
      console.error(`Error fetching ${gameType} market items:`, error);
      throw error;
    }
  }
}

export default new SkinsbackService();
