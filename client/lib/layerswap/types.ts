export interface LayerswapTransaction {
  from_network: string;
  to_network: string;
  asset: string;
  amount: string;
  destination_address: string;
  refuel?: boolean;
}

export interface LayerswapResponse {
  success: boolean;
  error?: string;
  swapId?: string;
  redirectUrl?: string;
}

export interface LayerswapConfig {
  apiKey: string;
  baseUrl: string;
}

export interface SwapStatusResponse {
  id: string;
  status: 'pending' | 'completed' | 'failed';
  error?: string;
}

export const SUPPORTED_NETWORKS = [
  'starknet',
  'ethereum',
  'arbitrum',
  'optimism',
  'base',
  'polygon'
] as const;

export const SUPPORTED_ASSETS = [
  'ETH',
  'USDC',
  'USDT',
  'DAI'
] as const;

export type SupportedNetwork = typeof SUPPORTED_NETWORKS[number];
export type SupportedAsset = typeof SUPPORTED_ASSETS[number];

export interface NetworkConfig {
  name: SupportedNetwork;
  label: string;
  assets: SupportedAsset[];
}

export const NETWORK_CONFIGS: NetworkConfig[] = [
  {
    name: 'starknet',
    label: 'StarkNet',
    assets: ['ETH', 'USDC', 'USDT', 'DAI']
  },
  {
    name: 'ethereum',
    label: 'Ethereum',
    assets: ['ETH', 'USDC', 'USDT', 'DAI']
  },
  {
    name: 'arbitrum',
    label: 'Arbitrum',
    assets: ['ETH', 'USDC', 'USDT']
  },
  {
    name: 'optimism',
    label: 'Optimism',
    assets: ['ETH', 'USDC', 'DAI']
  },
  {
    name: 'base',
    label: 'Base',
    assets: ['ETH', 'USDC']
  },
  {
    name: 'polygon',
    label: 'Polygon',
    assets: ['USDC', 'USDT', 'DAI']
  }
]; 