import { createServer } from "node:http";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { probePoolStatus, runPoolTurn } from "./pool-runtime.js";

const dirs: string[] = [];
const savedHome = process.env.IRIS_HOME;
const savedKey = process.env.LITELLM_MASTER_KEY;

afterEach(() => {
  if (savedHome === undefined) delete process.env.IRIS_HOME;
  else process.env.IRIS_HOME = savedHome;
  if (savedKey === undefined) delete process.env.LITELLM_MASTER_KEY;
  else process.env.LITELLM_MASTER_KEY = savedKey;
  while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true });
});

describe("pool-runtime", () => {
  it("probes local LiteLLM proxy, runs completion, tracks spend, and redacts secrets", async () => {
    const root = mkdtempSync(join(tmpdir(), "iris-pool-rt-"));
    dirs.push(root);
    process.env.IRIS_HOME = root;
    delete process.env.LITELLM_MASTER_KEY;

    let failNext = false;
    const srv = createServer((req, res) => {
      if (req.headers.authorization !== "Bearer sk-iris-testkey99") {
        res.writeHead(401, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "unauthorized" }));
        return;
      }
      if (req.url === "/v1/models") {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ data: [{ id: "venice/claude-sonnet-4-5" }] }));
        return;
      }
      if (req.url === "/v1/chat/completions") {
        if (failNext) {
          res.writeHead(500, { "content-type": "text/plain" });
          res.end("upstream error with sk-secret-abcdef12345");
          return;
        }
        res.writeHead(200, {
          "content-type": "application/json",
          "x-litellm-response-cost": "0.25",
        });
        res.end(
          JSON.stringify({
            model: "venice/claude-sonnet-4-5",
            choices: [{ message: { content: "pong from pool" } }],
          }),
        );
        return;
      }
      res.writeHead(404);
      res.end();
    });

    await new Promise<void>((resolve) => srv.listen(0, "127.0.0.1", () => resolve()));
    const port = (srv.address() as { port: number }).port;
    try {
      mkdirSync(root, { recursive: true });
      writeFileSync(join(root, "litellm.env"), "LITELLM_MASTER_KEY=sk-iris-testkey99\n");
      writeFileSync(
        join(root, "pool.json"),
        JSON.stringify({
          enabled: true,
          proxyUrl: `http://127.0.0.1:${port}`,
          monthlyCapUsd: 0.5,
          defaultModel: "venice/claude-sonnet-4-5",
        }),
      );

      const st = await probePoolStatus();
      expect(st.connected).toBe(true);
      expect(st.models).toEqual(["venice/claude-sonnet-4-5"]);

      const out = await runPoolTurn("hello", "pool:venice/claude-sonnet-4-5");
      expect(out.text).toBe("pong from pool");
      expect(out.model).toBe("venice/claude-sonnet-4-5");

      const spend = JSON.parse(readFileSync(join(root, "pool-spend.json"), "utf8")) as {
        spentUsd: number;
      };
      expect(spend.spentUsd).toBe(0.25);

      failNext = true;
      await expect(runPoolTurn("fail")).rejects.toThrow(/\*\*\*/);

      // Exceed cap
      await runPoolTurn("second", undefined).catch(() => {});
      writeFileSync(
        join(root, "pool-spend.json"),
        JSON.stringify({ month: new Date().toISOString().slice(0, 7), spentUsd: 0.5 }),
      );
      await expect(runPoolTurn("blocked")).rejects.toThrow(/cap/i);
    } finally {
      await new Promise<void>((resolve) => srv.close(() => resolve()));
    }
  });
});
