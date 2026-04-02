import config from '../config';

export const checkTestMode = (req, res, next) => {
  if (config.testMode && req.headers['x-test-mode'] === 'true') {
    req.isTestMode = true;
  }

  next();
};

export default checkTestMode;
