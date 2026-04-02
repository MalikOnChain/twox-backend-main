// Application Main Config
import './load-env.ts';
import './global-variable';

const corsExtraOrigins = (process.env.CORS_ALLOWED_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:4000',
  'http://localhost:9000',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:9000',
  process.env.FRONTEND_URL,
  process.env.ADMIN_PANEL_FRONTEND_URL,
  'https://twox.gg',
  'https://www.twox.gg',
  'https://tuabet.bet',
  'https://staging.tuabet.bet',
  'https://api.admin.tuabet.bet',
  ...corsExtraOrigins,
].filter(Boolean); // Remove undefined values

function isVercelAppOrigin(origin: string): boolean {
  try {
    const u = new URL(origin);
    return u.protocol === 'https:' && u.hostname.endsWith('.vercel.app');
  } catch {
    return false;
  }
}

const allowVercelPreviewCors =
  process.env.ALLOW_VERCEL_PREVIEW_CORS === '1' ||
  process.env.ALLOW_VERCEL_PREVIEW_CORS === 'true';

const config = {
  testMode: true,
  cors: {
    origin: (origin: any, callback: any) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) {
        return callback(null, true);
      }

      // Check if origin is in allowed list
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      if (allowVercelPreviewCors && isVercelAppOrigin(origin)) {
        return callback(null, true);
      }

      // Log for debugging
      console.log('CORS blocked origin:', origin);
      console.log('Allowed origins:', allowedOrigins);

      callback(new Error('Not allowed by CORS')); // Reject the origin
    },
    exposedHeaders: ['x-auth-token', 'x-test-mode', 'x-referral-code', 'x-utm-campaign', 'x-signature'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'Origin',
      'x-auth-token',
      'timezone',
      'x-referral-code',
    ],
  },
  site: {
    // Site configurations on server startup
    enableMaintenanceOnStart: false,
    manualWithdrawsEnabled: true,
    enableLoginOnStart: true,
    sendgridApiKey: process.env.SENDGRID_API_KEY,
    backendUrl: process.env.BACKEND_URL,
    frontendUrl: process.env.FRONTEND_URL,
    adminFrontendUrl: process.env.ADMIN_PANEL_FRONTEND_URL,
  },
  database: {
    mongoURI: process.env.MONGO_URI,
  },
  gameTokenRate: 1,
  games: {
    crash: {
      minBetAmount: 0.1, // Min bet amount (in coins)
      maxBetAmount: 100000, // Max bet amount (in coins)
      minCashout: 101,
      maxCashout: 15000,
      maxProfit: 10000000000, // Max profit on crash, forces auto cashout
      houseEdge: 0.08, // House edge percentage
    },
  },
  authentication: {
    jwtSecret: process.env.JWT_SECRET, // Secret used to sign JWT's. KEEP THIS AS A SECRET 45 length
    jwtExpirationTime: '1h', // JWT-token expiration time (in seconds)
    refreshTokenSecret: 'FqjEY2GjciChkXvf4Boy2WT1hkXv2vf4Boy2WT1bVgphx', // Separate secret for refresh tokens
    refreshTokenExpirationTime: '1d', // Refresh token expires in 1 da
    skinsback: {
      shop_id: process.env.SKINSBACK_SHOP_ID,
      secret_key: process.env.SKINSBACK_SECRET_KEY,
      withdrawFee: 15, // withdraw fee, make items more expensive than they are
      withdrawMinItemPrice: 0.55, // minimum item price for withdraw items
    },
    reCaptcha: {
      secretKey: process.env.RECAPTCHA_SECRET_KEY,
    },
    googleOauth: {
      clientId: process.env.GOOGLE_OAUTH_CLIENT_ID,
      clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    },
    discordOauth: {
      clientId: process.env.DISCORD_OAUTH_CLIENT_ID,
      clientSecret: process.env.DISCORD_OAUTH_CLIENT_SECRET,
    },
    telegramOauth: {
      botToken: process.env.TELEGRAM_BOT_TOKEN,
      botUsername: process.env.TELEGRAM_BOT_USERNAME,
    },
    steam: {
      apiKey: process.env.STEAM_API_KEY,
    },
    sharedToken: process.env.SHARED_SECRET,
  },
  customerio: {
    siteId: process.env.CUSTOMERIO_SITE_ID,
    apiKey: process.env.CUSTOMERIO_API_KEY,
  },
  nexusggr: {
    enable: true,
    api_url: process.env.NEXUSGGR_API_URL,
    token: process.env.NEXUSGGR_AGENT_TOKEN,
    agent_code: process.env.NEXUSGGR_AGENT_CODE,
    // DEMO
    demo_api_url: process.env.NEXUSGGR_DEMO_API_URL,
    demo_token: process.env.NEXUSGGR_DEMO_AGENT_TOKEN,
    demo_agent_code: process.env.NEXUSGGR_DEMO_AGENT_CODE,
    demo_user_balance: 500,
  },
  blueocean: {
    enable: true,
    api_url: (process.env.BLUEOCEAN_API_URL || 'https://stage.game-program.com/api/seamless/provider')
      .trim()
      .replace(/\?+$/, ''),
    username: process.env.BLUEOCEAN_API_USERNAME,
    password: process.env.BLUEOCEAN_API_PASSWORD,
    salt_key: process.env.BLUEOCEAN_SALT_KEY,
  },
  socketNamespaces: {
    PUBLIC: {
      STATUS: '/',
      APP: '/app',
      BET_HISTORY: '/bet-history',
      CRASH: '/crash',
      ROULETTE: '/roulette',
      COINFLIP: '/coinflip',
      JACKPOT: '/jackpot',
      BATTLES: '/battles',
      MINE: '/mine',
      LIMBO: '/limbo',
      CHAT: '/chat',
      NOTIFICATION: '/notification',
    },
    PRIVATE: {
      PRICE: '/price',
      AUTH: '/auth',
      USER: '/user',
      TRIVIA: '/trivia',
      TRANSACTION: '/transaction',
    },
  },
  statusSocket: {
    healthCheckInterval: 3000,
    statusUpdateInterval: 3000,
    activeUsersInterval: 3000,
  },
};

export default config;
