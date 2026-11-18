import { describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Dialog } from "@/components/ui/Dialog";

function Harness({ onClose = vi.fn() }: { onClose?: () => void }) {
  const [open, setOpen] = useState(false);
  const close = () => {
    onClose();
    setOpen(false);
  };
  return (
    <>
      <button onClick={() => setOpen(true)}>Open settings</button>
      <Dialog open={open} onClose={close} title="Settings" description="Change how data is shown">
        <button>Inside</button>
      </Dialog>
    </>
  );
}

async function openDialog(onClose = vi.fn()) {
  const user = userEvent.setup();
  render(<Harness onClose={onClose} />);
  await user.click(screen.getByRole("button", { name: "Open settings" }));
  return { user, onClose, dialog: screen.getByRole("dialog", { name: "Settings" }) };
}

describe("Dialog", () => {
  it("opens as a labelled, described modal", async () => {
    const { dialog } = await openDialog();
    expect(dialog).toHaveAttribute("open");
    expect(dialog).toHaveAccessibleDescription("Change how data is shown");
  });

  it("closes from the Close button and returns focus to the opener", async () => {
    const { user, onClose } = await openDialog();
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Open settings" })).toHaveFocus();
  });

  it("routes Escape (the cancel event) through onClose instead of closing natively", async () => {
    const { dialog, onClose } = await openDialog();
    const cancel = new Event("cancel", { cancelable: true });
    fireEvent(dialog, cancel);
    expect(cancel.defaultPrevented).toBe(true);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes on a backdrop click but not on clicks inside the content", async () => {
    const { user, dialog, onClose } = await openDialog();
    await user.click(screen.getByRole("button", { name: "Inside" }));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(dialog);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
