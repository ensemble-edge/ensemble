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

// Mock fs modules for conductor commands
vi.mock("node:fs", () => ({
  existsSync: vi.fn(() => false),
}));

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(() => Promise.resolve("")),
  writeFile: vi.fn(() => Promise.resolve()),
  mkdir: vi.fn(() => Promise.resolve()),
  readdir: vi.fn(() => Promise.resolve([])),
  stat: vi.fn(() => Promise.resolve({ isDirectory: () => false })),
  copyFile: vi.fn(() => Promise.resolve()),
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
  createSpinner: vi.fn(() => ({
    start: vi.fn().mockReturnThis(),
    success: vi.fn().mockReturnThis(),
    error: vi.fn().mockReturnThis(),
    warn: vi.fn().mockReturnThis(),
  })),
  successBox: vi.fn((title, content) => `${title}\n${content}`),
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
      // Edgit uses subprocess spawning via npx
      expect(spawn).toHaveBeenCalledWith(
        "npx",
        ["edgit", "--help"],
        expect.any(Object),
      );
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

    it("should handle conductor init (bundled templates)", async () => {
      await route(["conductor", "init"]);
      // Init now uses bundled templates - banner is always shown
      // In test environment with mocked fs (existsSync returns false), templates won't be found
      // so it will show an error about missing templates
      expect(banners.conductor).toHaveBeenCalled();
      expect(log.error).toHaveBeenCalledWith(
        "Conductor templates are missing from the ensemble CLI package.",
      );
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

    it("should handle conductor validate (requires conductor project)", async () => {
      await route(["conductor", "validate"]);
      // Not in a conductor project
      expect(log.error).toHaveBeenCalledWith("Not a Conductor project.");
    });

    it("should handle conductor keys", async () => {
      await route(["conductor", "keys"]);
      expect(log.warn).toHaveBeenCalledWith(
        "Key management via ensemble CLI coming soon...",
      );
    });
  });

  describe("cloud subcommands", () => {
    it("should show help with no args", async () => {
      await route(["cloud"]);
      expect(banners.cloud).toHaveBeenCalled();
    });

    it("should show help with -h flag", async () => {
      await route(["cloud", "-h"]);
      expect(banners.cloud).toHaveBeenCalled();
    });

    it("should show help with --help flag", async () => {
      await route(["cloud", "--help"]);
      expect(banners.cloud).toHaveBeenCalled();
    });

    it("should handle cloud init (requires wrangler.toml)", async () => {
      await route(["cloud", "init"]);
      // Without wrangler.toml, shows error
      expect(log.error).toHaveBeenCalledWith("No wrangler.toml found.");
    });

    it("should handle cloud status (requires wrangler.toml)", async () => {
      await route(["cloud", "status"]);
      // Without wrangler.toml, shows error
      expect(log.error).toHaveBeenCalledWith("No wrangler.toml found.");
    });

    it("should handle cloud rotate (requires confirmation)", async () => {
      await route(["cloud", "rotate"]);
      // Without wrangler.toml, shows error
      expect(log.error).toHaveBeenCalledWith("No wrangler.toml found.");
    });

    it("should handle cloud disable (requires confirmation)", async () => {
      await route(["cloud", "disable"]);
      // Without wrangler.toml, shows error
      expect(log.error).toHaveBeenCalledWith("No wrangler.toml found.");
    });

    it("should handle unknown cloud subcommand", async () => {
      await route(["cloud", "unknown"]);
      expect(log.error).toHaveBeenCalledWith("Unknown cloud command: unknown");
    });
  });

  describe("edgit subprocess spawning", () => {
    it("should spawn edgit via npx with no args", async () => {
      await route(["edgit"]);
      // Subprocess spawning via npx for version decoupling
      expect(spawn).toHaveBeenCalledWith("npx", ["edgit"], expect.any(Object));
    });

    it("should pass all args to edgit subprocess", async () => {
      await route(["edgit", "tag", "create", "prompt", "v1.0.0"]);
      expect(spawn).toHaveBeenCalledWith(
        "npx",
        ["edgit", "tag", "create", "prompt", "v1.0.0"],
        expect.any(Object),
      );
    });

    it("should handle edgit init command", async () => {
      await route(["edgit", "init"]);
      expect(spawn).toHaveBeenCalledWith(
        "npx",
        ["edgit", "init"],
        expect.any(Object),
      );
    });

    it("should handle edgit components command", async () => {
      await route(["edgit", "components", "list"]);
      expect(spawn).toHaveBeenCalledWith(
        "npx",
        ["edgit", "components", "list"],
        expect.any(Object),
      );
    });

    it("should handle edgit deploy command", async () => {
      await route(["edgit", "deploy", "set", "prompt", "--to", "staging"]);
      expect(spawn).toHaveBeenCalledWith(
        "npx",
        ["edgit", "deploy", "set", "prompt", "--to", "staging"],
        expect.any(Object),
      );
    });

    it("should spawn edgit status command", async () => {
      await route(["edgit", "status"]);
      expect(spawn).toHaveBeenCalledWith(
        "npx",
        ["edgit", "status"],
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
