/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  LayerswapErrorResponse,
  LayerswapSwapRequest,
  LayerswapSwapResponse,
  LayerswapRoutes,
  LayerswapNetwork
} from '../transaction/types/layerswap';

export class LayerswapClient {
  private readonly API_BASE_URL = "https://api.layerswap.io/api/v2";
  private readonly SWAPS_URL = `${this.API_BASE_URL}/swaps`;
  private readonly NETWORKS_URL = `${this.API_BASE_URL}/networks`;
  private readonly MIN_REQUEST_INTERVAL = 1000; // 1 second minimum between requests
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 2000; // 2 seconds
  
  private lastRequestTime: number = 0;
  private availableRoutes: LayerswapRoutes | null = null;
  
  constructor(private readonly apiKey: string) {
    if (!apiKey) {
      throw new Error('Layerswap API key is required');
    }
  }

  private async makeRequest<T>(url: string, options: RequestInit = {}): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        // Rate limiting
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;
        if (timeSinceLastRequest < this.MIN_REQUEST_INTERVAL) {
          await new Promise(resolve => setTimeout(resolve, this.MIN_REQUEST_INTERVAL - timeSinceLastRequest));
        }
        this.lastRequestTime = Date.now();

        // Add security headers
        const headers = new Headers(options.headers);
        headers.set('X-LS-APIKEY', this.apiKey);
        headers.set('Accept', 'application/json');
        if (options.method === 'POST') {
          headers.set('Content-Type', 'application/json');
        }
        options.headers = headers;

        const response = await fetch(url, options);
        const data = await response.json();

        if (!response.ok) {
          const error = new Error() as LayerswapErrorResponse & Error;
          error.status = response.status;
          error.statusText = response.statusText;
          error.error = data.error;
          throw error;
        }

        // Validate response structure
        if (!this.validateResponseStructure(data)) {
          throw new Error('Invalid response structure from Layerswap API');
        }

        return data as T;
      } catch (error) {
        lastError = error as Error;
        console.error(`Attempt ${attempt}/${this.MAX_RETRIES} failed:`, error);
        
        if (attempt < this.MAX_RETRIES) {
          await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY));
        }
      }
    }

    throw new Error(`Failed after ${this.MAX_RETRIES} attempts. Last error: ${lastError?.message}`);
  }

  private validateResponseStructure(data: any): boolean {
    if (!data) return false;

    // For swap responses
    if ('id' in data && 'status' in data) {
      return typeof data.id === 'string' && typeof data.status === 'string';
    }

    // For routes response
    if ('routes' in data) {
      return Array.isArray(data.routes) && data.routes.every((route: any) => 
        typeof route.source_network === 'string' &&
        typeof route.destination_network === 'string' &&
        Array.isArray(route.source_tokens) &&
        Array.isArray(route.destination_tokens)
      );
    }

    return false;
  }

  private async validateRoute(
    sourceNetwork: string,
    destinationNetwork: string,
    sourceToken: string,
    destinationToken: string
  ): Promise<void> {
    if (!this.availableRoutes) {
      this.availableRoutes = await this.getAvailableRoutes();
    }

    const route = this.availableRoutes.routes.find(
      r =>
        r.source_network === sourceNetwork &&
        r.destination_network === destinationNetwork &&
        r.source_tokens.includes(sourceToken) &&
        r.destination_tokens.includes(destinationToken)
    );

    if (!route) {
      throw new Error(
        `Invalid route: ${sourceNetwork} -> ${destinationNetwork} for tokens ${sourceToken} -> ${destinationToken}`
      );
    }
  }

  async getAvailableRoutes(): Promise<LayerswapRoutes> {
    return this.makeRequest<LayerswapRoutes>(this.NETWORKS_URL);
  }

  async createSwap(params: {
    sourceNetwork: string;
    destinationNetwork: string;
    sourceToken: string;
    destinationToken: string;
    amount: number;
    sourceAddress: string;
    destinationAddress: string;
    refundAddress?: string;
  }): Promise<LayerswapSwapResponse> {
    try {
      await this.validateRoute(
        params.sourceNetwork,
        params.destinationNetwork,
        params.sourceToken,
        params.destinationToken
      );

      const formattedRequest: LayerswapSwapRequest = {
        source_network: params.sourceNetwork,
        destination_network: params.destinationNetwork,
        source_token: params.sourceToken,
        destination_token: params.destinationToken,
        amount: params.amount,
        source_address: params.sourceAddress,
        destination_address: params.destinationAddress,
        refund_address: params.refundAddress
      };

      console.log(
        "Creating Layerswap swap with request:",
        JSON.stringify(formattedRequest, null, 2)
      );

      return this.makeRequest<LayerswapSwapResponse>(this.SWAPS_URL, {
        method: "POST",
        body: JSON.stringify(formattedRequest)
      });
    } catch (error) {
      console.error("Layerswap error:", error);
      const friendlyError = this.getFriendlyErrorMessage(error);
      throw new Error(friendlyError);
    }
  }

  private getFriendlyErrorMessage(error: any): string {
    if (error.status === 429) {
      return 'Too many requests. Please try again in a few minutes.';
    }
    if (error.status === 400) {
      return 'Invalid request parameters. Please check your input and try again.';
    }
    if (error.status === 401) {
      return 'Authentication failed. Please check your API key.';
    }
    if (error.status === 503) {
      return 'Layerswap service is temporarily unavailable. Please try again later.';
    }
    return error.message || 'An unexpected error occurred. Please try again.';
  }

  async getSwapStatus(swapId: string): Promise<LayerswapSwapResponse> {
    if (!swapId) {
      throw new Error("Swap ID is required");
    }

    return this.makeRequest<LayerswapSwapResponse>(`${this.SWAPS_URL}/${swapId}`);
  }
}
