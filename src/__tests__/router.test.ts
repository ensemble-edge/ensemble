import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock child_process before importing router
vi.mock("node:child_process", () => ({
  spawn: vi.fn(() => ({
    on: vi.fn((event, callback) => {
      if (event === "close") {
        // Simulate successful command execution
        setTimeout(() => callback(0), 0);
      }
    }),
  })),
}));

// Mock UI module to prevent console output during tests
vi.mock("../ui/index.js", () => ({
  colors: {
    bold: (s: string) => s,
    dim: (s: string) => s,
    accent: (s: string) => s,
    underline: (s: string) => s,
    warning: (s: string) => s,
    success: (s: string) => s,
    error: (s: string) => s,
  },
  log: {
    success: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    dim: vi.fn(),
  },
  banners: {
    ensemble: vi.fn(),
    conductor: vi.fn(),
    edgit: vi.fn(),
    chamber: vi.fn(),
    cloud: vi.fn(),
  },
}));

import { route } from "../router.js";
import { spawn } from "node:child_process";
import { log, banners } from "../ui/index.js";

describe("router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("route()", () => {
    it("should handle empty command array", async () => {
      await route([]);
      expect(log.dim).toHaveBeenCalledWith(
        "No command provided. Run `ensemble --help` for usage.",
      );
    });

    it("should route conductor commands", async () => {
      await route(["conductor", "--help"]);
      expect(banners.conductor).toHaveBeenCalled();
    });

    it("should route edgit commands", async () => {
      await route(["edgit", "--help"]);
      expect(banners.edgit).toHaveBeenCalled();
    });

    it("should route chamber commands", async () => {
      await route(["chamber", "--help"]);
      expect(banners.chamber).toHaveBeenCalled();
    });

    it("should route cloud commands", async () => {
      await route(["cloud", "--help"]);
      expect(banners.cloud).toHaveBeenCalled();
    });

    it("should route login command", async () => {
      await route(["login"]);
      expect(log.warn).toHaveBeenCalledWith("Login command coming soon...");
    });

    it("should route config command", async () => {
      await route(["config"]);
      expect(log.warn).toHaveBeenCalledWith("Config command coming soon...");
    });

    it("should passthrough unknown commands to wrangler", async () => {
      await route(["dev"]);
      expect(spawn).toHaveBeenCalledWith(
        "wrangler",
        ["dev"],
        expect.any(Object),
      );
    });

    it("should passthrough deploy to wrangler", async () => {
      await route(["deploy", "--dry-run"]);
      expect(spawn).toHaveBeenCalledWith(
        "wrangler",
        ["deploy", "--dry-run"],
        expect.any(Object),
      );
    });
  });

  describe("conductor subcommands", () => {
    it("should show help with no args", async () => {
      await route(["conductor"]);
      expect(banners.conductor).toHaveBeenCalled();
    });

    it("should show help with -h flag", async () => {
      await route(["conductor", "-h"]);
      expect(banners.conductor).toHaveBeenCalled();
    });

    it("should handle conductor init (coming soon)", async () => {
      await route(["conductor", "init"]);
      expect(log.warn).toHaveBeenCalledWith("conductor init coming soon...");
    });

    it("should passthrough conductor dev to wrangler", async () => {
      await route(["conductor", "dev"]);
      expect(spawn).toHaveBeenCalledWith(
        "wrangler",
        ["dev"],
        expect.any(Object),
      );
    });

    it("should passthrough conductor deploy to wrangler", async () => {
      await route(["conductor", "deploy"]);
      expect(spawn).toHaveBeenCalledWith(
        "wrangler",
        ["deploy"],
        expect.any(Object),
      );
    });

    it("should handle conductor validate (coming soon)", async () => {
      await route(["conductor", "validate"]);
      expect(log.warn).toHaveBeenCalledWith(
        "conductor validate coming soon...",
      );
    });

    it("should handle conductor keys (coming soon)", async () => {
      await route(["conductor", "keys"]);
      expect(log.warn).toHaveBeenCalledWith("conductor keys coming soon...");
    });
  });

  describe("cloud subcommands", () => {
    it("should show help with no args", async () => {
      await route(["cloud"]);
      expect(banners.cloud).toHaveBeenCalled();
    });

    it("should handle cloud init (coming soon)", async () => {
      await route(["cloud", "init"]);
      expect(log.warn).toHaveBeenCalledWith("cloud init coming soon...");
    });

    it("should handle cloud status (coming soon)", async () => {
      await route(["cloud", "status"]);
      expect(log.warn).toHaveBeenCalledWith("cloud status coming soon...");
    });

    it("should handle cloud rotate (coming soon)", async () => {
      await route(["cloud", "rotate"]);
      expect(log.warn).toHaveBeenCalledWith("cloud rotate coming soon...");
    });

    it("should handle cloud disable (coming soon)", async () => {
      await route(["cloud", "disable"]);
      expect(log.warn).toHaveBeenCalledWith("cloud disable coming soon...");
    });

    it("should handle unknown cloud subcommand", async () => {
      await route(["cloud", "unknown"]);
      expect(log.error).toHaveBeenCalledWith("Unknown cloud command: unknown");
    });
  });

  describe("edgit passthrough", () => {
    it("should show help with no args", async () => {
      await route(["edgit"]);
      expect(banners.edgit).toHaveBeenCalled();
    });

    it("should passthrough edgit commands to edgit CLI", async () => {
      await route(["edgit", "tag", "create", "prompt", "v1.0.0"]);
      expect(spawn).toHaveBeenCalledWith(
        "edgit",
        ["tag", "create", "prompt", "v1.0.0"],
        expect.any(Object),
      );
    });
  });

  describe("chamber commands", () => {
    it("should show help with no args", async () => {
      await route(["chamber"]);
      expect(banners.chamber).toHaveBeenCalled();
    });

    it("should handle chamber subcommands (coming soon)", async () => {
      await route(["chamber", "init"]);
      expect(log.warn).toHaveBeenCalledWith("Chamber commands coming soon...");
    });
  });
});
