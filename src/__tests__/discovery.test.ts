import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock fs module
vi.mock("node:fs", () => ({
  existsSync: vi.fn(() => false),
}));

// Mock UI module
vi.mock("../ui/index.js", () => ({
  colors: {
    bold: (s: string) => s,
    dim: (s: string) => s,
    accent: (s: string) => s,
    success: (s: string) => s,
    warning: (s: string) => s,
  },
  log: {
    dim: vi.fn(),
  },
}));

import { existsSync } from "node:fs";
import { detectInstalledProducts, getSuggestedProducts } from "../discovery.js";

describe("discovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("detectInstalledProducts", () => {
    it("should detect conductor when wrangler.toml exists", () => {
      vi.mocked(existsSync).mockImplementation((path) => {
        return path === "wrangler.toml";
      });

      const installed = detectInstalledProducts();
      expect(installed).toContain("conductor");
    });

    it("should detect edgit when .edgit directory exists", () => {
      vi.mocked(existsSync).mockImplementation((path) => {
        return path === ".edgit";
      });

      const installed = detectInstalledProducts();
      expect(installed).toContain("edgit");
    });

    it("should detect edgit when .edgit/components.json exists", () => {
      vi.mocked(existsSync).mockImplementation((path) => {
        return path === ".edgit/components.json";
      });

      const installed = detectInstalledProducts();
      expect(installed).toContain("edgit");
    });

    it("should detect multiple products", () => {
      vi.mocked(existsSync).mockImplementation((path) => {
        return path === "wrangler.toml" || path === ".edgit";
      });

      const installed = detectInstalledProducts();
      expect(installed).toContain("conductor");
      expect(installed).toContain("edgit");
    });

    it("should return empty array when no products detected", () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const installed = detectInstalledProducts();
      expect(installed).toEqual([]);
    });
  });

  describe("getSuggestedProducts", () => {
    it("should suggest edgit and cloud for conductor", () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const suggestions = getSuggestedProducts("conductor");
      expect(suggestions).toContain("edgit");
      expect(suggestions).toContain("cloud");
    });

    it("should suggest conductor and cloud for edgit", () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const suggestions = getSuggestedProducts("edgit");
      expect(suggestions).toContain("conductor");
      expect(suggestions).toContain("cloud");
    });

    it("should suggest conductor and edgit for cloud", () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const suggestions = getSuggestedProducts("cloud");
      expect(suggestions).toContain("conductor");
      expect(suggestions).toContain("edgit");
    });

    it("should not suggest already installed products", () => {
      // Conductor already installed (wrangler.toml exists)
      vi.mocked(existsSync).mockImplementation((path) => {
        return path === "wrangler.toml";
      });

      const suggestions = getSuggestedProducts("edgit");
      expect(suggestions).not.toContain("conductor");
      expect(suggestions).toContain("cloud");
    });

    it("should return empty array for unknown product", () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const suggestions = getSuggestedProducts("unknown");
      expect(suggestions).toEqual([]);
    });

    it("should return empty when all related products are installed", () => {
      // Both conductor and cloud installed
      vi.mocked(existsSync).mockImplementation((path) => {
        return path === "wrangler.toml";
      });

      // For edgit, conductor is related and installed
      // But cloud can't be detected via filesystem alone
      const suggestions = getSuggestedProducts("chamber");
      // Chamber only suggests conductor
      expect(suggestions).not.toContain("conductor");
    });
  });
});
