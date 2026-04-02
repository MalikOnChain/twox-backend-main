import GiphyService from '@/services/Giphy/Giphy.service';

class GiphyController {
  // Route handler functions
  async searchGifs(req, res) {
    try {
      const { q, limit, offset } = req.query;
      const result = await GiphyService.searchGifs(q, limit, offset);
      res.json(result);
    } catch (error) {
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  async getTrendingGifs(req, res) {
    try {
      const { limit, offset } = req.query;
      const result = await GiphyService.getTrendingGifs(limit, offset);
      res.json(result);
    } catch (error) {
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  async getRandomGif(req, res) {
    try {
      const { tag } = req.query;
      const result = await GiphyService.getRandomGif(tag);
      res.json(result);
    } catch (error) {
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  async getGifsByCategory(req, res) {
    try {
      const { category } = req.params;
      const { limit, offset } = req.query;
      const result = await GiphyService.getGifsByCategory(category, limit, offset);
      res.json(result);
    } catch (error) {
      res.status(500).json({ success: false, error: 'Internal server error', result: null });
    }
  }

  async getGifById(req, res) {
    try {
      const { id } = req.params;
      const result = await GiphyService.getGifById(id);
      res.json({ data: result, success: true });
    } catch (error) {
      res.status(200).json({ success: false, error: `${error}` });
    }
  }

  async incrementGifUsage(req, res) {
    try {
      const { gifId } = req.params;
      const result = await GiphyService.incrementGifUsage(gifId);
      res.json(result);
    } catch (error) {
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
}

export default new GiphyController();
