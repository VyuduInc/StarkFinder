/* eslint-disable @typescript-eslint/no-explicit-any */
import { BaseTransactionHandler } from './base';
import { LayerswapClient } from '../../layerswap/client';
import { BrianTransactionData } from '../types';
import { TransactionStep } from '../types';
import { LayerswapSwapResponse, LayerswapRoutes } from '../types/layerswap';

export class BridgeHandler extends BaseTransactionHandler {
  private readonly NETWORK_MAPPING: Record<string, string> = {
    starknet: "starknet_mainnet",
    base: "base_mainnet",
    ethereum: "ethereum_mainnet",
    arbitrum: "arbitrum_mainnet",
    optimism: "optimism_mainnet",
    polygon: "polygon_mainnet",
    zkera: "zkera_mainnet",
    linea: "linea_mainnet",
    scroll: "scroll_mainnet",
    zksync: "zksync_mainnet",
  } as const;

  private readonly ADDRESS_FORMATS: Record<string, RegExp> = {
    starknet_mainnet: /^0x[a-fA-F0-9]{1,64}$/,
    ethereum_mainnet: /^0x[a-fA-F0-9]{40}$/,
    base_mainnet: /^0x[a-fA-F0-9]{40}$/,
    arbitrum_mainnet: /^0x[a-fA-F0-9]{40}$/,
    optimism_mainnet: /^0x[a-fA-F0-9]{40}$/,
    polygon_mainnet: /^0x[a-fA-F0-9]{40}$/,
    zkera_mainnet: /^0x[a-fA-F0-9]{40}$/,
    linea_mainnet: /^0x[a-fA-F0-9]{40}$/,
    scroll_mainnet: /^0x[a-fA-F0-9]{40}$/,
    zksync_mainnet: /^0x[a-fA-F0-9]{40}$/,
  } as const;

  private readonly STATUS_MESSAGES: Record<string, string> = {
    pending: 'Transaction is pending. Waiting for deposit...',
    processing: 'Processing your bridge transaction...',
    completed: 'Bridge transaction completed successfully!',
    failed: 'Bridge transaction failed. Please check the error details.',
    refunded: 'Transaction was refunded to your source address.',
  } as const;

  private readonly MIN_AMOUNTS: Record<string, number> = {
    ETH: 0.001,
    USDC: 1,
    USDT: 1,
  } as const;

  private layerswapClient: LayerswapClient;
  private availableRoutes: LayerswapRoutes | null = null;

  constructor(apiKey: string) {
    super();
    if (!apiKey) {
      throw new Error('Layerswap API key is required for bridging');
    }
    this.layerswapClient = new LayerswapClient(apiKey);
  }

  private formatNetwork(network: string): string {
    const mappedNetwork = this.NETWORK_MAPPING[network.toLowerCase()];
    if (!mappedNetwork) {
      throw new Error(`Network ${network} is not supported for bridging`);
    }
    return mappedNetwork;
  }

  private async getAvailableTokens(sourceNetwork: string, destinationNetwork: string): Promise<string[]> {
    if (!this.availableRoutes) {
      this.availableRoutes = await this.layerswapClient.getAvailableRoutes();
    }

    const route = this.availableRoutes.routes.find(
      r => r.source_network === sourceNetwork && r.destination_network === destinationNetwork
    );

    if (!route) {
      throw new Error(`No available route found for ${sourceNetwork} -> ${destinationNetwork}`);
    }

    // Return intersection of source and destination tokens
    return route.source_tokens.filter(token => route.destination_tokens.includes(token));
  }

  private async validateTokens(sourceNetwork: string, destinationNetwork: string, sourceToken?: string, destinationToken?: string): Promise<void> {
    if (!sourceToken || !destinationToken) {
      throw new Error('Source and destination tokens are required');
    }

    const availableTokens = await this.getAvailableTokens(sourceNetwork, destinationNetwork);
    const normalizedSourceToken = sourceToken.toUpperCase();
    const normalizedDestToken = destinationToken.toUpperCase();

    if (!availableTokens.includes(normalizedSourceToken) || !availableTokens.includes(normalizedDestToken)) {
      throw new Error(`Token pair ${sourceToken}->${destinationToken} not supported for this route. Available tokens: ${availableTokens.join(', ')}`);
    }
  }

  private validateAddresses(sourceNetwork: string, destinationNetwork: string, sourceAddress?: string, destinationAddress?: string): void {
    if (!sourceAddress || !destinationAddress) {
      throw new Error('Source and destination addresses are required');
    }

    const sourceFormat = this.ADDRESS_FORMATS[sourceNetwork];
    const destFormat = this.ADDRESS_FORMATS[destinationNetwork];

    if (!sourceFormat || !destFormat) {
      throw new Error(`Unsupported network(s): ${!sourceFormat ? sourceNetwork : destinationNetwork}`);
    }

    if (!sourceFormat.test(sourceAddress)) {
      throw new Error(`Invalid source address format for ${sourceNetwork}`);
    }
    if (!destFormat.test(destinationAddress)) {
      throw new Error(`Invalid destination address format for ${destinationNetwork}`);
    }
  }

  private validateAmount(amount: string | number | undefined, token: string): number {
    if (!amount) {
      throw new Error('Amount is required');
    }

    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(numAmount) || numAmount <= 0) {
      throw new Error('Amount must be a positive number');
    }

    const minAmount = this.MIN_AMOUNTS[token.toUpperCase()] || 0;
    if (numAmount < minAmount) {
      throw new Error(`Amount must be at least ${minAmount} ${token}`);
    }

    return numAmount;
  }

  private async monitorTransaction(swapId: string): Promise<TransactionStep[]> {
    const MAX_ATTEMPTS = 30;
    const POLL_INTERVAL = 10000; // 10 seconds

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const response = await this.layerswapClient.getSwapStatus(swapId);
      const status = response.status.toLowerCase();
      const message = this.STATUS_MESSAGES[status] || 'Unknown status';

      if (['completed', 'failed', 'refunded'].includes(status)) {
        return [{
          type: 'bridge',
          status: status === 'completed' ? 'success' : 'error',
          message,
          data: response,
          url: `https://www.layerswap.io/track/${response.id}`,
        }];
      }

      // If still processing, wait before next attempt
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
    }

    // If we reach here, transaction is taking too long
    return [{
      type: 'bridge',
      status: 'warning',
      message: 'Transaction is taking longer than expected. Please check the status URL.',
      data: { swapId },
      url: `https://www.layerswap.io/track/${swapId}`,
    }];
  }

  async processSteps(
    data: BrianTransactionData,
    params?: any
  ): Promise<TransactionStep[]> {
    try {
      // Extract and validate parameters
      const sourceNetwork = this.formatNetwork(params?.chain || "starknet");
      const destinationNetwork = this.formatNetwork(params?.dest_chain || "base");
      
      // Get available tokens and validate
      const availableTokens = await this.getAvailableTokens(sourceNetwork, destinationNetwork);
      console.log(`Available tokens for ${sourceNetwork}->${destinationNetwork}:`, availableTokens);

      // Default to ETH if available, otherwise use first available token
      const defaultToken = availableTokens.includes('ETH') ? 'ETH' : availableTokens[0];
      const sourceToken = (params?.token1 || defaultToken).toUpperCase();
      const destinationToken = (params?.token2 || defaultToken).toUpperCase();

      // Validate tokens
      await this.validateTokens(sourceNetwork, destinationNetwork, sourceToken, destinationToken);

      // Extract and validate addresses
      const sourceAddress = data.bridge?.sourceAddress || params?.address;
      const destinationAddress = data.bridge?.destinationAddress || params?.address;
      const refundAddress = data.bridge?.refundAddress || sourceAddress;
      this.validateAddresses(sourceNetwork, destinationNetwork, sourceAddress, destinationAddress);

      // Validate amount
      const amount = this.validateAmount(params?.amount, sourceToken);

      // Create swap request
      const response = await this.layerswapClient.createSwap({
        sourceNetwork,
        destinationNetwork,
        sourceToken,
        destinationToken,
        amount,
        sourceAddress,
        destinationAddress,
        refundAddress,
      });

      // Start monitoring the transaction
      return this.monitorTransaction(response.id);
    } catch (error: any) {
      console.error('Bridge error:', error);
      return [{
        type: 'bridge',
        status: 'error',
        message: error.message || 'Failed to process bridge transaction',
        data: error,
      }];
    }
  }
}
