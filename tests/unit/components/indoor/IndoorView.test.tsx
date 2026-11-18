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
