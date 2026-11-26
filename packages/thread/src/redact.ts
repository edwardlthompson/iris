/** Secret-shaped patterns → redacted placeholders (no raw secrets in store). */
const PATTERNS: Array<{ re: RegExp; replace: string }> = [
  { re: /\bsk-[A-Za-z0-9_-]{16,}\b/g, replace: "[REDACTED_API_KEY]" },
  { re: /\bBearer\s+[A-Za-z0-9._\-+=/]{12,}\b/gi, replace: "Bearer [REDACTED]" },
  { re: /\b[A-Za-z0-9+/]{32,}={0,2}\b/g, replace: "[REDACTED_B64]" },
  {
    re: /\b(-----BEGIN [A-Z ]+PRIVATE KEY-----)[\s\S]*?(-----END [A-Z ]+PRIVATE KEY-----)/g,
    replace: "[REDACTED_PRIVATE_KEY]",
  },
];

export function redactText(text: string): string {
  let out = text;
  for (const { re, replace } of PATTERNS) out = out.replace(re, replace);
  return out;
}

export function redactValue(value: unknown): unknown {
  if (typeof value === "string") return redactText(value);
  if (Array.isArray(value)) return value.map(redactValue);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = redactValue(v);
    }
    return out;
  }
  return value;
}
