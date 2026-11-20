import { GoogleAuth } from 'google-auth-library';

// Privacy shield: hides personal data in a customer's message before it goes to Gemini.
// Layer 1 (always on, instant): pattern checks for card, Aadhaar, PAN, phone, email.
// Layer 2 (when set up): Google Cloud Sensitive Data Protection (DLP) catches the rest.
// If Cloud DLP is not set up or is down, layer 1 still protects the chat. It never breaks the chat.

export type Shielded = { text: string; found: string[]; engine: 'cloud-dlp' | 'local' };

const LABEL: Record<string, string> = {
  CREDIT_CARD_NUMBER: 'card number',
  INDIA_AADHAAR_INDIVIDUAL: 'Aadhaar number',
  INDIA_PAN_INDIVIDUAL: 'PAN',
  INDIA_PASSPORT: 'passport number',
  PHONE_NUMBER: 'phone number',
  EMAIL_ADDRESS: 'email address',
};
const INFO_TYPES = Object.keys(LABEL);

function luhn(digits: string): boolean {
  let sum = 0;
  let dbl = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = Number(digits[i]);
    if (dbl) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    dbl = !dbl;
  }
  return sum % 10 === 0;
}

export function localShield(input: string): Shielded {
  const found = new Set<string>();
  let text = input;
  const swap = (re: RegExp, type: string, ok?: (m: string) => boolean) => {
    text = text.replace(re, (m) => {
      if (ok && !ok(m)) return m;
      found.add(type);
      return `[${type}]`;
    });
  };
  swap(/\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g, 'EMAIL_ADDRESS');
  swap(/\b\d(?:[ -]?\d){12,18}\b/g, 'CREDIT_CARD_NUMBER', (m) => luhn(m.replace(/\D/g, '')));
  swap(/\b[2-9]\d{3}[ -]?\d{4}[ -]?\d{4}\b/g, 'INDIA_AADHAAR_INDIVIDUAL');
  swap(/\b[A-Z]{5}\d{4}[A-Z]\b/g, 'INDIA_PAN_INDIVIDUAL');
  swap(/(?<![\d])(?:\+?91[ -]?)?[6-9]\d{4}[ -]?\d{5}(?!\d)/g, 'PHONE_NUMBER');
  return { text, found: [...found], engine: 'local' };
}

let auth: GoogleAuth | null = null;
let pausedUntil = 0; // after a failure, skip Cloud DLP briefly so chat stays fast

function getAuth(): GoogleAuth {
  if (!auth) {
    const json = process.env.GCP_SERVICE_ACCOUNT_JSON;
    auth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
      ...(json ? { credentials: JSON.parse(json) } : {}),
    });
  }
  return auth;
}

async function cloudShield(text: string): Promise<{ text: string; found: string[] } | null> {
  if (process.env.DLP_MODE === 'off' || Date.now() < pausedUntil) return null;
  try {
    const a = getAuth();
    const project = process.env.GOOGLE_CLOUD_PROJECT || (await a.getProjectId());
    const client = await a.getClient();
    const token = (await client.getAccessToken()).token;
    const res = await fetch(`https://dlp.googleapis.com/v2/projects/${project}/locations/global/content:deidentify`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(3000),
      body: JSON.stringify({
        item: { value: text },
        inspectConfig: { infoTypes: INFO_TYPES.map((name) => ({ name })), minLikelihood: 'POSSIBLE' },
        deidentifyConfig: {
          infoTypeTransformations: { transformations: [{ primitiveTransformation: { replaceWithInfoTypeConfig: {} } }] },
        },
      }),
    });
    if (!res.ok) throw new Error(`DLP ${res.status}`);
    const data = await res.json();
    const found: string[] = (data.overview?.transformationSummaries ?? [])
      .map((s: { infoType?: { name?: string } }) => s.infoType?.name)
      .filter(Boolean);
    return { text: data.item?.value ?? text, found };
  } catch (e) {
    console.error('[dlp] Cloud DLP unavailable, using local shield:', e instanceof Error ? e.message : e);
    pausedUntil = Date.now() + 60_000;
    return null;
  }
}

export async function shield(input: string): Promise<Shielded> {
  const local = localShield(input);
  const cloud = await cloudShield(local.text);
  if (!cloud) return local;
  return { text: cloud.text, found: [...new Set([...local.found, ...cloud.found])], engine: 'cloud-dlp' };
}

export const shieldLabel = (t: string) => LABEL[t] ?? t.toLowerCase().replace(/_/g, ' ');
