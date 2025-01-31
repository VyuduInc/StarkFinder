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
    const { messages, userId } = await request.json();
    const lastMessage = messages[messages.length - 1];
    
    // For documentation, return a mock bridge response
    if (lastMessage.content.toLowerCase().includes('bridge')) {
      return NextResponse.json({
        success: true,
        data: {
          type: "bridge",
          data: {
            sourceNetwork: "starknet",
            destinationNetwork: "ethereum",
            amount: "0.05",
            token: "ETH",
            sourceAddress: "0x123...mock",
            destinationAddress: "0x123...mock"
          }
        }
      });
    }

    return NextResponse.json({
      success: false,
      error: "Only bridge transactions are supported in documentation mode"
    });
  } catch (error) {
    console.error("Error processing transaction:", error);
    return NextResponse.json(
      { success: false, error: "Failed to process transaction" },
      { status: 500 }
    );
  }
}
