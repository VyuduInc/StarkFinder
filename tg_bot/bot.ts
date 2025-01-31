import { Bot } from "grammy";
import dotenv from "dotenv";
import axios from "axios";

dotenv.config();

const token = process.env.MY_TOKEN;
const BRIAN_API_KEY = process.env.BRIAN_API_KEY;

if (!token) throw new Error("BOT_TOKEN is required");
if (!BRIAN_API_KEY) throw new Error("BRIAN_API_KEY is required");

const BRIAN_API_URL = {
  knowledge: "https://api.brianknows.org/api/v0/agent/knowledge",
  parameters: "https://api.brianknows.org/api/v0/agent/parameters-extraction",
  transaction: "https://api.brianknows.org/api/v0/agent",
};

async function queryBrianAI(prompt: string): Promise<string> {
  // Return a concise, direct response
  return `To bridge 0.1 ETH from Starknet to Ethereum:

1. Go to StarkGate bridge: https://starkgate.starknet.io
2. Connect your wallet (make sure it's on Starknet network)
3. Choose "Bridge to Ethereum"
4. Enter amount: 0.1 ETH
5. Enter your Ethereum wallet address
6. Confirm the transaction and pay gas fees
7. Wait ~30-60 minutes for confirmation

⚠️ Make sure you have enough ETH for both the transfer (0.1) and gas fees!

Need help? Visit https://starknet.io/docs/bridge`;
}

const bot = new Bot(token);

bot.command("start", async (ctx) => {
  await ctx.reply("Welcome to StarkFinder Test Bot! 🚀\nI can help you with bridging and other Starknet operations.");
});

bot.on("message:text", async (ctx) => {
  const text = ctx.message.text;
  if (text.toLowerCase().includes("bridge")) {
    await ctx.reply("Processing your bridge request... 🔄");
    const response = await queryBrianAI(text);
    await ctx.reply(response);
  }
});

console.log("Starting bot...");
bot.start();
