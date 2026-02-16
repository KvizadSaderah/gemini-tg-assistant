import { Bot, Context, session, InputFile } from "grammy";
import type { SessionFlavor } from "grammy";
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as dotenv from "dotenv";
import * as googleTTS from "google-tts-api";
import logger from "./logger.js";
import { authManager } from "./auth.js";
import { storage } from "./db.js";

dotenv.config();

interface SessionData {
  history: { role: string; parts: { text: string }[] }[];
  voiceMode: boolean;
  detectedLanguage: string; 
}
type MyContext = Context & SessionFlavor<SessionData>;

const bot = new Bot<MyContext>(process.env.TELEGRAM_BOT_TOKEN || "");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const selectedModel = process.env.GEMINI_MODEL || "gemini-3-flash-preview";

// System instruction is now purely in English
const SYSTEM_INSTRUCTION = "You are a helpful and smart AI assistant. Detect the user's language and respond in the same language. Be concise and accurate.";

const model = genAI.getGenerativeModel({ 
  model: selectedModel,
  tools: [{ googleSearch: {} }] as any,
});

bot.use(session({ initial: (): SessionData => ({ history: [], voiceMode: false, detectedLanguage: 'en' }) }));

async function sendVoiceResponse(ctx: MyContext, text: string) {
    const lang = ctx.session.detectedLanguage || 'en';
    const url = googleTTS.getAudioUrl(text.substring(0, 200), { lang: lang, slow: false, host: 'https://translate.google.com' });
    const response = await fetch(url);
    const buffer = await response.arrayBuffer();
    await ctx.replyWithVoice(new InputFile(Buffer.from(buffer), "response.ogg"));
}

setInterval(async () => {
    const pending = storage.getPendingOutbound() as any[];
    for (const msg of pending) {
        try {
            await bot.api.sendMessage(msg.user_id, `[Admin]: ${msg.content}`);
            storage.markOutboundSent(msg.id);
            logger.info(`Sent admin reply to ${msg.user_id}`);
        } catch (e) {
            logger.error(`Failed to send admin reply`, e);
        }
    }
}, 3000);

bot.command("voice", (ctx) => {
    ctx.session.voiceMode = !ctx.session.voiceMode;
    const msg = ctx.session.voiceMode ? "Voice mode: ON" : "Voice mode: OFF";
    return ctx.reply(msg);
});

bot.on("message:text", async (ctx) => {
  const text = ctx.message.text;
  
  if (ctx.session.history.length === 0) {
      const isRussian = /[а-яА-ЯёЁ]/.test(text);
      ctx.session.detectedLanguage = isRussian ? 'ru' : 'en';
  }

  storage.logMessage(ctx.from.id, ctx.from.username, 'user', text);
  
  try {
    await ctx.replyWithChatAction("typing");

    const chat = model.startChat({ 
        history: ctx.session.history,
        systemInstruction: {
            role: "system",
            parts: [{ text: SYSTEM_INSTRUCTION }]
        }
    });
    
    const result = await chat.sendMessage(text);
    const responseText = result.response.text();
    const usage = result.response.usageMetadata;

    storage.logMessage(
      ctx.from.id, 
      ctx.from.username, 
      'model', 
      responseText, 
      'text', 
      usage?.promptTokenCount || 0, 
      usage?.candidatesTokenCount || 0
    );
    
    ctx.session.history.push({ role: "user", parts: [{ text }] });
    ctx.session.history.push({ role: "model", parts: [{ text: responseText }] });
    if (ctx.session.history.length > 20) ctx.session.history = ctx.session.history.slice(-20);

    if (ctx.session.voiceMode) {
        await sendVoiceResponse(ctx, responseText);
    } else {
        try {
            await ctx.reply(responseText, { parse_mode: "Markdown" });
        } catch (e) {
            logger.warn("Markdown failed, falling back to plain text", { error: e });
            await ctx.reply(responseText);
        }
    }
  } catch (error) {
    logger.error("Gemini Error", { error });
  }
});

bot.on("message:voice", async (ctx) => {
    try {
        await ctx.replyWithChatAction("typing");
        const file = await ctx.api.getFile(ctx.message.voice.file_id);
        const url = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;
        const response = await fetch(url);
        const buffer = await response.arrayBuffer();

        const chat = model.startChat({ 
            history: ctx.session.history,
            systemInstruction: {
                role: "system",
                parts: [{ text: SYSTEM_INSTRUCTION }]
            }
        });

        const result = await chat.sendMessage([
            "Transcribe and answer this message",
            { inlineData: { data: Buffer.from(buffer).toString("base64"), mimeType: "audio/ogg" } }
        ]);

        const responseText = result.response.text();
        storage.logMessage(ctx.from.id, ctx.from.username, 'user', '[Voice Message]', 'voice');
        storage.logMessage(ctx.from.id, ctx.from.username, 'model', responseText);
        
        if (ctx.session.voiceMode) {
            await sendVoiceResponse(ctx, responseText);
        } else {
            await ctx.reply(responseText);
        }
    } catch (e) {
        logger.error("Voice error", e);
    }
});

bot.start();
logger.info("Bot service started");
