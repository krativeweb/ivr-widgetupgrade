import dotenv from "dotenv";
dotenv.config();

export const PORT = process.env.PORT || 3775;

export const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
export const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
export const ELEVEN_VOICE_ID = process.env.ELEVENLABS_VOICE_ID;

export const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;
