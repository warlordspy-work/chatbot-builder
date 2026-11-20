import { GoogleGenAI } from '@google/genai';

export const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY!,
    httpOptions: { apiVersion: 'v1beta' },
});
export const MODEL = process.env.GEMINI_MODEL!;

type GenParams = Parameters<typeof ai.models.generateContent>[0];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const busy = (e: unknown) => /503|429|UNAVAILABLE|overloaded|high demand|RESOURCE_EXHAUSTED|quota/i.test(String((e as Error)?.message ?? e));

// Gemini sometimes answers "503 busy". Retry, then try backup models before giving up.
export async function generate(params: Omit<GenParams, 'model'>) {
  const models = [MODEL, 'gemini-2.5-flash', 'gemini-flash-lite-latest'].filter(
    (m, i, a): m is string => !!m && a.indexOf(m) === i
  );
  let last: unknown;
  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await ai.models.generateContent({ ...params, model } as GenParams);
      } catch (e) {
        last = e;
        if (!busy(e)) throw e;
        await sleep(700 * (attempt + 1));
      }
    }
  }
  throw last;
}
