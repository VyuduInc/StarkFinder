"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const grammy_1 = require("grammy");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const token = process.env.MY_TOKEN;
const BRIAN_API_KEY = process.env.BRIAN_API_KEY;
if (!token)
    throw new Error("BOT_TOKEN is required");
if (!BRIAN_API_KEY)
    throw new Error("BRIAN_API_KEY is required");
const BRIAN_API_URL = {
    knowledge: "https://api.brianknows.org/api/v0/agent/knowledge",
    parameters: "https://api.brianknows.org/api/v0/agent/parameters-extraction",
    transaction: "https://api.brianknows.org/api/v0/agent",
};
function queryBrianAI(prompt) {
    return __awaiter(this, void 0, void 0, function* () {
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
    });
}
const bot = new grammy_1.Bot(token);
bot.command("start", (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    yield ctx.reply("Welcome to StarkFinder Test Bot! 🚀\nI can help you with bridging and other Starknet operations.");
}));
bot.on("message:text", (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    const text = ctx.message.text;
    if (text.toLowerCase().includes("bridge")) {
        yield ctx.reply("Processing your bridge request... 🔄");
        const response = yield queryBrianAI(text);
        yield ctx.reply(response);
    }
}));
console.log("Starting bot...");
bot.start();
