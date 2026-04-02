export enum NETWORK {
  MAINNET = 'mainnet',
  TESTNET = 'testnet',
  SEPOLIA = 'sepolia',
  MORDOR = 'mordor',
  NILE = 'nile',
  AMOY = 'amoy',
  FUJI = 'fuji',
  MUMBAI = 'mumbai',
}

export enum BLOCKCHAIN_PROTOCOL_NAME {
  BITCOIN = 'bitcoin',
  LITECOIN = 'litecoin',
  DOGECOIN = 'dogecoin',
  ETHEREUM = 'ethereum',
  XRP = 'xrp',
  BINANCE_SMART_CHAIN = 'binance-smart-chain',
  TRON = 'tron',
  POLYGON = 'polygon',
  AVALANCHE = 'avalanche',
  ARBITRUM = 'arbitrum',
  SOLANA = 'solana',
  OPTIMISM = 'optimism',
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

// EVM Chain IDs
export enum EVMChainId {
  ETHEREUM_MAINNET = 1,
  ETHEREUM_SEPOLIA = 11155111,
  ETHEREUM_GOERLI = 5,
  ETHEREUM_HOLESKY = 17000,
  BSC_MAINNET = 56,
  BSC_TESTNET = 97,
  POLYGON_MAINNET = 137,
  POLYGON_MUMBAI = 80001,
  AVALANCHE_MAINNET = 43114,
  AVALANCHE_FUJI = 43113,
  ARBITRUM_ONE = 42161,
  ARBITRUM_GOERLI = 421613,
  OPTIMISM_MAINNET = 10,
  OPTIMISM_GOERLI = 420,
}
