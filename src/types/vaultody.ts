enum DEV_NETWORKS {
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

enum PROD_NETWORKS {
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

type IncomingConfirmedCoinTxResponseType = {
  walletId: string;
  webhookId: string;
  idempotencyKey: string;
  apiVersion: string;
  data: {
    event: string;
    item: {
      blockchain: BLOCKCHAIN_PROTOCOL_NAME_TYPE;
      network: DEV_NETWORKS | PROD_NETWORKS;
      address: string;
      minedInBlock: {
        height: number;
        hash: string;
        timestamp: number;
      };
      currentConfirmations: number;
      targetConfirmations: number;
      amount: string;
      unit: string;
      transactionId: string;
    };
  };
};

type IncomingConfirmedTokenTxResponseType = {
  walletId: string;
  webhookId: string;
  idempotencyKey: string;
  apiVersion: string;
  data: {
    event: string;
    item: {
      blockchain: BLOCKCHAIN_PROTOCOL_NAME_TYPE;
      network: DEV_NETWORKS | PROD_NETWORKS;
      address: string;
      minedInBlock: {
        height: number;
        hash: string;
        timestamp: number;
      };
      currentConfirmations: number;
      targetConfirmations: number;
      tokenType: string;
      transactionId: string;
      token: {
        tokenName: string;
        tokenSymbol: string;
        decimals: number;
        tokensAmount: string;
        contract: string;
      };
    };
  };
};

type TransactionApprovedResponseType = {
  walletId: string;
  webhookId: string;
  idempotencyKey: string;
  apiVersion: string;
  data: {
    event: string;
    item: {
      blockchain: BLOCKCHAIN_PROTOCOL_NAME_TYPE;
      network: DEV_NETWORKS | PROD_NETWORKS;
      requestId: string;
      requiredApprovals: number;
      requiredRejections: number;
      currentApprovals: number;
      currentRejections: number;
    };
  };
};

type TransactionRejectedResponseType = {
  walletId: string;
  webhookId: string;
  idempotencyKey: string;
  apiVersion: string;
  data: {
    event: string;
    item: {
      blockchain: BLOCKCHAIN_PROTOCOL_NAME_TYPE;
      network: DEV_NETWORKS | PROD_NETWORKS;
      requestId: string;
      requiredApprovals: number;
      requiredRejections: number;
      currentApprovals: number;
      currentRejections: number;
    };
  };
};
