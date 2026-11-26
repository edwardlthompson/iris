import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { HandoffV1Schema, type HandoffV1 } from "@iris/protocol";

export type HandoffDraft = Omit<HandoffV1, "v"> & { v?: 1 };

/** Write a validated handoff.v1 document (atomic temp+rename). */
export async function writeHandoff(dir: string, draft: HandoffDraft): Promise<HandoffV1> {
  const doc = HandoffV1Schema.parse({ ...draft, v: 1 });
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, `${doc.thread_id}.handoff.v1.json`);
  const tmp = `${file}.${process.pid}.tmp`;
  await writeFile(tmp, `${JSON.stringify(doc, null, 2)}\n`, "utf8");
  const { rename } = await import("node:fs/promises");
  await rename(tmp, file);
  return doc;
}

export async function readHandoff(filePath: string): Promise<HandoffV1> {
  const { readFile } = await import("node:fs/promises");
  return HandoffV1Schema.parse(JSON.parse(await readFile(filePath, "utf8")));
}
