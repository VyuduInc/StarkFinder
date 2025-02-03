export type TransactionAction =
  | "swap"
  | "transfer"
  | "deposit"
  | "withdraw"
  | "bridge";

export interface TransactionStep {
  type: string;
  description: string;
  status: 'pending' | 'completed' | 'failed';
  url?: string;
  error?: string;
  contractAddress?: string;
  entrypoint?: string;
  calldata?: string[];
}

export interface BrianStep {
  approve?: TransactionStep;
  transactionData?: TransactionStep;
  contractAddress?: string;
  entrypoint?: string;
  calldata?: string[];
}

export interface BrianToken {
  address: string;
  symbol: string;
  decimals: number;
}

export interface NetworkConfig {
  chainId: string;
  name: string;
}

export interface BridgeConfig {
  source: NetworkConfig;
  destination: NetworkConfig;
  supportedTokens: {
    [key: string]: {
      sourceToken: string;
      destinationToken: string;
    };
  };
}

export interface LayerswapNetwork {
  name: string;
  display_name: string;
  tokens: string[];
  status: string;
}

export interface LayerswapRoute {
  source_network: string;
  destination_network: string;
  source_tokens: string[];
  destination_tokens: string[];
  status: string;
}

export interface LayerswapRoutes {
  networks: LayerswapNetwork[];
  routes: LayerswapRoute[];
}

export interface LayerswapAction {
  call_data: string; // JSON string of TransactionStep[]
  chain_id: string;
  created_date: string;
  network: string;
  status: string;
  type: string;
}

export interface LayerswapSwapStatus {
  id: string;
  status: string;
  created_date: string;
  source_network: string;
  destination_network: string;
  source_token: string;
  destination_token: string;
  source_amount: number;
  destination_amount: number;
  source_address: string;
  destination_address: string;
  deposit_actions: LayerswapAction[];
}

export type LayerswapSuccessResponse = {
  success: true;
  data: {
    id: string;
    status: string;
    created_at: string;
    updated_at: string;
    source_network: string;
    destination_network: string;
    source_token: string;
    destination_token: string;
    amount: string;
  };
};

export type LayerswapErrorResponse = {
  success: false;
  error: string;
};

export interface LayerswapCreateSwapRequest {
  sourceNetwork: string;
  destinationNetwork: string;
  sourceToken: string;
  destinationToken: string;
  amount: number;
  sourceAddress: string;
  destinationAddress: string;
  refundAddress?: string;
}

export interface LayerswapCreateSwapResponse {
  data: {
    swap_id: string;
  };
  error: null | {
    message: string;
  };
}

export type BrianTransactionData = {
  type: string;
  bridge?: {
    sourceNetwork: string;
    destinationNetwork: string;
    sourceToken: string;
    destinationToken: string;
    amount: string;
    sourceAddress?: string;
    destinationAddress?: string;
  };
  swap?: {
    // ... swap specific fields
  };
  transfer?: {
    // ... transfer specific fields
  };
};

export type BrianResponse = {
  success: boolean;
  data?: any;
  error?: string;
};

export interface ProcessedTransaction {
  success: boolean;
  description: string;
  transactions: TransactionStep[];
  action: string;
  solver: string;
  fromToken?: BrianToken;
  toToken?: BrianToken;
  fromAmount?: string;
  toAmount?: string;
  receiver?: string;
  estimatedGas: string;
  protocol?: string;
  bridge?: {
    sourceNetwork: string;
    destinationNetwork: string;
    sourceToken: string;
    destinationToken: string;
    amount: string;
    sourceAddress?: string;
    destinationAddress?: string;
  };
}

export interface NostraTokenAddresses {
  [key: string]: {
    token: string;
    iToken: string;
  };
}

export interface LayerswapRoutes {
  source_networks: string[];
  destination_networks: string[];
  tokens: {
    [network: string]: string[];
  };
}