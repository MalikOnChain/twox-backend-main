import axios from 'axios';
import { logger } from '@/utils/logger';

export class BlockchainBalanceService {
  /**
   * Get Solana balance using RPC
   */
  static async getSolanaBalance(address: string): Promise<number> {
    try {
      logger.info(`Fetching Solana balance for: ${address}`);
      
      const rpcEndpoints = [
        'https://rpc.ankr.com/solana',
        'https://solana-mainnet.rpc.extrnode.com',
        'https://api.mainnet-beta.solana.com',
      ];

      for (const endpoint of rpcEndpoints) {
        try {
          const response = await axios.post(endpoint, {
            jsonrpc: '2.0',
            id: 1,
            method: 'getBalance',
            params: [address],
          }, {
            timeout: 10000, // Increased to 10 seconds
            headers: {
              'Content-Type': 'application/json',
            },
          });

          if (response.data?.result?.value !== undefined) {
            const lamports = response.data.result.value;
            const sol = lamports / 1_000_000_000;
            logger.info(`Solana balance: ${sol} SOL (via ${endpoint})`);
            return sol;
          }
        } catch (err: any) {
          logger.warn(`${endpoint} failed: ${err.message}`);
          continue;
        }
      }

      logger.error('All Solana RPC endpoints failed');
      return 0;
    } catch (error) {
      logger.error('Failed to get Solana balance:', error);
      return 0;
    }
  }

  /**
   * Get Bitcoin balance using blockchain API
   */
  static async getBitcoinBalance(address: string): Promise<number> {
    try {
      logger.info(`Fetching Bitcoin balance for: ${address}`);
      
      // Try blockchain.com API first
      try {
        const response = await axios.get(
          `https://blockchain.info/q/addressbalance/${address}`,
          { timeout: 10000 }
        );
        
        const satoshis = parseInt(response.data);
        const btc = satoshis / 100_000_000;
        logger.info(`Bitcoin balance: ${btc} BTC`);
        return btc;
      } catch (err) {
        logger.warn('blockchain.info failed, trying blockchair...');
        
        // Backup: Try blockchair API
        const response = await axios.get(
          `https://api.blockchair.com/bitcoin/dashboards/address/${address}`,
          { timeout: 10000 }
        );
        
        const satoshis = response.data?.data?.[address]?.address?.balance || 0;
        const btc = satoshis / 100_000_000;
        logger.info(`Bitcoin balance: ${btc} BTC`);
        return btc;
      }
    } catch (error) {
      logger.error('Failed to get Bitcoin balance:', error);
      return 0;
    }
  }

  /**
   * Get EVM balance (Ethereum, Polygon, BSC, etc.)
   */
  static async getEvmBalance(blockchain: string, address: string): Promise<number> {
    try {
      logger.info(`Fetching ${blockchain} balance for: ${address}`);
      
      // Map blockchain to multiple RPC URLs (with fallbacks)
      const rpcUrlsMap: Record<string, string[]> = {
        ethereum: [
          'https://rpc.ankr.com/eth',
          'https://eth.drpc.org',
          'https://eth.llamarpc.com',
          'https://cloudflare-eth.com',
        ],
        polygon: [
          'https://polygon-rpc.com',
          'https://rpc.ankr.com/polygon',
          'https://polygon-bor.publicnode.com',
        ],
        'binance-smart-chain': [
          'https://bsc-dataseed.binance.org',
          'https://rpc.ankr.com/bsc',
          'https://bsc.publicnode.com',
        ],
        arbitrum: [
          'https://arb1.arbitrum.io/rpc',
          'https://rpc.ankr.com/arbitrum',
        ],
        avalanche: [
          'https://api.avax.network/ext/bc/C/rpc',
          'https://rpc.ankr.com/avalanche',
        ],
        optimism: [
          'https://mainnet.optimism.io',
          'https://rpc.ankr.com/optimism',
        ],
        base: [
          'https://mainnet.base.org',
          'https://base.llamarpc.com',
        ],
        linea: [
          'https://rpc.linea.build',
        ],
        fantom: [
          'https://rpc.ankr.com/fantom',
          'https://rpc.ftm.tools',
        ],
      };

      const rpcUrls = rpcUrlsMap[blockchain];
      if (!rpcUrls || rpcUrls.length === 0) {
        logger.warn(`No RPC configured for: ${blockchain}`);
        return 0;
      }

      // Try each RPC endpoint until one works
      for (const rpcUrl of rpcUrls) {
        try {
          const response = await axios.post(rpcUrl, {
            jsonrpc: '2.0',
            id: 1,
            method: 'eth_getBalance',
            params: [address, 'latest'],
          }, {
            timeout: 10000, // Increased to 10 seconds
            headers: {
              'Content-Type': 'application/json',
            },
          });

          if (response.data?.result) {
            const hexBalance = response.data.result;
            const wei = BigInt(hexBalance);
            const eth = Number(wei) / 1e18;
            logger.info(`${blockchain} balance: ${eth} (via ${rpcUrl})`);
            return eth;
          }
        } catch (err: any) {
          logger.warn(`${rpcUrl} failed: ${err.message}`);
          continue; // Try next RPC
        }
      }

      logger.error(`All RPC endpoints failed for ${blockchain}`);
      return 0;
    } catch (error) {
      logger.error(`Failed to get ${blockchain} balance:`, error);
      return 0;
    }
  }

  /**
   * Get Sui balance
   */
  static async getSuiBalance(address: string): Promise<number> {
    try {
      logger.info(`Fetching Sui balance for: ${address}`);
      
      const response = await axios.post('https://fullnode.mainnet.sui.io:443', {
        jsonrpc: '2.0',
        id: 1,
        method: 'suix_getBalance',
        params: [address],
      }, {
        timeout: 10000, // Increased to 10 seconds
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.data?.result?.totalBalance) {
        const balance = parseInt(response.data.result.totalBalance);
        const sui = balance / 1_000_000_000;
        logger.info(`Sui balance: ${sui} SUI`);
        return sui;
      }

      return 0;
    } catch (error) {
      logger.error('Failed to get Sui balance:', error);
      return 0;
    }
  }

  /**
   * Main method to get balance for any blockchain
   */
  static async getBalance(blockchain: string, address: string): Promise<number> {
    const normalizedBlockchain = blockchain.toLowerCase();

    // EVM chains
    const evmChains = [
      'ethereum',
      'polygon',
      'arbitrum',
      'avalanche',
      'binance-smart-chain',
      'optimism',
      'base',
      'linea',
      'fantom',
    ];

    if (evmChains.includes(normalizedBlockchain)) {
      return this.getEvmBalance(normalizedBlockchain, address);
    }

    if (normalizedBlockchain === 'solana') {
      return this.getSolanaBalance(address);
    }

    if (normalizedBlockchain === 'bitcoin') {
      return this.getBitcoinBalance(address);
    }

    if (normalizedBlockchain === 'sui') {
      return this.getSuiBalance(address);
    }

    logger.warn(`Balance fetching not implemented for: ${blockchain}`);
    return 0;
  }
}

export default BlockchainBalanceService;

