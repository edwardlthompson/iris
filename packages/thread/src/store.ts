import { mkdir, open, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { ThreadEventSchema, type ThreadEvent } from "@iris/protocol";
import { redactValue } from "./redact.js";

export const ROTATION_TURNS = 500;

export type ThreadStoreOptions = {
  dir: string;
  threadId: string;
  rotationTurns?: number;
};

/** Append-only NDJSON thread store with atomic flush, replay, redaction, rotation. */
export class ThreadStore {
  private readonly dir: string;
  private readonly threadId: string;
  private readonly rotationTurns: number;
  private seq = 0;
  private buffer: ThreadEvent[] = [];
  private filePath: string;
  private part = 0;

  constructor(opts: ThreadStoreOptions) {
    this.dir = opts.dir;
    this.threadId = opts.threadId;
    this.rotationTurns = opts.rotationTurns ?? ROTATION_TURNS;
    this.filePath = this.pathFor(0);
  }

  async open(): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    const existing = await this.replay();
    if (existing.length) {
      this.seq = existing[existing.length - 1]!.seq + 1;
      this.part = Math.floor(existing.length / this.rotationTurns);
      this.filePath = this.pathFor(this.part);
    }
  }

  async append(event: Omit<ThreadEvent, "seq"> & { seq?: number }): Promise<ThreadEvent> {
    const withSeq = { ...event, seq: event.seq ?? this.seq } as ThreadEvent;
    const redacted = redactValue(withSeq) as ThreadEvent;
    const parsed = ThreadEventSchema.parse(redacted);
    if (parsed.seq !== this.seq) {
      throw new Error(`seq mismatch: expected ${this.seq}, got ${parsed.seq}`);
    }
    this.buffer.push(parsed);
    this.seq += 1;
    if (this.buffer.length >= 8) await this.flush();
    if (this.seq > 0 && this.seq % this.rotationTurns === 0) {
      await this.flush();
      this.part += 1;
      this.filePath = this.pathFor(this.part);
    }
    return parsed;
  }

  async flush(): Promise<void> {
    if (!this.buffer.length) return;
    const lines = this.buffer.map((e) => JSON.stringify(e)).join("\n") + "\n";
    this.buffer = [];
    const tmp = `${this.filePath}.${process.pid}.tmp`;
    let prior = "";
    try {
      prior = await readFile(this.filePath, "utf8");
    } catch {
      /* new part file */
    }
    await writeFile(tmp, prior + lines, "utf8");
    await rename(tmp, this.filePath);
    // Best-effort durability; Windows often EPERM on fsync of a just-renamed file.
    try {
      const fh = await open(this.filePath, "r+");
      try {
        await fh.sync();
      } finally {
        await fh.close();
      }
    } catch {
      /* rename already committed bytes */
    }
  }

  async replay(): Promise<ThreadEvent[]> {
    await this.flush();
    const out: ThreadEvent[] = [];
    for (let p = 0; p <= this.part + 8; p++) {
      const fp = this.pathFor(p);
      let raw: string;
      try {
        raw = await readFile(fp, "utf8");
      } catch {
        if (p > this.part) break;
        continue;
      }
      for (const line of raw.split("\n")) {
        const t = line.trim();
        if (!t) continue;
        out.push(ThreadEventSchema.parse(JSON.parse(t)));
      }
    }
    return out;
  }

  private pathFor(part: number): string {
    const name = part === 0 ? `${this.threadId}.ndjson` : `${this.threadId}.part${part}.ndjson`;
    return path.join(this.dir, name);
  }
}
