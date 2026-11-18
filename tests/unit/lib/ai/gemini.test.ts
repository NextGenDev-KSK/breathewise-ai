import { describe, expect, it } from "vitest";
import { readGeminiConfig, DEFAULT_GEMINI_MODEL } from "@/lib/ai/gemini";

describe("Gemini configuration", () => {
  it("is absent without a key", () => {
    expect(readGeminiConfig({} as NodeJS.ProcessEnv)).toBeNull();
    expect(readGeminiConfig({ GEMINI_API_KEY: "  " } as unknown as NodeJS.ProcessEnv)).toBeNull();
  });
  it("defaults and sanitises the model name", () => {
    expect(readGeminiConfig({ GEMINI_API_KEY: "k" } as unknown as NodeJS.ProcessEnv)?.model).toBe(
      DEFAULT_GEMINI_MODEL,
    );
    expect(
      readGeminiConfig({
        GEMINI_API_KEY: "k",
        GEMINI_MODEL: "gemini-3.6-flash",
      } as unknown as NodeJS.ProcessEnv)?.model,
    ).toBe("gemini-3.6-flash");
    expect(
      readGeminiConfig({
        GEMINI_API_KEY: "k",
        GEMINI_MODEL: "../../evil?x=1",
      } as unknown as NodeJS.ProcessEnv)?.model,
    ).toBe(DEFAULT_GEMINI_MODEL);
  });
});
