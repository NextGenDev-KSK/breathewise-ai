import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PageHeader } from "@/components/ui/PageHeader";

describe("PageHeader", () => {
  it("renders the page's only h1 with optional description and actions", () => {
    render(<PageHeader title="Forecast" description="Next 48 hours" actions={<button>Refresh</button>} />);
    expect(screen.getByRole("heading", { level: 1, name: "Forecast" })).toBeInTheDocument();
    expect(screen.getByText("Next 48 hours")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Refresh" })).toBeInTheDocument();
  });

  it("omits the description and actions when not given", () => {
    const { container } = render(<PageHeader title="Plan" />);
    expect(container.querySelectorAll("p, button")).toHaveLength(0);
  });
});
