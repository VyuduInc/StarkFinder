/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextResponse, NextRequest } from "next/server";
import { ChatOpenAI } from "@langchain/openai";
import { transactionProcessor } from "@/lib/transaction";
import { LayerswapClient } from "@/lib/layerswap/client";

import type {
  BrianResponse,
  BrianTransactionData,
  LayerswapErrorResponse,
} from "@/lib/transaction/types";
import {
  TRANSACTION_INTENT_PROMPT,
  transactionIntentPromptTemplate,
} from "@/prompts/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import prisma from "@/lib/db";
import { TxType } from "@prisma/client";

const llm = new ChatOpenAI({
  model: "gpt-4",
  apiKey: process.env.OPENAI_API_KEY,
});

const layerswapClient = new LayerswapClient(process.env.LAYERSWAP_API_KEY || '');

// Network mapping for common names to Layerswap format
const NETWORK_MAPPING: Record<string, string> = {
  starknet: "starknet_mainnet",
  ethereum: "ethereum_mainnet",
  base: "base_mainnet",
  arbitrum: "arbitrum_mainnet",
  optimism: "optimism_mainnet",
  polygon: "polygon_mainnet",
};

function formatNetwork(network: string): string {
  const normalized = network.toLowerCase();
  return NETWORK_MAPPING[normalized] || `${normalized}_mainnet`;
}

async function getTransactionIntentFromOpenAI(
  prompt: string,
  address: string,
  chainId: string,
  messages: any[]
): Promise<BrianResponse> {
  try {
    const conversationHistory = messages
      .map((msg) => `${msg.role}: ${msg.content}`)
      .join("\n");

    const formattedPrompt = await transactionIntentPromptTemplate.format({
      TRANSACTION_INTENT_PROMPT,
      prompt,
      chainId,
      conversationHistory,
    });

    const jsonOutputParser = new StringOutputParser();
    const response = await llm.pipe(jsonOutputParser).invoke(formattedPrompt);
    const intentData = JSON.parse(response);

    if (!intentData.isTransactionIntent) {
      throw new Error("Not a transaction-related prompt");
    }

    const intentResponse: BrianResponse = {
      solver: intentData.solver || "OpenAI-Intent-Recognizer",
      action: intentData.action,
      type: "write",
      extractedParams: {
        action: intentData.extractedParams.action,
        token1: intentData.extractedParams.token1 || "",
        token2: intentData.extractedParams.token2 || "",
        chain: intentData.extractedParams.chain || "",
        amount: intentData.extractedParams.amount || "",
        protocol: intentData.extractedParams.protocol || "",
        address: intentData.extractedParams.address || address,
        dest_chain: intentData.extractedParams.dest_chain || "",
        destinationChain: intentData.extractedParams.dest_chain || "",
        destinationAddress:
          intentData.extractedParams.destinationAddress || address,
      },
      data: {} as BrianTransactionData,
    };

    const value = 10 ** 18;
    
    // Validate amount
    const amount = parseFloat(intentData.extractedParams.amount);
    if (isNaN(amount) || amount <= 0 || !isFinite(amount)) {
      throw new Error('Invalid amount specified');
    }
    
    // Validate addresses if present
    if (intentData.extractedParams.address && !/^0x[a-fA-F0-9]{40,64}$/.test(intentData.extractedParams.address)) {
      throw new Error('Invalid source address format');
    }
    if (intentData.extractedParams.destinationAddress && !/^0x[a-fA-F0-9]{40,64}$/.test(intentData.extractedParams.destinationAddress)) {
      throw new Error('Invalid destination address format');
    }

    const weiAmount = BigInt(amount * value);

    switch (intentData.action) {
      case "bridge":
        // Format networks to match Layerswap expectations
        const sourceNetwork = formatNetwork(intentData.extractedParams.chain || "starknet");
        const destinationNetwork = formatNetwork(
          intentData.extractedParams.dest_chain || 
          intentData.extractedParams.destinationChain || 
          "ethereum"
        );

        // Validate tokens
        const sourceToken = intentData.extractedParams.token1?.toUpperCase();
        const destinationToken = (intentData.extractedParams.token2 || intentData.extractedParams.token1)?.toUpperCase();
        
        if (!sourceToken || !destinationToken) {
          throw new Error("Source and destination tokens are required for bridging");
        }

        // Validate addresses
        const sourceAddress = intentData.extractedParams.address || address;
        const destinationAddress = intentData.extractedParams.destinationAddress || 
                                 intentData.extractedParams.address || 
                                 address;

        if (!/^0x[a-fA-F0-9]{40,64}$/.test(destinationAddress)) {
          throw new Error("Invalid destination address format");
        }

        // Validate amount
        const bridgeAmount = parseFloat(intentData.extractedParams.amount);
        if (isNaN(bridgeAmount) || bridgeAmount <= 0) {
          throw new Error("Invalid bridge amount");
        }

        // Check minimum bridge amount
        const minBridgeAmount = parseFloat(process.env.NEXT_PUBLIC_MIN_BRIDGE_AMOUNT || "0.01");
        const maxBridgeAmount = parseFloat(process.env.NEXT_PUBLIC_MAX_BRIDGE_AMOUNT || "1000");
        
        if (bridgeAmount < minBridgeAmount) {
          throw new Error(`Bridge amount must be at least ${minBridgeAmount}`);
        }
        if (bridgeAmount > maxBridgeAmount) {
          throw new Error(`Bridge amount cannot exceed ${maxBridgeAmount}`);
        }

        // Create bridge request data
        const bridgeRequest = {
          sourceNetwork,
          destinationNetwork,
          sourceToken,
          destinationToken,
          amount: bridgeAmount,
          sourceAddress,
          destinationAddress,
        };

        try {
          // Validate route with Layerswap
          await layerswapClient.getAvailableRoutes();
          
          // Set bridge data
          intentResponse.data = {
            description: `Bridge ${bridgeAmount} ${sourceToken} from ${sourceNetwork} to ${destinationNetwork}`,
            steps: [],
            bridge: bridgeRequest
          };
        } catch (error) {
          if (error instanceof Error) {
            if (error.message?.includes("ROUTE_NOT_FOUND_ERROR")) {
              throw new Error(
                `Bridge route not available from ${sourceToken} on ${sourceNetwork} to ${destinationToken} on ${destinationNetwork}. ` +
                "Consider bridging through an intermediate token like ETH."
              );
            }
            throw error;
          }
          throw new Error("Failed to validate bridge route");
        }
        break;

      case "swap":
      case "transfer":
        intentResponse.data = {
          description: intentData.data?.description || "",
          steps:
            intentData.extractedParams.transaction?.contractAddress ||
            intentData.extractedParams.transaction?.entrypoint ||
            intentData.extractedParams.transaction?.calldata
              ? [
                  {
                    contractAddress:
                      intentData.extractedParams.transaction.contractAddress,
                    entrypoint:
                      intentData.extractedParams.transaction.entrypoint,
                    calldata: [
                      intentData.extractedParams.destinationAddress ||
                        intentData.extractedParams.address,
                      weiAmount.toString(),
                      "0",
                    ],
                  },
                ]
              : [],
          fromToken: {
            symbol: intentData.extractedParams.token1 || "",
            address: intentData.extractedParams.address || "",
            decimals: 1,
          },
          toToken: {
            symbol: intentData.extractedParams.token2 || "",
            address: intentData.extractedParams.address || "",
            decimals: 1,
          },
          fromAmount: intentData.extractedParams.amount,
          toAmount: intentData.extractedParams.amount,
          receiver: intentData.extractedParams.address,
          amountToApprove: intentData.data?.amountToApprove,
          gasCostUSD: intentData.data?.gasCostUSD,
        };
        break;

      case "deposit":
      case "withdraw":
        intentResponse.data = {
          description: "",
          steps: [],
          protocol: intentData.extractedParams.protocol || "",
          fromAmount: intentData.extractedParams.amount,
          toAmount: intentData.extractedParams.amount,
          receiver: intentData.extractedParams.address || "",
        };
        break;

      default:
        throw new Error(`Unsupported action type: ${intentData.action}`);
    }

    return intentResponse;
  } catch (error) {
    console.error("Error fetching transaction intent:", error);
    throw error;
  }
}

async function getOrCreateTransactionChat(userId: string) {
  try {
    const chat = await prisma.chat.create({
      data: {
        userId,
        type: "TRANSACTION",
      },
    })
    return chat
  } catch (error) {
    console.error("Error creating transaction chat:", error)
    throw error
  }
}

async function storeTransaction(userId: string, type: string, metadata: any) {
  try {
    const transaction = await prisma.transaction.create({
      data: {
        userId,
        type: type as TxType,
        metadata,
      },
    })
    return transaction
  } catch (error) {
    console.error("Error storing transaction:", error)
    throw error
  }
}

async function storeMessage({
  content,
  chatId,
  userId,
}: {
  content: any[]
  chatId: string
  userId: string
}) {
  try {
    const message = await prisma.message.create({
      data: {
        content,
        chatId,
        userId,
      },
    })
    return message
  } catch (error) {
    console.error("Error storing message:", error)
    throw error
  }
}

export async function POST(request: NextRequest) {
  try {
    const { prompt, address, chainId, messages, userId } = await request.json();

    // Get transaction intent
    const intentResponse = await getTransactionIntentFromOpenAI(
      prompt,
      address,
      chainId,
      messages
    );

    // Process transaction based on intent
    try {
      const result = await transactionProcessor.process(intentResponse);

      // Store transaction in database
      const txType = intentResponse.action.toUpperCase() as TxType;
      const transaction = await storeTransaction(userId, txType, {
        prompt,
        intent: intentResponse,
        result,
      });

      // Get or create chat
      const chat = await getOrCreateTransactionChat(userId);

      // Store messages
      await storeMessage({
        content: messages,
        chatId: chat.id,
        userId,
      });

      return NextResponse.json({
        success: true,
        data: result,
        transaction,
      });
    } catch (error) {
      if (error instanceof Error) {
        // Handle Layerswap specific errors
        if (error.message?.includes("ROUTE_NOT_FOUND_ERROR")) {
          return NextResponse.json({
            success: false,
            error: "Bridge route not available. Try a different token or network.",
          }, { status: 400 });
        }
        if (error.message?.includes("INSUFFICIENT_LIQUIDITY")) {
          return NextResponse.json({
            success: false,
            error: "Insufficient liquidity for bridge. Try a smaller amount or wait.",
          }, { status: 400 });
        }
      }
      
      throw error;
    }
  } catch (error) {
    console.error("Transaction processing error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to process transaction" },
      { status: 500 }
    );
  }
}
