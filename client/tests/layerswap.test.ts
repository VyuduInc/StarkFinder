import { LayerswapClient } from '../lib/layerswap/client';
import { LayerswapCreateSwapRequest } from '../lib/transaction/types';
import { jest, expect, describe, test, beforeEach } from '@jest/globals';

describe('LayerswapClient', () => {
    let client: LayerswapClient;
    
    const mockSwapRequest: LayerswapCreateSwapRequest = {
        sourceNetwork: 'ethereum_sepolia',
        destinationNetwork: 'starknet_sepolia',
        sourceToken: 'ETH',
        destinationToken: 'ETH',
        amount: 0.001,
        sourceAddress: '0x3ac9997Ef1CAE6E0D87A068d3B5df9dD276eb8C5',
        destinationAddress: '0x1234567890abcdef1234567890abcdef12345678'
    };

    beforeEach(() => {
        client = new LayerswapClient('test-api-key');
    });

    test('should create a swap', async () => {
        const mockResponse = new Response(
            JSON.stringify({
                data: {
                    id: 'test-swap-id',
                    status: 'created',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    source_network: 'ethereum_sepolia',
                    destination_network: 'starknet_sepolia',
                    source_token: 'ETH',
                    destination_token: 'ETH',
                    amount: 0.001,
                    source_address: '0x3ac9997Ef1CAE6E0D87A068d3B5df9dD276eb8C5',
                    destination_address: '0x1234567890abcdef1234567890abcdef12345678'
                }
            }),
            { status: 200 }
        );

        global.fetch = jest.fn().mockResolvedValue(mockResponse);

        const result = await client.createSwap(mockSwapRequest);
        expect(result.data.id).toBe('test-swap-id');
        expect(result.data.status).toBe('created');
    });

    test('should handle error response', async () => {
        const mockErrorResponse = new Response(
            JSON.stringify({
                error: 'Invalid request'
            }),
            { status: 400 }
        );

        global.fetch = jest.fn().mockResolvedValue(mockErrorResponse);

        await expect(client.createSwap(mockSwapRequest))
            .rejects.toThrow('Invalid request');
    });

    test('should validate routes before creating swap', async () => {
        // Mock available routes
        const mockRoutesResponse = new Response(
            JSON.stringify({
                routes: [{
                    source_network: 'ethereum_sepolia',
                    destination_network: 'starknet_sepolia',
                    source_tokens: ['ETH'],
                    destination_tokens: ['ETH']
                }]
            }),
            { status: 200 }
        );

        // Mock successful swap creation
        const mockSwapResponse = new Response(
            JSON.stringify({
                data: {
                    id: 'test-swap-id',
                    status: 'created'
                }
            }),
            { status: 200 }
        );

        global.fetch = jest.fn()
            .mockResolvedValueOnce(mockRoutesResponse)
            .mockResolvedValueOnce(mockSwapResponse);

        const result = await client.createSwap(mockSwapRequest);
        expect(result.data.id).toBe('test-swap-id');
        expect(fetch).toHaveBeenCalledTimes(2);
    });

    test('should throw error for invalid route', async () => {
        const mockRoutesResponse = new Response(
            JSON.stringify({
                routes: [{
                    source_network: 'ethereum_mainnet',
                    destination_network: 'starknet_mainnet',
                    source_tokens: ['ETH'],
                    destination_tokens: ['ETH']
                }]
            }),
            { status: 200 }
        );

        global.fetch = jest.fn().mockResolvedValueOnce(mockRoutesResponse);

        await expect(client.createSwap(mockSwapRequest))
            .rejects.toThrow('Invalid route');
    });

    test('should enforce rate limiting', async () => {
        const mockResponse = new Response(
            JSON.stringify({ routes: [] }),
            { status: 200 }
        );

        global.fetch = jest.fn().mockResolvedValue(mockResponse);

        const start = Date.now();
        await client.getAvailableRoutes();
        await client.getAvailableRoutes();
        const duration = Date.now() - start;

        expect(duration).toBeGreaterThanOrEqual(1000); // MIN_REQUEST_INTERVAL
    });

    test('should get swap status', async () => {
        const mockResponse = new Response(
            JSON.stringify({
                data: {
                    id: 'test-swap-id',
                    status: 'completed',
                    transaction_id: '0x123'
                }
            }),
            { status: 200 }
        );

        global.fetch = jest.fn().mockResolvedValue(mockResponse);

        const result = await client.getSwapStatus('test-swap-id');
        expect(result.data.status).toBe('completed');
        expect(result.data.transaction_id).toBe('0x123');
    });
});
