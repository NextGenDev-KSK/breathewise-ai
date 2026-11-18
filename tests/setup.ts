import "@testing-library/jest-dom/vitest";
import "@/lib/zodConfig";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import { clearCache } from "@/lib/air/cache";
import { router } from "@/tests/fixtures/navigation";

// Components read the route through next/navigation; every test shares one router stub.
vi.mock("next/navigation", () => ({ usePathname: () => "/forecast", useRouter: () => router }));

// jsdom does not implement <dialog> methods yet; mirror the browser behaviour the app relies on.
if (typeof HTMLDialogElement !== "undefined" && !HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
}

// Every test starts from a clean browser: no rendered tree, storage, cached responses, stubbed globals,
// geolocation mock or recorded navigation.
afterEach(() => {
  cleanup();
  window.localStorage.clear();
  clearCache();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, "geolocation");
  router.push.mockReset();
});
