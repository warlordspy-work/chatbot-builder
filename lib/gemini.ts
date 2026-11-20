import { GoogleGenAI } from '@google/genai';

export const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY!,
    httpOptions: { apiVersion: 'v1beta' },
});
export const MODEL = process.env.GEMINI_MODEL!;