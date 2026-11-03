export function restoreKnownTokens(text: string, mapping: Map<string, string>): string {
  let restored = text;
  // mapping is token -> original value. Restore only this request's exact tokens.
  for (const [token, originalValue] of mapping.entries()) restored = restored.split(token).join(originalValue);
  return restored;
}

export function containsUnresolvedGuardToken(text: string): boolean {
  return /\[\[GAI_[A-Z0-9_]+\]\]/u.test(text);
}
