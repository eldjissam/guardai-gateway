import type { SensitiveSpan } from "./detector.ts";

export interface PublicEntity {
  type: SensitiveSpan["type"];
  start: number;
  end: number;
  token: string;
  label: string;
}

export interface TokenizationResult {
  sanitizedPrompt: string;
  /** Token -> original value. This map must remain in request memory only. */
  mapping: Map<string, string>;
  entities: PublicEntity[];
}

const LABELS: Record<SensitiveSpan["type"], string> = {
  PERSON: "Person name", EMAIL: "Email address", PHONE: "Phone number",
  PAYMENT_CARD: "Payment card", ORGANIZATION: "Organization", API_KEY: "API credential",
};
const CODES: Record<SensitiveSpan["type"], string> = {
  PERSON: "PERSON", EMAIL: "EMAIL", PHONE: "PHONE",
  PAYMENT_CARD: "CARD", ORGANIZATION: "ORG", API_KEY: "API_KEY",
};

export function tokenizePrompt(originalPrompt: string, spans: SensitiveSpan[], requestId: string): TokenizationResult {
  const mapping = new Map<string, string>();
  const tokenByValue = new Map<string, string>();
  const counts: Record<string, number> = {};
  const entities: PublicEntity[] = [];
  const tag = requestId.replaceAll("-", "").slice(0, 10).toUpperCase();
  let sanitizedPrompt = "";
  let cursor = 0;

  for (const span of spans) {
    if (span.start < cursor || span.end > originalPrompt.length) continue;
    const key = `${span.type}:${span.value.toLocaleLowerCase()}`;
    let token = tokenByValue.get(key);
    if (!token) {
      counts[span.type] = (counts[span.type] ?? 0) + 1;
      token = `[[GAI_${tag}_${CODES[span.type]}_${counts[span.type]}]]`;
      tokenByValue.set(key, token);
      mapping.set(token, span.value);
    }
    sanitizedPrompt += originalPrompt.slice(cursor, span.start) + token;
    cursor = span.end;
    entities.push({ type: span.type, start: span.start, end: span.end, token, label: LABELS[span.type] });
  }
  sanitizedPrompt += originalPrompt.slice(cursor);
  return { sanitizedPrompt, mapping, entities };
}
