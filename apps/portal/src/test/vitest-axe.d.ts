/**
 * PHASE B1.3 — type augmentation only (no runtime effect).
 * @types/jest-axe augments Jest's matcher interface; vitest's `expect` uses
 * its own `Assertion` interface, so `toHaveNoViolations` needs a separate
 * declaration here for TypeScript to recognize it in *.test.tsx files.
 */
import "vitest";
import type { AxeMatchers } from "jest-axe";

declare module "vitest" {
  interface Assertion<T = unknown> extends AxeMatchers {}
}
