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
      "@iris/thread": iris("thread"),
      "@iris/ledger": iris("ledger"),
      "@iris/pool": iris("pool"),
      "@iris/router": iris("router"),
      "@iris/handoff": iris("handoff"),
      "@iris/remote": app("remote"),
    },
  },
  test: {
    include: ["packages/*/src/**/*.test.ts", "apps/*/src/**/*.test.ts"],
    environment: "node",
  },
});
