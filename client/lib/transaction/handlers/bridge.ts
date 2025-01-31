/* eslint-disable @typescript-eslint/no-explicit-any */
import { BrianTransactionData, TransactionStep, LayerswapErrorResponse } from "../types";
import { BaseTransactionHandler } from "./base";
import { LayerswapClient } from "../../layerswap/client";

export class BridgeHandler extends BaseTransactionHandler {
  private layerswapClient: LayerswapClient;

  // Network mapping for Layerswap
  private readonly NETWORK_MAPPING: Record<string, string> = {
    starknet: "starknet_mainnet",
    base: "base_mainnet",
    ethereum: "ethereum_mainnet",
    arbitrum: "arbitrum_mainnet",
    optimism: "optimism_mainnet",
    polygon: "polygon_mainnet",
    zkera: "zkera_mainnet",
    linea: "linea_mainnet",
    scroll: "scroll_mainnet",
    zksync: "zksync_mainnet",
  } as const;

  constructor(apiKey: string) {
    super();
    if (!apiKey) {
      throw new Error('Layerswap API key is required');
    }
    this.layerswapClient = new LayerswapClient(apiKey);
  }

  private formatNetwork(network: string): string {
    const normalized = network.toLowerCase();
    return this.NETWORK_MAPPING[normalized] || `${normalized}_mainnet`;
  }

  private validateAmount(amount: number | string): number {
    const parsedAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      throw new Error('Invalid amount: must be a positive number');
    }
    return parsedAmount;
  }

  private validateAddresses(sourceAddress: string | undefined, destinationAddress: string): void {
    if (!destinationAddress) {
      throw new Error('Destination address is required');
    }

    const addressRegex = /^0x[a-fA-F0-9]{40,64}$/;
    if (!addressRegex.test(destinationAddress)) {
      throw new Error('Invalid destination address format');
    }

    if (sourceAddress && !addressRegex.test(sourceAddress)) {
      throw new Error('Invalid source address format');
    }
  }

  private validateTokens(token1: string | undefined, token2: string | undefined): void {
    if (!token1 || !token2) {
      throw new Error('Both source and destination tokens are required');
    }

    // Basic token format validation
    const tokenRegex = /^[A-Z0-9]+$/;
    if (!tokenRegex.test(token1.toUpperCase()) || !tokenRegex.test(token2.toUpperCase())) {
      throw new Error('Invalid token format');
    }
  }

  async processSteps(
    data: BrianTransactionData,
    params?: any
  ): Promise<TransactionStep[]> {
    try {
      // Extract and validate parameters
      const sourceNetwork = this.formatNetwork(params?.chain || "starknet");
      const destinationNetwork = this.formatNetwork(params?.dest_chain || "base");
      
      // Validate tokens
      this.validateTokens(params?.token1, params?.token2);
      const sourceToken = params.token1.toUpperCase();
      const destinationToken = params.token2.toUpperCase();

      // Extract and validate addresses
      const sourceAddress = data.bridge?.sourceAddress || params?.address;
      const destinationAddress = data.bridge?.destinationAddress || params?.address;
      this.validateAddresses(sourceAddress, destinationAddress);

      // Validate amount
      const amount = this.validateAmount(params?.amount);

      // Create layerswap request
      const request = {
        sourceNetwork,
        destinationNetwork,
        sourceToken,
        destinationToken,
        amount,
        sourceAddress,
        destinationAddress,
      };

      // Log request for debugging
      console.log("Creating Layerswap bridge request:", JSON.stringify(request, null, 2));

      try {
        const response = await this.layerswapClient.createSwap(request);
        console.log("Layerswap bridge response:", JSON.stringify(response, null, 2));

        if (!response.data) {
          throw new Error("Invalid response from Layerswap: missing data");
        }

        const depositActions = response.data.deposit_actions;
        if (!depositActions || depositActions.length === 0) {
          throw new Error("No deposit actions available in Layerswap response");
        }

        const callData = depositActions[0].call_data;
        if (!callData) {
          throw new Error("Missing call data in deposit action");
        }

        try {
          const steps = JSON.parse(callData) as TransactionStep[];
          if (!Array.isArray(steps) || steps.length === 0) {
            throw new Error("Invalid transaction steps in call data");
          }
          return steps;
        } catch (parseError) {
          console.error("Error parsing call data:", parseError);
          throw new Error("Failed to parse transaction steps from Layerswap response");
        }
      } catch (error) {
        if (error instanceof Error) {
          // Handle specific Layerswap errors
          if (error.message?.includes("ROUTE_NOT_FOUND_ERROR")) {
            throw new Error(
              `Bridge route not available from ${sourceToken} on ${params.chain} to ${destinationToken} on ${params.dest_chain}. ` +
              "Consider bridging through an intermediate token like ETH."
            );
          }
          if (error.message?.includes("INSUFFICIENT_LIQUIDITY")) {
            throw new Error(
              `Insufficient liquidity for bridging ${amount} ${sourceToken} from ${params.chain} to ${params.dest_chain}. ` +
              "Try a smaller amount or wait for more liquidity."
            );
          }
          throw error;
        }
        throw new Error("Unknown error occurred while processing bridge request");
      }
    } catch (error) {
      console.error("Bridge processing error:", error);
      throw error;
    }
  }
}
