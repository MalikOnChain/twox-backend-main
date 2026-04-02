/**
 * Middleware to bypass ngrok browser warning page
 * For OAuth callbacks, we need to handle the redirect properly since ngrok shows warning before our backend
 */
export const ngrokSkipWarning = (req, res, next) => {
  // Check if request is coming through ngrok
  const isNgrok = req.headers.host?.includes('ngrok') || 
                  req.headers['x-forwarded-host']?.includes('ngrok') ||
                  req.get('host')?.includes('ngrok');

  // Check if this is an OAuth callback route
  const isOAuthCallback = req.path.includes('/callback');

  if (isNgrok && isOAuthCallback) {
    // For OAuth callbacks, set header to skip ngrok warning
    // Note: This only works if ngrok is configured to forward headers
    req.headers['ngrok-skip-browser-warning'] = 'true';
    res.setHeader('ngrok-skip-browser-warning', 'true');
  }

  next();
};

export default ngrokSkipWarning;

