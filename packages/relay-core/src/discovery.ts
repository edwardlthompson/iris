/** LAN discovery — real mDNS later; in-process registry for tests + localhost. */
export interface HostAdvertisement {
  name: string;
  host: string;
  port: number;
  fingerprint: string;
}

export interface Discovery {
  advertise(ad: HostAdvertisement): Promise<void>;
  browse(): Promise<HostAdvertisement[]>;
  stop(): Promise<void>;
}

export class MemoryDiscovery implements Discovery {
  readonly #ads = new Map<string, HostAdvertisement>();

  async advertise(ad: HostAdvertisement): Promise<void> {
    this.#ads.set(`${ad.host}:${ad.port}`, ad);
  }

  async browse(): Promise<HostAdvertisement[]> {
    return [...this.#ads.values()];
  }

  async stop(): Promise<void> {
    this.#ads.clear();
  }
}

/**
 * Sprint 3 LAN stub: advertise localhost; mDNS (bonjour) can replace later
 * without changing callers.
 */
export class LanDiscovery implements Discovery {
  readonly #inner = new MemoryDiscovery();

  async advertise(ad: HostAdvertisement): Promise<void> {
    await this.#inner.advertise({ ...ad, host: ad.host || "127.0.0.1" });
  }

  async browse(): Promise<HostAdvertisement[]> {
    return this.#inner.browse();
  }

  async stop(): Promise<void> {
    await this.#inner.stop();
  }
}
