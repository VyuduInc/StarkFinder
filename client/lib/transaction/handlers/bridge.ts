/* eslint-disable @typescript-eslint/no-explicit-any */
import { BaseTransactionHandler } from './base';
import { LayerswapClient } from '../../layerswap/client';
import { BrianTransactionData } from '../types';
import { TransactionStep } from '../types';
import { LayerswapSwapResponse } from '../types/layerswap';

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

  private layerswapClient: LayerswapClient;

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

  private validateTokens(sourceToken?: string, destinationToken?: string): void {
    if (!sourceToken || !destinationToken) {
      throw new Error('Source and destination tokens are required');
    }

    // Currently only supporting ETH bridging
    if (sourceToken.toUpperCase() !== 'ETH' || destinationToken.toUpperCase() !== 'ETH') {
      throw new Error('Only ETH bridging is supported at this time');
    }
  }

  private validateAddresses(sourceAddress?: string, destinationAddress?: string): void {
    if (!sourceAddress || !destinationAddress) {
      throw new Error('Source and destination addresses are required');
    }

    const addressRegex = /^0x[a-fA-F0-9]{40,64}$/;
    if (!addressRegex.test(sourceAddress)) {
      throw new Error('Invalid source address format');
    }
    if (!addressRegex.test(destinationAddress)) {
      throw new Error('Invalid destination address format');
    }
  }

  private validateAmount(amount?: string | number): number {
    if (!amount) {
      throw new Error('Amount is required');
    }

    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(numAmount) || numAmount <= 0) {
      throw new Error('Amount must be a positive number');
    }

    return numAmount;
  }

  async processSteps(
    data: BrianTransactionData,
    params?: any
  ): Promise<TransactionStep[]> {
    try {
      // Extract and validate parameters
      const sourceNetwork = this.formatNetwork(params?.chain || "starknet");
      const destinationNetwork = this.formatNetwork(params?.dest_chain || "base");
      
      // Validate tokens
      this.validateTokens(params?.token1, params?.token2);
      const sourceToken = params.token1.toUpperCase();
      const destinationToken = params.token2.toUpperCase();

      // Extract and validate addresses
      const sourceAddress = data.bridge?.sourceAddress || params?.address;
      const destinationAddress = data.bridge?.destinationAddress || params?.address;
      this.validateAddresses(sourceAddress, destinationAddress);

      // Validate amount
      const amount = this.validateAmount(params?.amount);

      // Create swap request
      const response: LayerswapSwapResponse = await this.layerswapClient.createSwap({
        sourceNetwork,
        destinationNetwork,
        sourceToken,
        destinationToken,
        amount,
        sourceAddress,
        destinationAddress
      });

      // Create transaction steps
      const steps: TransactionStep[] = [
        {
          type: 'bridge_initiate',
          description: `Initiating bridge from ${sourceNetwork} to ${destinationNetwork}`,
          status: 'pending'
        }
      ];

      if (response.transaction_id) {
        steps.push({
          type: 'bridge_transaction',
          description: `Bridge transaction created with ID: ${response.transaction_id}`,
          status: 'completed',
          url: `https://layerswap.io/track/${response.id}`
        });
      }

      if (response.error) {
        steps.push({
          type: 'bridge_error',
          description: `Bridge error: ${response.error}`,
          status: 'failed',
          error: response.error
        });
      }

      return steps;
    } catch (error) {
      console.error('Bridge error:', error);
      throw error;
    }
  }
}
