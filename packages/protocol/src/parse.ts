import type { ZodTypeAny } from "zod";
import { ZodError } from "zod";

export type ParseOk<T> = { ok: true; data: T };
export type ParseFail = { ok: false; path: string; message: string };
export type ParseResult<T> = ParseOk<T> | ParseFail;

/** Validate unknown input; on failure return the first Zod path. */
export function parseWithPath<T>(schema: ZodTypeAny, input: unknown): ParseResult<T> {
  const result = schema.safeParse(input);
  if (result.success) {
    return { ok: true, data: result.data as T };
  }
  return formatZodFail(result.error);
}

export function formatZodFail(error: ZodError): ParseFail {
  const issue = error.issues[0];
  if (!issue) {
    return { ok: false, path: "(root)", message: "invalid" };
  }
  const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
  return { ok: false, path, message: issue.message };
}
