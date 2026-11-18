import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RecommendationCard } from "@/components/recommendations/RecommendationCard";
import type { Recommendation } from "@/types/recommendation";

describe("RecommendationCard", () => {
  it("renders text safely and exposes the explanation", async () => {
    const rec: Recommendation = {
      id: "x",
      category: "outdoor",
      title: "<img src=x onerror=alert(1)>",
      description: "desc",
      reason: "because",
      evidence: ["US AQI: 152"],
      recommendedTime: "06:00–07:00",
      impactType: "exposure-reduction",
      confidence: "medium",
      source: "test",
      limitations: ["model"],
      priority: 1,
    };
    const user = userEvent.setup();
    const { container } = render(<RecommendationCard rec={rec} />);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("<img src=x onerror=alert(1)>")).toBeInTheDocument();
    await user.click(screen.getByText("Why this recommendation?"));
    expect(screen.getByText("US AQI: 152")).toBeVisible();
    expect(screen.getByText("Confidence: medium")).toBeInTheDocument();
  });
});
