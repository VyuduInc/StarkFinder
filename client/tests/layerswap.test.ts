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
});
