// utils/icons.js

export const ICONS = {
  // Server Status
  STARTUP: '🚀',
  SHUTDOWN: '🔴',
  MAINTENANCE: '🔧',
  OPERATIONAL: '🟢',

  // Core Components
  SERVER: '⚡',
  DATABASE: '🗃️',
  CACHE: '⚡',
  QUEUE: '📦',

  // Routes & API
  ROUTES: '🌐',
  API: '🚀',
  WEBSOCKET: '🔌',
  HTTP: '🌐',

  // Authentication & Security
  AUTH: '🔐',
  SECURITY: '🔒',
  ENCRYPTION: '🔏',
  TOKEN: '🎟️',

  // Features & Games
  GAMES: '🎮',
  FEATURES: '✨',
  CHAT: '💭',
  ANALYSIS: '📊',
  VIP: '👑',
  RACE: '🏁',

  // Game Types
  COINFLIP: '🪙',
  JACKPOT: '🎰',
  ROULETTE: '🎲',
  CRASH: '📈',
  BATTLES: '⚔️',
  LIMBO: '🎯',
  MINE: '💎',
  CASE: '📦',

  // Financial
  CASHIER: '💰',
  TRANSACTION: '💸',
  DEPOSIT: '⬇️',
  WITHDRAW: '⬆️',
  COUPON: '🎫',
  CRYPTO: '₿',

  // Monitoring & Logging
  LOG: '📝',
  ERROR: '💥',
  WARNING: '⚠️',
  INFO: '✨',
  DEBUG: '🔍',
  PERFORMANCE: '⚡',
  METRIC: '📊',

  // Rate Limiting
  RATE_LIMIT: '⏱️',
  BLOCKED: '🚫',
  ALLOWED: '✅',

  // User Related
  USER: '👤',
  ADMIN: '👨‍💼',
  MOD: '👮',

  // External Services
  EXTERNAL: '🌐',
  CALLBACK: '📞',
  WEBHOOK: '🪝',

  // File Operations
  FILE: '📄',
  IMAGE: '🖼️',
  UPLOAD: '📤',
  DOWNLOAD: '📥',

  // Time Related
  TIME: '⏰',
  SCHEDULE: '📅',
  DURATION: '⏱️',

  // Status & Results
  SUCCESS: '✅',
  FAIL: '❌',
  PENDING: '⏳',
  PROCESSING: '⚙️',
  COMPLETED: '🏁',

  // Notifications
  NOTIFICATION: '🔔',
  EMAIL: '📧',
  ALERT: '🚨',

  // Social & Communication
  CHAT_MESSAGE: '💬',
  ANNOUNCEMENT: '📢',
  SUPPORT: '🎧',

  // Development
  DEV: '👨‍💻',
  TEST: '🧪',
  BUILD: '🔨',
  DEBUG_MODE: '🐛',

  // System Resources
  CPU: '🔲',
  MEMORY: '💾',
  NETWORK: '🌐',
  STORAGE: '💿',
};

// Function to get icon with fallback
export const getIcon = (key, fallback = '📝') => {
  return ICONS[key] || fallback;
};

// Function to format message with icon
export const withIcon = (key, message, fallback = '📝') => {
  const icon = getIcon(key, fallback);
  return `${icon} ${message}`;
};
