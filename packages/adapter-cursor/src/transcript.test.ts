import { describe, expect, it } from "vitest";
import { readTranscriptItems } from "./transcript.js";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("transcript reader", () => {
  it("parses user_query and assistant text from jsonl", () => {
    const dir = mkdtempSync(join(tmpdir(), "iris-tr-"));
    const file = join(dir, "c.jsonl");
    writeFileSync(
      file,
      [
        JSON.stringify({
          role: "user",
          message: { content: [{ type: "text", text: "<user_query>hello agent</user_query>" }] },
        }),
        JSON.stringify({
          role: "assistant",
          message: { content: [{ type: "text", text: "hi back" }] },
        }),
      ].join("\n"),
      "utf8",
    );
    expect(readTranscriptItems(file)).toEqual([
      { k: "human", t: "hello agent" },
      { k: "assistant", t: "hi back" },
    ]);
  });

  it("hides system notes that are not the person's message", () => {
    const dir = mkdtempSync(join(tmpdir(), "iris-tr-"));
    const file = join(dir, "c.jsonl");
    writeFileSync(
      file,
      [
        JSON.stringify({
          role: "user",
          message: {
            content: [
              {
                type: "text",
                text: "<user_query>Briefly inform the user about the task result and perform any follow-up actions (if needed). If there's no follow-ups needed, don't explicitly say that.</user_query>",
              },
            ],
          },
        }),
        JSON.stringify({
          role: "assistant",
          message: { content: [{ type: "text", text: "The installer finished." }] },
        }),
      ].join("\n"),
      "utf8",
    );
    expect(readTranscriptItems(file)).toEqual([{ k: "assistant", t: "The installer finished." }]);
  });

  it("returns empty for missing file", () => {
    expect(readTranscriptItems(null)).toEqual([]);
  });
});
