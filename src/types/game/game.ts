// Constants for the model
export enum TRANSACTION_TYPES {
  BET = 'BET',
  WIN = 'WIN',
  LOSE = 'LOSE',
  REFUND = 'REFUND',
}

export enum GAME_TRANSACTION_STATUS {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  LOSE = 'LOSE',
}

export enum GAME_CATEGORIES {
  SLOTS = 'Slots',
  LIVE_CASINO = 'Live Casino',
  MINES = 'Mines',
  ROULETTE = 'Roulette',
  CRASH = 'Crash',
  CASES = 'Cases',
  LIMBO = 'Limbo',
}
