import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { detectSensitiveSpans } from "./detector.ts";
import { tokenizePrompt } from "./tokenizer.ts";
import { calculateRisk } from "./risk-engine.ts";
import { restoreKnownTokens } from "./restoration.ts";

Deno.test("detects an email address", () => {
  const spans = detectSensitiveSpans("Contact me at mohamed@example.com for details.");
  assertEquals(spans.map((span) => span.type), ["EMAIL"]);
  assertEquals(spans[0].value, "mohamed@example.com");
});

Deno.test("detects a contextual person name", () => {
  const spans = detectSensitiveSpans("My name is Jean Dupont and I need help.");
  assert(spans.some((span) => span.type === "PERSON" && span.value === "Jean Dupont"));
});

Deno.test("detects a contextual organization name", () => {
  const spans = detectSensitiveSpans("I work at ABC Technologies in Kigali.");
  assert(spans.some((span) => span.type === "ORGANIZATION" && span.value === "ABC Technologies"));
});


Deno.test("does not absorb the next sentence into a person or organization name", () => {
  const prompt = "My name is Jean Dupont. My email is jean@example.com. My company is ABC Technologies. Please draft a letter.";
  const spans = detectSensitiveSpans(prompt);
  assert(spans.some((span) => span.type === "PERSON" && span.value === "Jean Dupont"));
  assert(spans.some((span) => span.type === "EMAIL" && span.value === "jean@example.com"));
  assert(spans.some((span) => span.type === "ORGANIZATION" && span.value === "ABC Technologies"));
  assert(!spans.some((span) => span.value.includes("My email") || span.value.includes("Please")));
});

Deno.test("masks repeated values with the same request token", () => {
  const prompt = "Email me at mohamed@example.com or use mohamed@example.com again.";
  const spans = detectSensitiveSpans(prompt);
  const result = tokenizePrompt(prompt, spans, "12345678-1234-4234-8234-123456789abc");
  assertEquals(result.entities[0].token, result.entities[1].token);
  assert(!result.sanitizedPrompt.includes("mohamed@example.com"));
});

Deno.test("restores only exact tokens from this request", () => {
  const prompt = "My name is Jean Dupont.";
  const spans = detectSensitiveSpans(prompt);
  const result = tokenizePrompt(prompt, spans, "12345678-1234-4234-8234-123456789abc");
  const token = result.entities[0].token;
  assertEquals(restoreKnownTokens(`Hello ${token}.`, result.mapping), "Hello Jean Dupont.");
  assertEquals(restoreKnownTokens("Hello [[GAI_OTHER_PERSON_1]].", result.mapping), "Hello [[GAI_OTHER_PERSON_1]].");
});

Deno.test("risk score is weighted and classified", () => {
  const spans = detectSensitiveSpans("My name is Jean Dupont and my email is jean@example.com.");
  const risk = calculateRisk(spans);
  assertEquals(risk.score, 25);
  assertEquals(risk.level, "LOW");
});

Deno.test("detects a synthetic Luhn-valid payment card", () => {
  const spans = detectSensitiveSpans("Test card: 4111 1111 1111 1111.");
  assert(spans.some((span) => span.type === "PAYMENT_CARD"));
});
