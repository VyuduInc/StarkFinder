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

async function getTransactionIntentFromOpenAI(
  prompt: string,
  address: string,
  chainId: string,
  messages: any[]
): Promise<BrianResponse> {
  if (prompt.toLowerCase().includes('bridge')) {
    try {
      // Extract bridging details from the prompt using LLM
      const chain = new LLMChain({
        llm,
        prompt: transactionIntentPromptTemplate,
      });

      const result = await chain.invoke({
        prompt: `${TRANSACTION_INTENT_PROMPT}\n\nUser message: ${prompt}`,
      });

      const parsedResult = new StringOutputParser().parse(result.text);
      
      // Return bridging intent
      return {
        type: 'bridge',
        data: {
          bridge: {
            sourceAddress: address,
            destinationAddress: address,
            sourceNetwork: formatNetwork(chainId),
            destinationNetwork: '', // Will be extracted from prompt
            amount: '', // Will be extracted from prompt
            sourceToken: '', // Will be extracted from prompt
            destinationToken: '', // Will be extracted from prompt
          }
        },
        raw: parsedResult
      };
    } catch (error) {
      console.error('Error processing bridge request:', error);
      throw error;
    }
  }
  throw new Error('Only bridge transactions are supported in documentation mode');
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
    const { messages, userId, type, params } = await request.json();
    const lastMessage = messages[messages.length - 1];

    // Get or create chat
    const chat = await getOrCreateTransactionChat(userId);
    if (!chat) {
      throw new Error("Failed to create or retrieve chat");
    }

    // Store the user's message
    await storeMessage({
      content: messages,
      chatId: chat.id,
      userId,
    });

    // Process transaction based on type
    if (type === "bridge") {
      try {
        // Validate required parameters
        if (!params.chain || !params.dest_chain || !params.amount || !params.address) {
          throw new Error("Missing required parameters for bridge transaction");
        }

        // Create transaction data
        const transactionData: BrianTransactionData = {
          type: "bridge",
          bridge: {
            sourceAddress: params.address,
            destinationAddress: params.address,
          }
        };

        // Process the transaction
        const result = await transactionProcessor.processTransaction(
          transactionData,
          params
        );

        // Store the transaction
        await storeTransaction(userId, "bridge", {
          sourceChain: params.chain,
          destinationChain: params.dest_chain,
          amount: params.amount,
          token: params.token1,
          address: params.address,
          status: "completed",
        });

        return NextResponse.json({
          success: true,
          data: result
        });
      } catch (error: any) {
        console.error("Bridge transaction error:", error);
        return NextResponse.json(
          { 
            success: false, 
            error: error.message || "Failed to process bridge transaction" 
          },
          { status: 400 }
        );
      }
    }

    // For other transaction types, get intent from OpenAI
    const transactionIntent = await getTransactionIntentFromOpenAI(
      lastMessage.content,
      params?.address || "",
      params?.chain || "",
      messages
    );

    // Process the transaction
    const result = await transactionProcessor.processTransaction(
      transactionIntent.data,
      params
    );

    // Store the transaction
    await storeTransaction(userId, transactionIntent.data.type || "unknown", {
      ...transactionIntent.data,
      ...params,
      status: "completed",
    });

    return NextResponse.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    console.error("Error processing transaction:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || "Failed to process transaction" 
      },
      { status: 500 }
    );
  }
}
