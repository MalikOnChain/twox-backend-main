import express from 'express';

import sessionManager from '../utils/session/session-manager';

const router = express.Router();

router.get('/stats', (req, res) => {
  const stats = sessionManager.getDiagnostics();
  res.json(stats);
});

export default router;
