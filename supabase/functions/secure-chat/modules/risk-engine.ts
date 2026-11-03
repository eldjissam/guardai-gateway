import type { SensitiveSpan } from "./detector.ts";

const WEIGHTS: Record<SensitiveSpan["type"], number> = {
  PERSON: 15, EMAIL: 10, PHONE: 10, PAYMENT_CARD: 30, ORGANIZATION: 20, API_KEY: 40,
};
export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

export function calculateRisk(spans: SensitiveSpan[]): { score: number; level: RiskLevel } {
  const score = Math.min(100, spans.reduce((sum, span) => sum + WEIGHTS[span.type], 0));
  return { score, level: score >= 60 ? "HIGH" : score >= 30 ? "MEDIUM" : "LOW" };
}

export function countEntities(spans: SensitiveSpan[]): Record<string, number> {
  return spans.reduce<Record<string, number>>((counts, span) => {
    counts[span.type] = (counts[span.type] ?? 0) + 1;
    return counts;
  }, {});
}
