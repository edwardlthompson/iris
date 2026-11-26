import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("@iris/phone capacitor shell", () => {
  it("ships capacitor.config with webDir www", () => {
    const cfg = JSON.parse(readFileSync(join(root, "capacitor.config.json"), "utf8"));
    expect(cfg.appId).toBe("com.edwardlthompson.iris");
    expect(cfg.webDir).toBe("www");
    expect(cfg.appName).toBe("Iris");
  });

  it("www index is a PWA entry", () => {
    const html = readFileSync(join(root, "www", "index.html"), "utf8");
    expect(html).toMatch(/wizard-root/);
    expect(html).toMatch(/manifest\.webmanifest/);
  });
});
