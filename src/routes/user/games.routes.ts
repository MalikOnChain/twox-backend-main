import express from 'express';

import UserGamesController from '@/controllers/UserGamesController/UserGames.controller';
import { requireAuth } from '@/middleware/auth';

class UserGamesRouter {
  public router: express.Router;

  constructor() {
    this.router = express.Router();
    this.initializeRoutes();
  }

  private initializeRoutes() {
    // Favorites routes
    this.router.post('/favorites/add', requireAuth, UserGamesController.addFavorite);
    this.router.post('/favorites/remove', requireAuth, UserGamesController.removeFavorite);
    this.router.get('/favorites', requireAuth, UserGamesController.getFavorites);

    // Recent games routes
    this.router.post('/recent/add', requireAuth, UserGamesController.addRecentGame);
    this.router.get('/recent', requireAuth, UserGamesController.getRecentGames);
  }
}

export default new UserGamesRouter().router;

