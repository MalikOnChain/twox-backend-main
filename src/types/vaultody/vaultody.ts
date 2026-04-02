// const TRANSACTION_REQUEST = {
//   walletId: '64463ff167ecf9000707b052',
//   webhookId: '65b2633879435ab2f30727ff',
//   idempotencyKey:
//     'd14d2f41c0c2aef3f699ef2da79bc673ea5893eddf5966b7dde9fdde0e34b750',
//   apiVersion: '2023-04-20',
//   data: {
//     event: 'TRANSACTION_REQUEST',
//     item: {
//       blockchain: 'tron',
//       network: 'nile',
//       requestId: '65e89fd7e7684b8228dec633',
//     },
//   },
// };

// const TRANSACTOIN_APPROVED = {
//   walletId: '64463ff167ecf9000707b052',
//   webhookId: '65b2633879435ab2f30727ff',
//   idempotencyKey:
//     'e5a10cfa989cf5b589ff1a6e7ca37ba1fe5307e26d41012e83cbf5db0a2fc31c',
//   apiVersion: '2023-04-20',
//   data: {
//     event: 'TRANSACTION_APPROVED',
//     item: {
//       blockchain: 'tron',
//       network: 'nile',
//       requestId: '65e89fd7e7684b8228dec633',
//       requiredApprovals: 1,
//       requiredRejections: 1,
//       currentApprovals: 1,
//       currentRejections: 0,
//     },
//   },
// };

// const TRANSACTION_REJECTED = {
//   walletId: '64463ff167ecf9000707b052',
//   webhookId: '65b2633879435ab2f30727ff',
//   idempotencyKey:
//     'acb0ab432a693f604f45cfe08352b02074fa0053990f9e58140d41dfb71472db',
//   apiVersion: '2023-04-20',
//   data: {
//     event: 'TRANSACTION_REJECTED',
//     item: {
//       blockchain: 'tron',
//       network: 'nile',
//       requestId: '65e069a6e7684b8228ff583a',
//       requiredApprovals: 1,
//       requiredRejections: 1,
//       currentApprovals: 0,
//       currentRejections: 1,
//     },
//   },
// };

// const INCOMING_CONFIRMED_COIN_TX = {
//   walletId: '64463ff167ecf9000707b052',
//   webhookId: '65b2633879435ab2f30727ff',
//   idempotencyKey:
//     'c989505f082b3463a14d50f9ab785951366fd93012c9869ea1347d8f0b722ea7',
//   apiVersion: '2023-04-20',
//   data: {
//     event: 'INCOMING_CONFIRMED_COIN_TX',
//     item: {
//       blockchain: 'binance-smart-chain',
//       network: 'testnet',
//       address: '0x6746d7d3f59c1cf062ad25bff246660297122ff2',
//       minedInBlock: {
//         height: 37959320,
//         hash: '0x8cff00dcce8c5eecd1bd42bb68b31ac126263cb819133a8e550465cf4426d711',
//         timestamp: 1708588551,
//       },
//       currentConfirmations: 12,
//       targetConfirmations: 12,
//       amount: '0.3',
//       unit: 'BNB',
//       transactionId:
//         '0x94405584ed8c2177094f056e7ea6d2c157f3a3e2c1585669e222c5a40d104ef6',
//     },
//   },
// };

// const INCOMING_CONFIRMED_TOKEN_TX = {
//   walletId: '64463ff167ecf9000707b052',
//   webhookId: '65b2633879435ab2f30727ff',
//   idempotencyKey:
//     'b0c63d216889beb4f6d2154231f1becd2b7d9dbc349a6644cae839b5f35791b1',
//   apiVersion: '2023-04-20',
//   data: {
//     event: 'INCOMING_CONFIRMED_TOKEN_TX',
//     item: {
//       blockchain: 'tron',
//       network: 'nile',
//       address: 'TDGFc6pDe5q2gc9zi4p2JQHfJTXVTBw7yu',
//       minedInBlock: {
//         height: 45323934,
//         hash: '0000000002b3969e82281bb3b6d96e88e416d422faaae27a05b8522bc30c83fc',
//         timestamp: 1710924012,
//       },
//       currentConfirmations: 4,
//       targetConfirmations: 12,
//       tokenType: 'TRC-20',
//       transactionId:
//         'a6f8225d5a905fc236e5d85d88f77d127d48e80bb456042853c8ed6210182f4f',
//       token: {
//         tokenName: 'Tether USD',
//         tokenSymbol: 'USDT',
//         decimals: 6,
//         tokensAmount: '50000',
//         contract: 'TXLAQ63Xg1NAzckPwKHvzw7CSEmLMEqcdj',
//       },
//     },
//   },
// };

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

export enum BLOCKCHAIN_PROTOCOL_NAME {
  BITCOIN = 'bitcoin',
  BITCOIN_CASH = 'bitcoin-cash',
  LITE_COIN = 'litecoin',
  DOGE_COIN = 'dogecoin',
  ETHEREUM = 'ethereum',
  XRP = 'xrp',
  BINANCE_SMART_CHAIN = 'binance-smart-chain',
  TRON = 'tron',
  POLYGON = 'polygon',
  AVALANCHE = 'avalanche',
  ARBITRUM = 'arbitrum',
  OPTIMISM = 'optimism',
  BASE = 'base',
  LINEA = 'linea',
  FANTOM = 'fantom',
  SOLANA = 'solana',
  SUI = 'sui',
}

export enum CRYPTO_TOKENS {
  USDT = 'USDT',
}

export enum NETWORK {
  MAINNET = 'mainnet',
  TESTNET = 'testnet',
  SEPOLIA = 'sepolia',
  MORDOR = 'mordor',
  NILE = 'nile',
  AMOY = 'amoy',
  FUJI = 'fuji',
}

// Note: CRYPTO_SYMBOLS and SYMBOL_TO_BLOCKCHAIN are computed objects, so they remain as const objects
export const CRYPTO_SYMBOLS: Record<BLOCKCHAIN_PROTOCOL_NAME | CRYPTO_TOKENS, string> = {
  [BLOCKCHAIN_PROTOCOL_NAME.BITCOIN]: 'BTC',
  [BLOCKCHAIN_PROTOCOL_NAME.BITCOIN_CASH]: 'BCH',
  [BLOCKCHAIN_PROTOCOL_NAME.LITE_COIN]: 'LTC',
  [BLOCKCHAIN_PROTOCOL_NAME.DOGE_COIN]: 'DOGE',
  [BLOCKCHAIN_PROTOCOL_NAME.ETHEREUM]: 'ETH',
  [BLOCKCHAIN_PROTOCOL_NAME.XRP]: 'XRP',
  [BLOCKCHAIN_PROTOCOL_NAME.BINANCE_SMART_CHAIN]: 'BNB',
  [BLOCKCHAIN_PROTOCOL_NAME.TRON]: 'TRX',
  [BLOCKCHAIN_PROTOCOL_NAME.POLYGON]: 'MATIC',
  [BLOCKCHAIN_PROTOCOL_NAME.AVALANCHE]: 'AVAX',
  [BLOCKCHAIN_PROTOCOL_NAME.ARBITRUM]: 'ARB',
  [BLOCKCHAIN_PROTOCOL_NAME.OPTIMISM]: 'OP',
  [BLOCKCHAIN_PROTOCOL_NAME.BASE]: 'ETH',
  [BLOCKCHAIN_PROTOCOL_NAME.LINEA]: 'ETH',
  [BLOCKCHAIN_PROTOCOL_NAME.FANTOM]: 'FTM',
  [BLOCKCHAIN_PROTOCOL_NAME.SOLANA]: 'SOL',
  [BLOCKCHAIN_PROTOCOL_NAME.SUI]: 'SUI',
  [CRYPTO_TOKENS.USDT]: 'USDT',
};

export const SYMBOL_TO_BLOCKCHAIN: Record<string, BLOCKCHAIN_PROTOCOL_NAME | CRYPTO_TOKENS> = Object.entries(
  CRYPTO_SYMBOLS
).reduce(
  (acc, [blockchain, symbol]) => {
    acc[symbol] = blockchain as BLOCKCHAIN_PROTOCOL_NAME | CRYPTO_TOKENS;
    return acc;
  },
  {} as Record<string, BLOCKCHAIN_PROTOCOL_NAME | CRYPTO_TOKENS>
);

export const DEV_NETWORK_MAPPING: Record<BLOCKCHAIN_PROTOCOL_NAME, NETWORK> = {
  [BLOCKCHAIN_PROTOCOL_NAME.BITCOIN]: NETWORK.TESTNET,
  [BLOCKCHAIN_PROTOCOL_NAME.BITCOIN_CASH]: NETWORK.TESTNET,
  [BLOCKCHAIN_PROTOCOL_NAME.LITE_COIN]: NETWORK.TESTNET,
  [BLOCKCHAIN_PROTOCOL_NAME.DOGE_COIN]: NETWORK.TESTNET,
  [BLOCKCHAIN_PROTOCOL_NAME.ETHEREUM]: NETWORK.SEPOLIA,
  [BLOCKCHAIN_PROTOCOL_NAME.XRP]: NETWORK.TESTNET,
  [BLOCKCHAIN_PROTOCOL_NAME.BINANCE_SMART_CHAIN]: NETWORK.TESTNET,
  [BLOCKCHAIN_PROTOCOL_NAME.TRON]: NETWORK.NILE,
  [BLOCKCHAIN_PROTOCOL_NAME.POLYGON]: NETWORK.AMOY,
  [BLOCKCHAIN_PROTOCOL_NAME.AVALANCHE]: NETWORK.FUJI,
  [BLOCKCHAIN_PROTOCOL_NAME.ARBITRUM]: NETWORK.SEPOLIA,
  [BLOCKCHAIN_PROTOCOL_NAME.OPTIMISM]: NETWORK.SEPOLIA,
  [BLOCKCHAIN_PROTOCOL_NAME.BASE]: NETWORK.SEPOLIA,
  [BLOCKCHAIN_PROTOCOL_NAME.LINEA]: NETWORK.SEPOLIA,
  [BLOCKCHAIN_PROTOCOL_NAME.FANTOM]: NETWORK.TESTNET,
  [BLOCKCHAIN_PROTOCOL_NAME.SOLANA]: NETWORK.MAINNET,
  [BLOCKCHAIN_PROTOCOL_NAME.SUI]: NETWORK.TESTNET,
};

// Helper function to get network based on environment and blockchain
export const getNetworkForBlockchain = (blockchain: BLOCKCHAIN_PROTOCOL_NAME): NETWORK => {
  return process.env.NODE_ENV === 'production' ? NETWORK.MAINNET : DEV_NETWORK_MAPPING[blockchain];
};
