import type { PresetId } from "@iris/protocol";

export type PinStore = {
  get(): PresetId | null;
  set(preset: PresetId | null): void;
};

/** In-memory pin; wrap with localStorage adapter in the phone UI later. */
export class MemoryPinStore implements PinStore {
  private pin: PresetId | null = null;

  get(): PresetId | null {
    return this.pin;
  }

  set(preset: PresetId | null): void {
    this.pin = preset;
  }
}

const KEY = "iris.preset.pin";

/** Browser pin store — survives reload via localStorage. */
export class LocalStoragePinStore implements PinStore {
  constructor(private readonly storage: Storage) {}

  get(): PresetId | null {
    const v = this.storage.getItem(KEY);
    if (v === "savings" || v === "balanced" || v === "performance" || v === "max") return v;
    return null;
  }

  set(preset: PresetId | null): void {
    if (preset === null) this.storage.removeItem(KEY);
    else this.storage.setItem(KEY, preset);
  }
}
