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
  | 'pending'      // Initial state, waiting for deposit
  | 'processing'   // Deposit received, executing bridge
  | 'completed'    // Bridge successful
  | 'failed'       // Bridge failed
  | 'refunded'     // Funds returned to source
  | 'cancelled';   // User cancelled the transaction

export interface LayerswapError {
  code: string;
  message: string;
  details?: Record<string, any>;
}

export interface LayerswapErrorResponse {
  status: number;
  statusText: string;
  error: string | { [key: string]: any };
}

export interface LayerswapSwapRequest {
  source_network: string;
  destination_network: string;
  source_token: string;
  destination_token: string;
  amount: number;
  source_address: string;
  destination_address: string;
  refund_address?: string;
  gas_price?: string;  // Optional gas price in wei
  slippage?: number;   // Optional slippage tolerance in percentage
}

export interface LayerswapSwapResponse {
  id: string;
  created_date: string;
  status: LayerswapSwapStatus;
  source_network: string;
  destination_network: string;
  source_token: string;
  destination_token: string;
  amount: number;
  source_address: string;
  destination_address: string;
  refund_address?: string;
  transaction_id?: string;
  source_transaction_id?: string;
  destination_transaction_id?: string;
  error?: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
  estimated_completion_time?: string;
  fee?: {
    amount: number;
    token: string;
  };
}

export interface LayerswapNetwork {
  id: string;
  display_name: string;
  internal_name: string;
  tokens: LayerswapToken[];
  status: string;
}

export interface LayerswapToken {
  asset: string;
  decimals: number;
  symbol: string;
  network_internal_name: string;
}

export interface LayerswapRoutes {
  source_networks: LayerswapNetwork[];
  destination_networks: LayerswapNetwork[];
  routes: {
    source_network: string;
    destination_network: string;
    source_tokens: string[];
    destination_tokens: string[];
  }[];
}
