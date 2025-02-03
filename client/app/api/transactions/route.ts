/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextResponse, NextRequest } from "next/server";
import { ChatOpenAI } from "@langchain/openai";
import { transactionProcessor } from "@/lib/transaction";
import { LayerswapClient } from "@/lib/layerswap/client";

import type {
  BrianResponse,
  BrianTransactionData,
  LayerswapSuccessResponse,
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

const layerswapApiKey = process.env.LAYERSWAP_API_KEY;
if (!layerswapApiKey) {
  throw new Error('LAYERSWAP_API_KEY is required in environment variables');
}

const layerswapClient = new LayerswapClient(layerswapApiKey);

// Network mapping for common names to Layerswap format
const NETWORK_MAPPING: Record<string, string> = {
  starknet: "starknet_mainnet",
  ethereum: "ethereum_mainnet",
  base: "base_mainnet",
  arbitrum: "arbitrum_mainnet",
  optimism: "optimism_mainnet",
  polygon: "polygon_mainnet",
  zkera: "zkera_mainnet",
  linea: "linea_mainnet",
  scroll: "scroll_mainnet",
  zksync: "zksync_mainnet",
};

function formatNetwork(network: string): string {
  const normalized = network.toLowerCase();
  return NETWORK_MAPPING[normalized] || `${normalized}_mainnet`;
}

async function getAvailableTokens(sourceNetwork: string, destinationNetwork: string): Promise<string[]> {
  try {
    const routes = await layerswapClient.getAvailableRoutes();
    const route = routes.routes.find(
      r => r.source_network === sourceNetwork && r.destination_network === destinationNetwork
    );

    if (!route) {
      throw new Error(`No available route found for ${sourceNetwork} -> ${destinationNetwork}`);
    }

    // Return intersection of source and destination tokens
    return route.source_tokens.filter(token => route.destination_tokens.includes(token));
  } catch (error) {
    console.error('Error fetching available tokens:', error);
    return ['ETH']; // Default to ETH if we can't fetch tokens
  }
}

async function processBridgeTransaction(bridgeData: BrianTransactionData['bridge']): Promise<LayerswapSuccessResponse> {
  if (!bridgeData) {
    throw new Error('Bridge data is required');
  }

  try {
    const response = await layerswapClient.createSwap({
      sourceNetwork: formatNetwork(bridgeData.sourceNetwork),
      destinationNetwork: formatNetwork(bridgeData.destinationNetwork),
      sourceToken: bridgeData.sourceToken,
      destinationToken: bridgeData.destinationToken,
      amount: bridgeData.amount,
      sourceAddress: bridgeData.sourceAddress,
      destinationAddress: bridgeData.destinationAddress,
    });

    return response;
  } catch (error) {
    console.error('Error processing bridge transaction:', error);
    throw error;
  }
}

async function getTransactionIntentFromOpenAI(
  prompt: string,
  address: string,
  chainId: string,
  messages: any[]
): Promise<BrianResponse> {
  try {
    const lastMessage = messages[messages.length - 1];
    const isSelectingToken = lastMessage?.content?.toLowerCase().includes('select coin');

    // If user is selecting a token, get available tokens for the route
    if (isSelectingToken) {
      const sourceNetwork = formatNetwork('starknet');
      const destinationNetwork = formatNetwork('base'); // Default to Base, can be changed based on user preference
      const availableTokens = await getAvailableTokens(sourceNetwork, destinationNetwork);
      
      return {
        isTransactionIntent: true,
        solver: "brian",
        action: "bridge",
        type: "write",
        extractedParams: {
          action: "bridge",
          token1: "",
          token2: "",
          chain: "starknet",
          dest_chain: "base",
          amount: "",
          protocol: "",
          address: "",
          destinationAddress: "",
        },
        data: {
          description: `Available tokens for bridging:\n${availableTokens.join(', ')}\n\nPlease choose a token to bridge.`,
          steps: [],
        },
      };
    }

    const formattedPrompt = TRANSACTION_INTENT_PROMPT.replace(
      "{user_prompt}",
      prompt
    );

    const response = await llm.invoke(formattedPrompt);
    const responseText = response.content;

    try {
      return JSON.parse(responseText);
    } catch (error) {
      console.error("Error parsing OpenAI response:", error);
      throw new Error("Failed to parse transaction intent");
    }
  } catch (error) {
    console.error("Error getting transaction intent:", error);
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
    const body = await request.json();
    const { prompt, address, chainId, messages, userId, type, fromAmount, fromCoin, toCoin } = body;

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    const chat = await getOrCreateTransactionChat(userId);

    if (type === "bridge") {
      if (!fromAmount || !fromCoin || !toCoin) {
        return NextResponse.json(
          { error: "Missing required transaction parameters" },
          { status: 400 }
        );
      }

      // Validate networks for bridging
      if (fromCoin.network === toCoin.network) {
        return NextResponse.json(
          { error: "Cannot bridge between the same network" },
          { status: 400 }
        );
      }

      // Validate supported networks
      const supportedNetworks = ["sepolia", "starknet_sepolia"];
      if (!supportedNetworks.includes(fromCoin.network) || !supportedNetworks.includes(toCoin.network)) {
        return NextResponse.json(
          { error: "Unsupported network for bridging" },
          { status: 400 }
        );
      }

      // Initialize Layerswap client and create bridge transaction
      const layerswapClient = new LayerswapClient();
      const bridgeResponse = await layerswapClient.createBridgeTransaction({
        fromNetwork: fromCoin.network,
        toNetwork: toCoin.network,
        fromToken: fromCoin.symbol,
        toToken: toCoin.symbol,
        amount: fromAmount
      });

      // Store the bridge transaction
      await storeTransaction(userId, 'BRIDGE', {
        sourceNetwork: fromCoin.network,
        destinationNetwork: toCoin.network,
        sourceToken: fromCoin.symbol,
        destinationToken: toCoin.symbol,
        amount: fromAmount,
        layerswapId: bridgeResponse.data.id,
        status: bridgeResponse.data.status,
      });

      // Store the message
      await storeMessage({
        content: messages,
        chatId: chat.id,
        userId,
      });

      return NextResponse.json({
        success: true,
        action: 'bridge',
        data: bridgeResponse.data,
      });
    }

    // For other transaction types
    const intentResponse = await getTransactionIntentFromOpenAI(
      prompt,
      address,
      chainId,
      messages
    );

    const result = await transactionProcessor.processTransaction(
      intentResponse.data,
      {
        chain: intentResponse.extractedParams.chain,
        dest_chain: intentResponse.extractedParams.dest_chain,
        amount: intentResponse.extractedParams.amount,
        token1: intentResponse.extractedParams.token1,
        token2: intentResponse.extractedParams.token2,
        protocol: intentResponse.extractedParams.protocol,
        address: intentResponse.extractedParams.address,
        destinationAddress: intentResponse.extractedParams.destinationAddress,
      }
    );

    // Store the transaction
    await storeTransaction(userId, intentResponse.action as TxType, {
      ...intentResponse.data,
      ...{
        chain: intentResponse.extractedParams.chain,
        dest_chain: intentResponse.extractedParams.dest_chain,
        amount: intentResponse.extractedParams.amount,
        token1: intentResponse.extractedParams.token1,
        token2: intentResponse.extractedParams.token2,
        protocol: intentResponse.extractedParams.protocol,
        address: intentResponse.extractedParams.address,
        destinationAddress: intentResponse.extractedParams.destinationAddress,
      },
      status: "completed",
    });

    // Store the message
    await storeMessage({
      content: messages,
      chatId: chat.id,
      userId,
    });

    return NextResponse.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error("Error processing transaction:", error);
    return NextResponse.json(
      { error: "Failed to process transaction" },
      { status: 500 }
    );
  }
}
