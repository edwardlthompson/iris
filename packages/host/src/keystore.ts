/** Abstract key material store — OS keychain later; memory for tests. */
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

export interface KeyStore {
  get(id: string): Promise<Uint8Array | null>;
  set(id: string, value: Uint8Array): Promise<void>;
  delete(id: string): Promise<void>;
}

export class MemoryKeyStore implements KeyStore {
  readonly #map = new Map<string, Uint8Array>();

  async get(id: string): Promise<Uint8Array | null> {
    const v = this.#map.get(id);
    return v ? new Uint8Array(v) : null;
  }

  async set(id: string, value: Uint8Array): Promise<void> {
    this.#map.set(id, new Uint8Array(value));
  }

  async delete(id: string): Promise<void> {
    this.#map.delete(id);
  }
}

/** Persist host X25519 keys so the pairing code survives restarts (enables phone auto-pair). */
export class FileKeyStore implements KeyStore {
  constructor(private readonly dir = join(homedir(), ".iris", "host-keys")) {}

  private pathFor(id: string): string {
    const safe = id.replace(/[^a-zA-Z0-9._-]/g, "_");
    return join(this.dir, safe);
  }

  async get(id: string): Promise<Uint8Array | null> {
    try {
      return new Uint8Array(await readFile(this.pathFor(id)));
    } catch {
      return null;
    }
  }

  async set(id: string, value: Uint8Array): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    await writeFile(this.pathFor(id), value);
  }

  async delete(id: string): Promise<void> {
    try {
      await unlink(this.pathFor(id));
    } catch {
      /* missing ok */
    }
  }
}
