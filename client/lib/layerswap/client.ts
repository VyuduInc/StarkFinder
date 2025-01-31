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
  private readonly API_BASE_URL = "https://api.layerswap.io/api/v2";
  private readonly SWAPS_URL = `${this.API_BASE_URL}/swaps`;
  private readonly NETWORKS_URL = `${this.API_BASE_URL}/networks`;
  private readonly API_KEY: string;
  private lastRequestTime: number = 0;
  private readonly MIN_REQUEST_INTERVAL = 1000; // 1 second minimum between requests
  private availableRoutes: LayerswapRoutes | null = null;

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

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      const data = await response.json();

      if (!response.ok) {
        const error: LayerswapErrorResponse = {
          code: response.status.toString(),
          message: 'Layerswap request failed',
          errors: []
        };

        if (data.error) {
          error.message = typeof data.error === "string" ? data.error : JSON.stringify(data.error);
        }
        if (data.errors && Array.isArray(data.errors)) {
          error.errors = data.errors.map((e: { code: string; message: string }) => ({
            code: e.code || 'UNKNOWN',
            message: e.message
          }));
        }

        throw error;
      }

      return data;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Network error: ${error}`);
    }
  }

  private async validateRoute(sourceNetwork: string, destinationNetwork: string, sourceToken: string, destinationToken: string): Promise<void> {
    if (!this.availableRoutes) {
      this.availableRoutes = await this.getAvailableRoutes();
    }

    const routes = this.availableRoutes;
    
    // Check if networks are supported
    if (!routes.source_networks.includes(sourceNetwork.toLowerCase())) {
      throw new Error(`Source network ${sourceNetwork} is not supported`);
    }
    if (!routes.destination_networks.includes(destinationNetwork.toLowerCase())) {
      throw new Error(`Destination network ${destinationNetwork} is not supported`);
    }

    // Check if tokens are supported on their networks
    const sourceTokens = routes.tokens[sourceNetwork.toLowerCase()] || [];
    const destTokens = routes.tokens[destinationNetwork.toLowerCase()] || [];

    if (!sourceTokens.includes(sourceToken.toUpperCase())) {
      throw new Error(`Token ${sourceToken} is not supported on ${sourceNetwork}`);
    }
    if (!destTokens.includes(destinationToken.toUpperCase())) {
      throw new Error(`Token ${destinationToken} is not supported on ${destinationNetwork}`);
    }
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
      // Basic parameter validation
      if (!params.sourceNetwork || !params.destinationNetwork) {
        throw new Error('Source and destination networks are required');
      }
      if (!params.sourceToken || !params.destinationToken) {
        throw new Error('Source and destination tokens are required');
      }
      if (!params.amount || params.amount <= 0) {
        throw new Error('Amount must be greater than 0');
      }
      if (!params.destinationAddress) {
        throw new Error('Destination address is required');
      }

      // Validate addresses based on network
      if (!/^0x[a-fA-F0-9]{40,64}$/.test(params.destinationAddress)) {
        throw new Error('Invalid destination address format');
      }

      // Validate route is supported
      await this.validateRoute(
        params.sourceNetwork,
        params.destinationNetwork,
        params.sourceToken,
        params.destinationToken
      );

      // Format request
      const formattedRequest: LayerswapCreateSwapRequest = {
        destination_address: params.destinationAddress,
        source_network: params.sourceNetwork.toLowerCase(),
        source_token: params.sourceToken.toUpperCase(),
        destination_network: params.destinationNetwork.toLowerCase(),
        destination_token: params.destinationToken.toUpperCase(),
        use_deposit_address: true, // Enable deposit address for better UX
        amount: params.amount,
        source_address: params.sourceAddress
      };

      console.log(
        "Creating Layerswap request:",
        JSON.stringify(formattedRequest, null, 2)
      );

      return await this.makeRequest(this.SWAPS_URL, {
        method: "POST",
        body: JSON.stringify(formattedRequest),
      });
    } catch (error) {
      console.error("Layerswap error:", error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error("Unknown Layerswap error occurred");
    }
  }

  async getSwapStatus(swapId: string): Promise<LayerswapSwapStatus> {
    if (!/^[a-zA-Z0-9-]+$/.test(swapId)) {
      throw new Error('Invalid swap ID format');
    }

    try {
      return await this.makeRequest(`${this.SWAPS_URL}/${swapId}`, {
        method: 'GET'
      });
    } catch (error) {
      console.error('Error getting swap status:', error);
      throw error;
    }
  }

  async getAvailableRoutes(): Promise<LayerswapRoutes> {
    try {
      return await this.makeRequest(this.NETWORKS_URL, {
        method: 'GET'
      });
    } catch (error) {
      console.error('Error getting available routes:', error);
      throw error;
    }
  }
}
