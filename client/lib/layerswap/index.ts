import { LayerswapTransaction, LayerswapResponse, LayerswapConfig, SwapStatusResponse } from './types';

export class Layerswap {
  private readonly config: LayerswapConfig;

  constructor(apiKey: string) {
    this.config = {
      apiKey,
      baseUrl: 'https://api.layerswap.io/api/v1'
    };
  }

  async createSwap(transaction: LayerswapTransaction): Promise<LayerswapResponse> {
    try {
      const response = await fetch(`${this.config.baseUrl}/swaps`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`
        },
        body: JSON.stringify({
          source: transaction.from_network,
          destination: transaction.to_network,
          asset: transaction.asset,
          amount: transaction.amount,
          destination_address: transaction.destination_address,
          refuel: transaction.refuel || false
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create swap');
      }

      const data = await response.json();
      return {
        success: true,
        swapId: data.id,
        redirectUrl: data.redirect_url
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  async getSwapStatus(swapId: string): Promise<SwapStatusResponse> {
    try {
      const response = await fetch(`${this.config.baseUrl}/swaps/${swapId}`, {
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to get swap status');
      }

      const data = await response.json();
      return {
        id: data.id,
        status: data.status,
        error: data.error
      };
    } catch (error) {
      throw error instanceof Error ? error : new Error('Failed to get swap status');
    }
  }
} 