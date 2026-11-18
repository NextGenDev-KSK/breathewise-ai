import { vi } from "vitest";

/**
 * Router stub shared by every test. `tests/setup.ts` mocks `next/navigation` with it and resets it after
 * each test, so a test can assert on `router.push` directly.
 */
export const router = { push: vi.fn() };
