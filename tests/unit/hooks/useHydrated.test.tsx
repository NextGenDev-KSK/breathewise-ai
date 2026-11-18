import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { useHydrated } from "@/hooks/useHydrated";

describe("useHydrated", () => {
  it("is true after hydration on the client", () => {
    expect(renderHook(() => useHydrated()).result.current).toBe(true);
  });
});
