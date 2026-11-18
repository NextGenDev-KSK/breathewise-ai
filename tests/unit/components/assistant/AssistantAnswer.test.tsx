import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { AssistantAnswer } from "@/components/assistant/AssistantAnswer";
import { GOOD_RESPONSE } from "@/tests/fixtures/ai";

describe("AssistantAnswer", () => {
  it("shows which engine answered, every section, and numbered actions", () => {
    render(<AssistantAnswer answer={GOOD_RESPONSE} source={{ kind: "gemini", model: "gemini-test" }} />);
    expect(screen.getByText(/Gemini · gemini-test/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Top actions" })).toBeInTheDocument();
    expect(screen.getByText(/1\. Delay your walk/)).toBeInTheDocument();
    for (const term of ["Timing", "Commute", "Indoors", "Environmental impact"]) {
      expect(screen.getByText(term, { selector: "dt" })).toBeInTheDocument();
    }
    expect(screen.getByText(GOOD_RESPONSE.disclaimer)).toBeInTheDocument();
  });

  it("labels rule-based answers, shows the fallback reason, and omits empty indoor advice", () => {
    render(
      <AssistantAnswer
        answer={{ ...GOOD_RESPONSE, indoor_recommendations: [] }}
        source={{ kind: "rules" }}
        notice="Gemini is busy right now."
      />,
    );
    expect(screen.getByText("Rule-based answer (no AI used)")).toBeInTheDocument();
    expect(screen.getByText("Gemini is busy right now.")).toBeInTheDocument();
    expect(screen.queryByText("Indoors", { selector: "dt" })).not.toBeInTheDocument();
  });

  it("renders model output as text, never as HTML", () => {
    const payload = '<img src="x" onerror="alert(1)">';
    const { container } = render(
      <AssistantAnswer answer={{ ...GOOD_RESPONSE, summary: payload }} source={{ kind: "rules" }} />,
    );
    expect(screen.getByText(payload)).toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
  });
});
