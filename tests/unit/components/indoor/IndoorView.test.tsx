import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IndoorView } from "@/components/indoor/IndoorView";
import { renderWithApp, seedDemoMode } from "@/tests/fixtures/render";

describe("IndoorView checklist", () => {
  it("persists checked items locally", async () => {
    seedDemoMode();
    const user = userEvent.setup();
    const { unmount } = renderWithApp(<IndoorView />);
    const box = await screen.findByRole("checkbox", { name: /Damp-dust surfaces/ });
    await user.click(box);
    expect(box).toBeChecked();
    expect(screen.getByText(/^1 of \d+ done$/)).toBeInTheDocument();
    unmount();
    renderWithApp(<IndoorView />);
    expect(await screen.findByRole("checkbox", { name: /Damp-dust surfaces/ })).toBeChecked();
  });
});

describe("Indoor air guide", () => {
  it("explains honestly what indoor plants can and cannot do", async () => {
    seedDemoMode();
    renderWithApp(<IndoorView />);
    const plants = await screen.findByText("Indoor plants: what they can and cannot do");
    const section = plants.closest("details");
    expect(section).toHaveTextContent(/10 to 1,000 potted plants per square metre/);
    expect(section).toHaveTextContent(/do not meaningfully lower PM2.5/);
  });
});
