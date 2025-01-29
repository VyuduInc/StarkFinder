/* eslint-disable @typescript-eslint/no-unused-vars */
import type {
  LayerswapCreateSwapRequest,
  LayerswapSuccessResponse,
  LayerswapErrorResponse,
  LayerswapError,
  LayerswapRoutes,
  LayerswapSwapStatus
} from "@/lib/transaction/types";

export class LayerswapClient {
  private readonly API_URL = "https://api.layerswap.io/api/v2/swaps";
  private readonly API_KEY: string;
  private lastRequestTime: number = 0;
  private readonly MIN_REQUEST_INTERVAL = 1000; // 1 second minimum between requests

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('Layerswap API key is required');
    }
    this.API_KEY = apiKey;
  }

  private async makeRequest<T>(url: string, options: RequestInit): Promise<T> {
    // Rate limiting
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.MIN_REQUEST_INTERVAL) {
      await new Promise(resolve => setTimeout(resolve, this.MIN_REQUEST_INTERVAL - timeSinceLastRequest));
    }
    this.lastRequestTime = Date.now();

    // Add security headers
    const headers = new Headers(options.headers);
    headers.set('X-LS-APIKEY', this.API_KEY);
    headers.set('Accept', 'application/json');
    if (options.method === 'POST') {
      headers.set('Content-Type', 'application/json');
    }
    headers.set('X-Request-Id', crypto.randomUUID()); // Add request ID for tracking

    const response = await fetch(url, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      if (data.error) {
        throw new Error(
          `Layerswap error: ${
            typeof data.error === "string"
              ? data.error
              : JSON.stringify(data.error)
          }`
        );
      }
      if (data.errors && Array.isArray(data.errors)) {
        throw new Error(
          `Layerswap errors: ${data.errors
            .map((e: { message: string }) => e.message)
            .join(", ")}`
        );
      }
      throw new Error(
        `Layerswap request failed with status ${response.status}`
      );
    }

    return data;
  }

  async createSwap(params: {
    sourceNetwork: string;
    destinationNetwork: string;
    sourceToken: string;
    destinationToken: string;
    amount: number;
    sourceAddress: string;
    destinationAddress: string;
  }): Promise<LayerswapSuccessResponse> {
    try {
      // Validate parameters
      if (!params.sourceNetwork || !params.destinationNetwork) {
        throw new Error('Source and destination networks are required');
      }
      if (!params.sourceToken || !params.destinationToken) {
        throw new Error('Source and destination tokens are required');
      }
      if (!params.amount || params.amount <= 0) {
        throw new Error('Amount must be greater than 0');
      }
      if (!params.sourceAddress || !params.destinationAddress) {
        throw new Error('Source and destination addresses are required');
      }

      // Validate addresses
      if (!/^0x[a-fA-F0-9]{40,64}$/.test(params.sourceAddress)) {
        throw new Error('Invalid source address format');
      }
      if (!/^0x[a-fA-F0-9]{40,64}$/.test(params.destinationAddress)) {
        throw new Error('Invalid destination address format');
      }

      // Format request to match their implementation
      const formattedRequest = {
        destination_address: params.destinationAddress,
        source_network: params.sourceNetwork.toLowerCase(),
        source_token: params.sourceToken.toUpperCase(),
        destination_network: params.destinationNetwork.toLowerCase(),
        destination_token: params.destinationToken.toUpperCase(),
        use_deposit_address: false,
        amount: params.amount,
        source_address: params.sourceAddress,
      };

      console.log(
        "Creating Layerswap request:",
        JSON.stringify(formattedRequest, null, 2)
      );

      return await this.makeRequest(this.API_URL, {
        method: "POST",
        body: JSON.stringify(formattedRequest),
      });
    } catch (error) {
      if (error instanceof Error) {
        console.error("Layerswap error details:", {
          message: error.message,
          stack: error.stack,
        });
        throw error;
      }
      console.error("Unknown Layerswap error:", JSON.stringify(error, null, 2));
      throw new Error("Unknown Layerswap error occurred");
    }
  }

  async getSwapStatus(swapId: string): Promise<LayerswapSwapStatus> {
    if (!/^[a-zA-Z0-9-]+$/.test(swapId)) {
      throw new Error('Invalid swap ID format');
    }

    try {
      return await this.makeRequest(`${this.API_URL}/${swapId}`, {
        method: 'GET'
      });
    } catch (error) {
      console.error('Error getting swap status:', error);
      throw error;
    }
  }

  async getAvailableRoutes(): Promise<LayerswapRoutes> {
    try {
      return await this.makeRequest(`${this.API_URL}/layers`, {
        method: 'GET'
      });
    } catch (error) {
      console.error('Error getting available routes:', error);
      throw error;
    }
  }
}
