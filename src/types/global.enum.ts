export enum VAULTODY_TX_EVENTS {
  TRANSACTION_REQUEST = 'TRANSACTION_REQUEST',
  TRANSACTION_APPROVED = 'TRANSACTION_APPROVED',
  TRANSACTION_REJECTED = 'TRANSACTION_REJECTED',
  INCOMING_CONFIRMED_COIN_TX = 'INCOMING_CONFIRMED_COIN_TX',
  INCOMING_CONFIRMED_TOKEN_TX = 'INCOMING_CONFIRMED_TOKEN_TX',
  INCOMING_CONFIRMED_INTERNAL_TX = 'INCOMING_CONFIRMED_INTERNAL_TX',
  INCOMING_MINED_TX = 'INCOMING_MINED_TX',
  OUTGOING_FAILED = 'OUTGOING_FAILED',
  OUTGOING_MINED = 'OUTGOING_MINED',
  TRANSACTION_BROADCASTED = 'TRANSACTION_BROADCASTED',
}

export enum GameCategory {
  ROULETTE = 'roulette',
  ROCKET_ROYALE = 'rocket-royale',
  SLOT_MACHINE = 'slot-machine',
}

export enum DEV_NETWORKS {
  bitcoin = 'testnet',
  litecoin = 'testnet',
  dogecoin = 'testnet',
  ethereum = 'sepolia',
  xrp = 'testnet',
  'binance-smart-chain' = 'testnet',
  tron = 'nile',
  polygon = 'amoy',
  avalanche = 'fuji',
  arbitrum = 'sepolia',
  solana = 'devnet',
  optimism = 'sepolia',
}

export enum PROD_NETWORKS {
  bitcoin = 'mainnet',
  litecoin = 'mainnet',
  dogecoin = 'mainnet',
  ethereum = 'mainnet',
  xrp = 'mainnet',
  'binance-smart-chain' = 'mainnet',
  tron = 'mainnet',
  polygon = 'mainnet',
  avalanche = 'mainnet',
  arbitrum = 'mainnet',
  solana = 'mainnet',
  optimism = 'mainnet',
}
