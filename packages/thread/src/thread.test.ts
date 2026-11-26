import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ThreadStore, ROTATION_TURNS } from "./store.js";
import { redactText } from "./redact.js";

const ts = () => new Date().toISOString();

describe("@iris/thread redact", () => {
  it("strips secret-shaped strings", () => {
    expect(redactText("key sk-abcdefghijklmnopqrstuv")).toContain("[REDACTED_API_KEY]");
    expect(redactText("Bearer abcdefghijklmnop")).toContain("[REDACTED]");
  });
});

describe("@iris/thread store", () => {
  it("replays to identical state and holds no secrets", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "iris-thread-"));
    const store = new ThreadStore({ dir, threadId: "t1" });
    await store.open();
    await store.append({
      v: 1,
      type: "thread.open",
      seq: 0,
      ts: ts(),
      thread_id: "t1",
      repo_id: "r1",
    });
    await store.append({
      v: 1,
      type: "user.prompt",
      seq: 1,
      ts: ts(),
      text: "use sk-abcdefghijklmnopqrstuvwxyz0123 please",
    });
    await store.append({
      v: 1,
      type: "agent.text",
      seq: 2,
      ts: ts(),
      text: "ok",
    });
    await store.flush();

    const replayed = await store.replay();
    expect(replayed).toHaveLength(3);
    expect(replayed.map((e) => e.seq)).toEqual([0, 1, 2]);
    expect(replayed[1]).toMatchObject({ type: "user.prompt" });
    if (replayed[1]!.type === "user.prompt") {
      expect(replayed[1].text).not.toMatch(/sk-/);
      expect(replayed[1].text).toContain("[REDACTED_API_KEY]");
    }

    const raw = await readFile(path.join(dir, "t1.ndjson"), "utf8");
    expect(raw).not.toMatch(/sk-abcdefghijklmnopqrstuvwxyz/);

    const again = new ThreadStore({ dir, threadId: "t1" });
    await again.open();
    const second = await again.replay();
    expect(second).toEqual(replayed);
  });

  it("rotates after rotationTurns", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "iris-thread-rot-"));
    const store = new ThreadStore({ dir, threadId: "rot", rotationTurns: 2 });
    await store.open();
    for (let i = 0; i < 3; i++) {
      await store.append({
        v: 1,
        type: "agent.text",
        seq: i,
        ts: ts(),
        text: `m${i}`,
      });
    }
    await store.flush();
    const all = await store.replay();
    expect(all).toHaveLength(3);
    expect(ROTATION_TURNS).toBe(500);
  });
});
