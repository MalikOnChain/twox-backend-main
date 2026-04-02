import express from 'express';

import GiphyController from '@/controllers/Giphy/Giphy.controller';

class GiphyRouter {
  constructor() {
    this.router = express.Router();
    this.initializeRoutes();
  }

  initializeRoutes() {
    // Search and trending routes
    this.router.get('/search', GiphyController.searchGifs);
    this.router.get('/trending', GiphyController.getTrendingGifs);
    this.router.get('/random', GiphyController.getRandomGif);

    // Category and specific GIF routes
    this.router.get('/category/:category', GiphyController.getGifsByCategory);
    this.router.get('/:id', GiphyController.getGifById);

    // Usage tracking
    this.router.post('/:gifId/increment', GiphyController.incrementGifUsage);
  }

  getRouter() {
    return this.router;
  }
}

// Create and export the router instance
const giphyRouter = new GiphyRouter();
export default giphyRouter.getRouter();
