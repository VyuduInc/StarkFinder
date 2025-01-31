export interface LayerswapCreateSwapRequest {
  sourceNetwork: string;
  destinationNetwork: string;
  sourceToken: string;
  destinationToken: string;
  amount: number;
  sourceAddress?: string;
  destinationAddress: string;
  refundAddress?: string;
}

export interface LayerswapSuccessResponse {
  data: {
    id: string;
    created_at: string;
    status: LayerswapSwapStatus;
    deposit_actions: Array<{
      type: string;
      call_data?: string;
      deposit_address?: string;
      explorer_url?: string;
    }>;
    source_network: string;
    destination_network: string;
    source_token: string;
    destination_token: string;
    amount: string;
    destination_address: string;
    reference_id?: string;
  };
}

export type LayerswapSwapStatus = 
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'refunded';

export interface LayerswapError {
  code: string;
  message: string;
  details?: Record<string, any>;
}

export interface LayerswapErrorResponse {
  errors: LayerswapError[];
}

export interface LayerswapRoutes {
  source_networks: string[];
  destination_networks: string[];
  tokens: {
    [network: string]: {
      symbol: string;
      decimals: number;
      min_amount?: string;
      max_amount?: string;
    }[];
  };
}
