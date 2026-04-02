type BlockchainProtocolName =
  | 'bitcoin'
  | 'bitcoin-cash'
  | 'litecoin'
  | 'dogecoin'
  | 'ethereum'
  | 'xrp'
  | 'binance-smart-chain'
  | 'tron'
  | 'polygon'
  | 'avalanche'
  | 'arbitrum'
  | 'optimism'
  | 'base'
  | 'linea'
  | 'fantom'
  | 'solana'
  | 'sui';

type Network = 'mainnet' | 'testnet' | 'sepolia' | 'mordor' | 'nile' | 'amoy' | 'fuji';

type WalletType = 'metamask' | 'phantom' | 'vaultody' | 'fystack' | 'manual';

interface IWalletDepositAddresses extends Mongoose.Document {
  userId: Mongoose.ObjectId;
  address: string;
  blockchain: BlockchainProtocolName;
  network: Network;
  label: string;
  walletType?: WalletType;
  createdAt: Date;
}

interface IWalletDepositAddressesModel extends Mongoose.Model<IWalletDepositAddresses> {
  getUserAddresses(userId: Mongoose.ObjectId): Promise<any>;
  getAddressByBlockchain(userId: Mongoose.ObjectId, blockchain: BlockchainProtocolName): Promise<any | null>;

  getAddressesGroupedByBlockchain(userId: Mongoose.ObjectId): Promise<
    Record<
      BlockchainProtocolName,
      {
        address: string;
        network: Network;
        label: string;
        createdAt: Date;
      }
    >
  >;
}

// Static methods interface
type CreateBlockchainAddressFunction = (
  userId: Mongoose.ObjectId,
  blockchain: BlockchainProtocolName,
  testMode?: boolean,
  provisioningMode?: 'auto' | 'vaultody'
) => Promise<IWalletDepositAddresses>;

type CreateDepositAddressMiddlewareFunction = (next: (error?: any) => void) => Promise<void>;
