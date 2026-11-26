import path from "node:path";
import { defineConfig } from "vitest/config";

const iris = (pkg: string) => path.resolve(__dirname, `packages/${pkg}/src/index.ts`);
const app = (name: string) => path.resolve(__dirname, `apps/${name}/src/index.ts`);

export default defineConfig({
  resolve: {
    alias: {
      "@iris/protocol": iris("protocol"),
      "@iris/workspace": iris("workspace"),
      "@iris/host": iris("host"),
      "@iris/relay-core": iris("relay-core"),
      "@iris/adapter-acp": iris("adapter-acp"),
      "@iris/adapter-claude": iris("adapter-claude"),
      "@iris/adapter-antigravity": iris("adapter-antigravity"),
      "@iris/adapter-cursor": iris("adapter-cursor"),
      "@iris/thread": iris("thread"),
      "@iris/ledger": iris("ledger"),
      "@iris/pool": iris("pool"),
      "@iris/router": iris("router"),
      "@iris/handoff": iris("handoff"),
      "@iris/wizard": iris("wizard"),
      "@iris/plutus": iris("plutus"),
      "@iris/push": iris("push"),
      "@iris/remote": app("remote"),
      "@iris/phone": app("phone"),
    },
  },
  test: {
    include: ["packages/*/src/**/*.test.ts", "apps/*/src/**/*.test.ts"],
    environment: "node",
  },
});
