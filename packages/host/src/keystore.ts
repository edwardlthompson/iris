/** Abstract key material store — OS keychain later; memory for tests. */
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
