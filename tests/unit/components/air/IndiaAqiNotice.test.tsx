import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { IndiaAqiNotice } from "@/components/air/IndiaAqiNotice";
import { CPCB_URL } from "@/lib/content/notices";

describe("IndiaAqiNotice", () => {
  it("says the values are not India's National AQI and links to official CPCB readings", () => {
    render(<IndiaAqiNotice />);
    const notice = screen.getByRole("complementary", { name: "About India's National AQI" });
    expect(notice).toHaveTextContent("The values above are not India's official National AQI");
    expect(notice).toHaveTextContent("does not calculate a CPCB AQI from model data");
    const link = screen.getByRole("link", { name: /Check official CPCB station readings/ });
    expect(link).toHaveAttribute("href", CPCB_URL);
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });
});
