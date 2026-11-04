import test from "node:test";
import assert from "node:assert/strict";
import { detectSensitiveSpans, type SensitiveSpan } from "./detector.ts";
import { tokenizePrompt } from "./tokenizer.ts";
import { calculateRisk, countEntities } from "./risk-engine.ts";
import {
  containsUnresolvedGuardToken,
  maskUnresolvedGuardTokens,
  restoreKnownTokens,
} from "./restoration.ts";

test("detects supported synthetic PII and secret patterns", () => {
  const prompt = [
    "My name is Jean Dupont.",
    "My email is jean@example.test.",
    "My company is ABC Technologies.",
    "Call me at +250 788 123 456.",
    "Synthetic test card: 4111 1111 1111 1111.",
    "Synthetic API key: sk-test-abcdefghijklmnop.",
  ].join(" ");

  const spans = detectSensitiveSpans(prompt);
  const types = new Set(spans.map((span) => span.type));
  for (const expected of ["PERSON", "EMAIL", "ORGANIZATION", "PHONE", "PAYMENT_CARD", "API_KEY"]) {
    assert.ok(types.has(expected as SensitiveSpan["type"]), `expected detector to identify ${expected}`);
  }
  for (const span of spans) {
    assert.equal(prompt.slice(span.start, span.end), span.value, `span offsets should match ${span.type}`);
  }
  for (let index = 1; index < spans.length; index++) {
    assert.ok(spans[index - 1].end <= spans[index].start, "accepted sensitive spans must not overlap");
  }
});

test("rejects a synthetic payment-card number that fails Luhn validation", () => {
  const spans = detectSensitiveSpans("Synthetic invalid card: 4111 1111 1111 1112");
  assert.equal(spans.some((span) => span.type === "PAYMENT_CARD"), false);
});

test("tokenization removes detected values from the outbound prompt", () => {
  const prompt = "My name is Jean Dupont and my email is jean@example.test.";
  const spans = detectSensitiveSpans(prompt);
  const result = tokenizePrompt(prompt, spans, "01234567-89ab-cdef-0123-456789abcdef");

  assert.ok(result.sanitizedPrompt.includes("[[GAI_"));
  assert.equal(result.sanitizedPrompt.includes("Jean Dupont"), false);
  assert.equal(result.sanitizedPrompt.includes("jean@example.test"), false);
  assert.equal(result.mapping.size, 2);
  assert.equal(result.entities.length, 2);
  assert.equal(restoreKnownTokens(result.sanitizedPrompt, result.mapping), prompt);
});

test("repeated identical values reuse a request-local token", () => {
  const prompt = "Email jean@example.test, then send the reply to jean@example.test.";
  const spans = detectSensitiveSpans(prompt).filter((span) => span.type === "EMAIL");
  const result = tokenizePrompt(prompt, spans, "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");

  assert.equal(spans.length, 2);
  assert.equal(result.mapping.size, 1);
  assert.equal(result.entities[0].token, result.entities[1].token);
  assert.equal(restoreKnownTokens(result.sanitizedPrompt, result.mapping), prompt);
});

test("risk scoring is capped and explainable", () => {
  const spans: SensitiveSpan[] = [
    { type: "EMAIL", start: 0, end: 1, value: "a" },
    { type: "PAYMENT_CARD", start: 2, end: 3, value: "b" },
  ];
  assert.deepEqual(calculateRisk(spans), { score: 40, level: "MEDIUM" });
  assert.deepEqual(countEntities(spans), { EMAIL: 1, PAYMENT_CARD: 1 });

  const many: SensitiveSpan[] = Array.from({ length: 4 }, (_, index) => ({
    type: "API_KEY", start: index * 2, end: index * 2 + 1, value: `key${index}`,
  }));
  assert.deepEqual(calculateRisk(many), { score: 100, level: "HIGH" });
});

test("unknown or historical GuardAI tokens are hidden from the displayed answer", () => {
  const response = "Hello [[GAI_OLD123_EMAIL_1]], your message is ready.";
  assert.equal(containsUnresolvedGuardToken(response), true);
  assert.equal(
    maskUnresolvedGuardTokens(response),
    "Hello [sensitive information redacted], your message is ready.",
  );
});

test("only exact current-request tokens are restored", () => {
  const mapping = new Map([["[[GAI_NEW123_EMAIL_1]]", "current@example.test"]]);
  const response = "Current [[GAI_NEW123_EMAIL_1]]; old [[GAI_OLD123_EMAIL_1]].";
  const restored = restoreKnownTokens(response, mapping);
  assert.equal(restored.includes("current@example.test"), true);
  assert.equal(containsUnresolvedGuardToken(restored), true);
  assert.equal(maskUnresolvedGuardTokens(restored).includes("[[GAI_OLD123_EMAIL_1]]"), false);
});
