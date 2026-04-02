// Base cryptocurrency types
type CRYPTO_CURRENCY =
  | 'BTC' // Bitcoin
  | 'LTC' // Litecoin
  | 'DOGE' // Dogecoin
  | 'ETH' // Ethereum
  | 'XRP' // Ripple
  | 'BNB' // Binance Coin
  | 'TRX' // Tron
  | 'MATIC' // Polygon
  | 'AVAX' // Avalanche
  | 'ARB' // Arbitrum
  | 'USDT' // Tether
  | 'USDC' // USD Coin
  | 'DAI'; // Dai Stablecoin

type BLOCKCHAIN_PROTOCOL_NAME_TYPE =
  | 'dogecoin'
  | 'ethereum'
  | 'xrp'
  | 'binance-smart-chain'
  | 'tron'
  | 'polygon'
  | 'avalanche'
  | 'arbitrum'
  | 'solana'
  | 'optimism';

// Network types for Ethereum and EVM compatible chains
type ETHEREUM_NETWORK_NAME =
  | 'mainnet' // Ethereum mainnet
  | 'goerli' // Ethereum testnet (being deprecated)
  | 'sepolia' // Ethereum testnet
  | 'holesky'; // Ethereum testnet (newer)

// Network types for non-Ethereum chains
type NON_ETH_TESTNET_NAME =
  | 'mordor' // ETC testnet
  | 'nile' // TRON testnet
  | 'amoy' // XRP testnet
  | 'fuji' // Avalanche testnet
  | 'mumbai'; // Polygon testnet

// Combined network names
type NETWORK_NAME = ETHEREUM_NETWORK_NAME | NON_ETH_TESTNET_NAME;

// Token standards
type TOKEN_STANDARD =
  | 'ERC20' // Ethereum token standard
  | 'ERC721' // Ethereum NFT standard
  | 'ERC1155' // Ethereum multi-token standard
  | 'BEP20' // Binance Smart Chain token standard
  | 'TRC20' // TRON token standard
  | 'TRC10' // TRON native token standard
  | 'OMNI'; // Bitcoin-based token standard (legacy)

// Specific network types for USDT
type USDT_NETWORK_TYPE = 'TRC20' | 'ERC20' | 'BEP20' | 'OMNI';

// Network types for TRON
type TRON_NETWORK_TYPE = 'TRC20' | 'TRC10';

// Network types for Binance Smart Chain
type BINANCE_SMART_CHAIN_NETWORK_TYPE = 'BEP20';

// Network types for Polygon (which uses Ethereum standards)
type POLYGON_NETWORK_TYPE = 'ERC20' | 'ERC721' | 'ERC1155';

// Token types that can appear on Ethereum
type ERC20_TOKEN =
  | 'USDT' // Tether
  | 'USDC' // USD Coin
  | 'DAI' // Dai Stablecoin
  | 'LINK' // Chain link
  | 'UNI' // Uniswap
  | 'AAVE' // Aave
  | 'COMP'; // Compound

// Mapping blockchain to its native currency
type BLOCKCHAIN_TO_NATIVE_CURRENCY = {
  bitcoin: 'BTC';
  litecoin: 'LTC';
  dogecoin: 'DOGE';
  ethereum: 'ETH';
  xrp: 'XRP';
  'binance-smart-chain': 'BNB';
  tron: 'TRX';
  polygon: 'MATIC';
  avalanche: 'AVAX';
  arbitrum: 'ARB';
  solana: 'SOL';
  optimism: 'OP';
};

// Transaction type
interface Web3Transaction {
  from: string;
  to: string;
  value?: string; // In wei, or smallest unit of the currency
  data?: string; // Hex-encoded data
  gas?: string; // Gas limit
  gasPrice?: string; // Gas price in wei
  maxFeePerGas?: string; // For EIP-1559 transactions
  maxPriorityFeePerGas?: string; // For EIP-1559 transactions
  nonce?: number;
}

// Token transfer parameters
interface TokenTransferParams {
  tokenAddress: string;
  recipientAddress: string;
  amount: string;
  tokenStandard: TOKEN_STANDARD;
  decimals: number;
}

// Web3 provider interface
interface Web3Provider {
  request(args: { method: string; params?: Array<any> }): Promise<any>;
  on(event: string, listener: (...args: any[]) => void): void;
  removeListener(event: string, listener: (...args: any[]) => void): void;
}
