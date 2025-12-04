import { describe, it, expect } from "vitest";
import { version } from "../version.js";

describe("version", () => {
  it("should export a version string", () => {
    expect(version).toBeDefined();
    expect(typeof version).toBe("string");
  });

  it("should be a valid semver format", () => {
    expect(version).toMatch(/^\d+\.\d+\.\d+/);
  });
});
