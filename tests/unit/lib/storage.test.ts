import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  clearAllStored,
  readStored,
  STORAGE_KEYS,
  storedSnapshotReader,
  subscribeToStorage,
  writeStored,
} from "@/lib/storage";
import { DEFAULT_SETTINGS, SettingsSchema } from "@/types/preferences";
import { SnapshotSchema } from "@/lib/air/snapshotSchema";
import { buildDemoSnapshot } from "@/lib/demo/fixture";

describe("storage store", () => {
  it("notifies subscribers on write and clear, and stops after unsubscribe", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToStorage(listener);
    writeStored(STORAGE_KEYS.settings, DEFAULT_SETTINGS);
    clearAllStored();
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    writeStored(STORAGE_KEYS.settings, DEFAULT_SETTINGS);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("reacts to changes from other tabs, ignoring unrelated keys", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToStorage(listener);
    window.dispatchEvent(new StorageEvent("storage", { key: "breathewise:v1:settings" }));
    window.dispatchEvent(new StorageEvent("storage", { key: "another-app" }));
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it("returns the same object until the stored text changes", () => {
    const read = storedSnapshotReader(STORAGE_KEYS.settings, SettingsSchema, DEFAULT_SETTINGS);
    writeStored(STORAGE_KEYS.settings, { ...DEFAULT_SETTINGS, demoMode: true });
    const first = read();
    expect(read()).toBe(first);
    writeStored(STORAGE_KEYS.settings, { ...DEFAULT_SETTINGS, demoMode: false });
    expect(read()).not.toBe(first);
    expect(read().demoMode).toBe(false);
  });
});

describe("local storage", () => {
  it("round-trips validated values", () => {
    writeStored(STORAGE_KEYS.settings, { ...DEFAULT_SETTINGS, demoMode: true });
    expect(readStored(STORAGE_KEYS.settings, SettingsSchema, DEFAULT_SETTINGS).demoMode).toBe(true);
  });
  it("falls back on corrupt JSON or tampered data", () => {
    localStorage.setItem("breathewise:v1:settings", "{not json");
    expect(readStored(STORAGE_KEYS.settings, SettingsSchema, DEFAULT_SETTINGS)).toEqual(DEFAULT_SETTINGS);
    localStorage.setItem("breathewise:v1:settings", JSON.stringify({ aqiStandard: "<script>" }));
    expect(readStored(STORAGE_KEYS.settings, SettingsSchema, DEFAULT_SETTINGS)).toEqual(DEFAULT_SETTINGS);
  });
  it("clears only BreatheWise keys", () => {
    localStorage.setItem("other-app", "keep");
    writeStored(STORAGE_KEYS.mission, { a: 1 });
    clearAllStored();
    expect(localStorage.getItem("other-app")).toBe("keep");
    expect(readStored(STORAGE_KEYS.mission, z.unknown(), null)).toBeNull();
  });
  it("validates a demo snapshot with the persisted-snapshot schema", () => {
    expect(SnapshotSchema.safeParse(buildDemoSnapshot(Date.UTC(2026, 10, 17, 6))).success).toBe(true);
  });
});
