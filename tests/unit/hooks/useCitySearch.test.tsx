import { describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useCitySearch, searchStatusText } from "@/hooks/useCitySearch";
import pune from "@/tests/fixtures/geocoding-pune.json";
import { jsonResponse } from "@/tests/fixtures/http";

describe("useCitySearch", () => {
  it("debounces, and only shows results for the current query", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(pune));
    vi.stubGlobal("fetch", fetchMock);
    const { result, rerender } = renderHook(({ input }) => useCitySearch(input), {
      initialProps: { input: "P" },
    });
    expect(result.current.status).toBe("idle");
    rerender({ input: "Pun" });
    rerender({ input: "Pune" });
    expect(result.current.status).toBe("searching");
    await waitFor(() => expect(result.current.status).toBe("done"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.current.results[0]?.name).toBe("Pune");
    expect(searchStatusText(result.current)).toMatch(/3 locations found/);
    rerender({ input: "Puneville" });
    expect(result.current).toMatchObject({ status: "searching", results: [] });
  });

  it("reports failures", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    const { result } = renderHook(() => useCitySearch("Pune"));
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(searchStatusText(result.current)).toMatch(/unavailable/);
  });
});
