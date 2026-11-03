export type EntityType = "PERSON" | "EMAIL" | "PHONE" | "PAYMENT_CARD" | "ORGANIZATION" | "API_KEY";

export interface SensitiveSpan {
  type: EntityType;
  start: number;
  end: number;
  value: string;
}

const PRIORITY: Record<EntityType, number> = {
  API_KEY: 100, PAYMENT_CARD: 95, EMAIL: 90, PHONE: 80, PERSON: 65, ORGANIZATION: 60,
};

function addMatches(text: string, regex: RegExp, type: EntityType, target: SensitiveSpan[], group = 0) {
  for (const match of text.matchAll(regex)) {
    const value = match[group];
    if (!value || match.index === undefined) continue;
    const relative = group === 0 ? 0 : match[0].indexOf(value);
    if (relative < 0) continue;
    const start = match.index + relative;
    target.push({ type, start, end: start + value.length, value });
  }
}

function passesLuhn(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let doubleDigit = false;
  for (let index = digits.length - 1; index >= 0; index--) {
    let digit = Number(digits[index]);
    if (doubleDigit) { digit *= 2; if (digit > 9) digit -= 9; }
    sum += digit;
    doubleDigit = !doubleDigit;
  }
  return sum % 10 === 0;
}

function leadingProperName(value: string, minWords: number, maxWords: number): string | null {
  const words = value.trim().split(/\s+/u);
  const selected: string[] = [];
  for (const word of words) {
    const cleanWord = word.replace(/[.,;:!?]+$/u, "");
    if (!cleanWord) break;
    const first = Array.from(cleanWord)[0] ?? "";
    const capitalized = first !== first.toLocaleLowerCase() && first === first.toLocaleUpperCase();
    if (!capitalized) break;
    selected.push(cleanWord);
    // A sentence delimiter ends the entity. Without this, a following
    // capitalized sentence (for example, "My email is...") could be absorbed.
    if (/[.,;:!?]$/u.test(word) || selected.length === maxWords) break;
  }
  return selected.length >= minWords ? selected.join(" ") : null;
}

/** Explainable rule-based detection for the MVP; this is not complete DLP or general-purpose NER. */
export function detectSensitiveSpans(text: string): SensitiveSpan[] {
  const candidates: SensitiveSpan[] = [];
  addMatches(text, /\b(?:sk-[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9]{20,}|xox[baprs]-[A-Za-z0-9-]{10,})\b/g, "API_KEY", candidates);

  for (const match of text.matchAll(/(?<!\d)(?:\d[ -]?){13,19}(?!\d)/g)) {
    if (match.index === undefined || !match[0] || !passesLuhn(match[0])) continue;
    candidates.push({ type: "PAYMENT_CARD", start: match.index, end: match.index + match[0].length, value: match[0] });
  }

  addMatches(text, /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "EMAIL", candidates);

  const phonePattern = /(?:^|[^\p{L}\p{N}])((?:\+?\d{1,3}[\s().-]?)?(?:\d[\s().-]?){7,14}\d)(?!\p{N})/gu;
  for (const match of text.matchAll(phonePattern)) {
    const value = match[1];
    if (!value || match.index === undefined) continue;
    const digits = value.replace(/\D/g, "");
    if (digits.length < 9 || digits.length > 15) continue;
    const start = match.index + match[0].indexOf(value);
    candidates.push({ type: "PHONE", start, end: start + value.length, value });
  }

  const personPattern = /\b(?:my name is|this is|contact person is|i am|i'm)\s+([\p{L}][\p{L}'’.-]*(?:\s+[\p{L}][\p{L}'’.-]*){1,3})/giu;
  for (const match of text.matchAll(personPattern)) {
    const captured = match[1];
    if (!captured || match.index === undefined) continue;
    const proper = leadingProperName(captured, 2, 4);
    if (!proper) continue;
    const start = match.index + match[0].indexOf(captured);
    candidates.push({ type: "PERSON", start, end: start + proper.length, value: proper });
  }

  const organizationPattern = /\b(?:my company is|the company is|company name is|organization is|organisation is|i work at|employed by|my employer is)\s+([\p{L}][\p{L}\p{N}&.'’-]*(?:\s+[\p{L}][\p{L}\p{N}&.'’-]*){0,4})/giu;
  for (const match of text.matchAll(organizationPattern)) {
    const captured = match[1];
    if (!captured || match.index === undefined) continue;
    const proper = leadingProperName(captured, 1, 5);
    if (!proper) continue;
    const start = match.index + match[0].indexOf(captured);
    candidates.push({ type: "ORGANIZATION", start, end: start + proper.length, value: proper });
  }

  candidates.sort((a, b) => PRIORITY[b.type] - PRIORITY[a.type] || a.start - b.start || (b.end - b.start) - (a.end - a.start));
  const accepted: SensitiveSpan[] = [];
  for (const candidate of candidates) {
    if (candidate.start < 0 || candidate.end > text.length || candidate.end <= candidate.start) continue;
    if (accepted.some((item) => candidate.start < item.end && candidate.end > item.start)) continue;
    accepted.push(candidate);
  }
  return accepted.sort((a, b) => a.start - b.start);
}
