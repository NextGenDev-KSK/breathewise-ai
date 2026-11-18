import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { z } from "zod";
import { useStoredState } from "@/hooks/useStoredState";
import { clearAllStored, readStored, STORAGE_KEYS } from "@/lib/storage";

describe("useStoredState", () => {
  const Schema = z.object({ count: z.number() });
  const fallback = { count: 0 };

  it("persists updates and accepts updater functions", () => {
    const { result } = renderHook(() => useStoredState(STORAGE_KEYS.mission, Schema, fallback));
    expect(result.current[0]).toEqual({ count: 0 });
    act(() => result.current[1]({ count: 2 }));
    act(() => result.current[1]((previous) => ({ count: previous.count + 1 })));
    expect(result.current[0]).toEqual({ count: 3 });
    expect(readStored(STORAGE_KEYS.mission, Schema, fallback)).toEqual({ count: 3 });
  });

  it("keeps two components on the same key in sync and resets on clear", () => {
    const a = renderHook(() => useStoredState(STORAGE_KEYS.mission, Schema, fallback));
    const b = renderHook(() => useStoredState(STORAGE_KEYS.mission, Schema, fallback));
    act(() => a.result.current[1]({ count: 7 }));
    expect(b.result.current[0]).toEqual({ count: 7 });
    act(() => clearAllStored());
    expect(a.result.current[0]).toEqual(fallback);
  });

  it("falls back for invalid stored data", () => {
    localStorage.setItem("breathewise:v1:mission", JSON.stringify({ count: "x" }));
    const { result } = renderHook(() => useStoredState(STORAGE_KEYS.mission, Schema, fallback));
    expect(result.current[0]).toBe(fallback);
  });
});
