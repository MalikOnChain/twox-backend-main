import Giphy from '@/models/external/GiphyCache';
import GiphyTrend from '@/models/external/GiphyTrend';
import { logger } from '@/utils/logger/index.js';

export class GiphyService {
  constructor() {
    this.apiKey = process.env.GIPHY_API_KEY;
    this.baseUrl = 'https://api.giphy.com/v1/gifs';

    // Bind the methods to maintain 'this' context
    this.searchGifs = this.searchGifs.bind(this);
    this.getRandomGif = this.getRandomGif.bind(this);
    this.getTrendingGifs = this.getTrendingGifs.bind(this);
    this.getGifById = this.getGifById.bind(this);
    this.getGifsByCategory = this.getGifsByCategory.bind(this);
    this.incrementGifUsage = this.incrementGifUsage.bind(this);
  }

  // Helper method to make API requests
  async makeGiphyRequest(url) {
    try {
      logger.info(`Making Giphy request to: ${url}`);

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Giphy API error: ${response.statusText}`);
      }
      const data = await response.json();

      return {
        success: true,
        data: data.data,
      };
    } catch (error) {
      console.error('Giphy request failed:', error);
      return {
        success: false,
        error: 'Failed to fetch GIF',
      };
    }
  }

  // Search GIFs with pagination
  async searchGifs(query, limit = 10, offset = 0) {
    try {
      const q = query.toLowerCase();
      limit = parseInt(limit);
      offset = parseInt(offset);

      // Return empty if offset or total requested amount exceeds 50
      if (offset >= 50 || offset + limit > 50) {
        return {
          success: true,
          data: [],
        };
      }

      // Check cache first
      const cachedResults = await Giphy.findCachedResults('search', q, Math.min(50, limit + offset));

      // If we have enough cached results including the offset
      if (cachedResults.length >= limit + offset) {
        return {
          success: true,
          data: cachedResults.slice(offset, offset + limit),
        };
      }

      // Calculate how many more items we need (ensuring we don't exceed 50 total)
      const giphyLimit = 50; // Respect Giphy's limit

      // Fetch from Giphy API
      const url = `${this.baseUrl}/search?api_key=${this.apiKey}&q=${encodeURIComponent(q)}&limit=${giphyLimit}&offset=${0}`;
      const result = await this.makeGiphyRequest(url);

      if (result.success) {
        // Cache new results
        const newGifs = await Promise.all(result.data.map((gif) => Giphy.cacheGiphyResponse(gif, 'search', q)));

        // Combine cached and new results
        const allGifs = [...cachedResults, ...newGifs];
        return {
          success: true,
          data: allGifs.slice(offset, offset + limit),
        };
      }

      return result;
    } catch (error) {
      logger.error(`Error searching for GIFs: ${error}`);
      throw error;
    }
  }

  // Get a random GIF with optional tag
  async getRandomGif(tag) {
    const url = `${this.baseUrl}/random?api_key=${this.apiKey}${tag ? `&tag=${encodeURIComponent(tag)}` : ''}`;
    return await this.makeGiphyRequest(url);
  }

  // Get trending GIFs with pagination
  async getTrendingGifs(limit = 10, offset = 0) {
    limit = parseInt(limit);
    offset = parseInt(offset);

    // Return empty if offset or total requested amount exceeds 50
    if (offset >= 50 || offset + limit > 50) {
      return {
        success: true,
        data: [],
      };
    }

    // Get popular GIFs from our database first
    const popularGifs = await GiphyTrend.getPopularGifs(50);
    const popularGifIds = new Set(popularGifs.map((g) => g.gifId));

    // Check cache first
    const cachedResults = await Giphy.findCachedResults('trending', null, Math.min(50, limit + offset));

    // If we have enough cached results including the offset
    if (cachedResults.length >= limit + offset) {
      // Combine popular GIFs with cached results
      const sortedResults = [
        ...popularGifs.map((pg) => cachedResults.find((cr) => cr.id === pg.gifId)).filter(Boolean),
        ...cachedResults.filter((cr) => !popularGifIds.has(cr.id)),
      ];

      return {
        success: true,
        data: sortedResults.slice(offset, offset + limit),
      };
    }

    // Fetch all 50 trending GIFs from Giphy API
    const giphyLimit = 50;
    const url = `${this.baseUrl}/trending?api_key=${this.apiKey}&limit=${giphyLimit}&offset=0`;
    const result = await this.makeGiphyRequest(url);

    if (result.success) {
      // Cache new results
      const newGifs = await Promise.all(result.data.map((gif) => Giphy.cacheGiphyResponse(gif, 'trending')));

      // Combine popular GIFs with new results
      const allGifs = [
        ...popularGifs.map((pg) => newGifs.find((ng) => ng.id === pg.gifId)).filter(Boolean),
        ...newGifs.filter((ng) => !popularGifIds.has(ng.id)),
      ];

      return {
        success: true,
        data: allGifs.slice(offset, offset + limit),
      };
    }

    return result;
  }

  // Get GIF by ID
  async getGifById(id) {
    if (!id) {
      throw new Error('GIF ID is required');
    }
    const gif = await Giphy.findById(id);
    if (!gif) {
      throw new Error('GIF not found');
    }
    return gif;
  }

  // Get GIFs by category with pagination
  async getGifsByCategory(category, limit = 10, offset = 0) {
    if (!category) {
      throw new Error('Category is required');
    }
    const url = `${this.baseUrl}/search?api_key=${this.apiKey}&q=${encodeURIComponent(category)}&limit=${limit}&offset=${offset}`;
    return await this.makeGiphyRequest(url);
  }

  async incrementGifUsage(gifId) {
    if (!gifId) {
      throw new Error('GIF ID is required');
    }
    await GiphyTrend.incrementUsage(gifId);
    return { success: true };
  }
}

export default new GiphyService();
