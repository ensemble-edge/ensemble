import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock child_process before importing router
vi.mock("node:child_process", () => ({
  spawn: vi.fn(() => ({
    on: vi.fn((event, callback) => {
      if (event === "close") {
        setTimeout(() => callback(0), 0);
      }
    }),
    stdout: { on: vi.fn() },
    stderr: { on: vi.fn() },
  })),
}));

// Mock fs modules
vi.mock("node:fs", () => ({
  existsSync: vi.fn(() => false),
  readFileSync: vi.fn(() => JSON.stringify({ version: "0.0.0-test" })),
}));

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(() => Promise.resolve("")),
  writeFile: vi.fn(() => Promise.resolve()),
  mkdir: vi.fn(() => Promise.resolve()),
  readdir: vi.fn(() => Promise.resolve([])),
  stat: vi.fn(() => Promise.resolve({ isDirectory: () => false })),
  copyFile: vi.fn(() => Promise.resolve()),
}));

// Mock UI module
vi.mock("../ui/index.js", () => ({
  colors: {
    bold: (s: string) => s,
    dim: (s: string) => s,
    accent: (s: string) => s,
    underline: (s: string) => s,
    warning: (s: string) => s,
    success: (s: string) => s,
    error: (s: string) => s,
    primaryBold: (s: string) => s,
  },
  log: {
    success: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    dim: vi.fn(),
    newline: vi.fn(),
    plain: vi.fn(),
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
    stop: vi.fn().mockReturnThis(),
    success: vi.fn().mockReturnThis(),
    error: vi.fn().mockReturnThis(),
    warn: vi.fn().mockReturnThis(),
  })),
  promptConfirm: vi.fn().mockResolvedValue(false),
  promptText: vi.fn().mockResolvedValue("my-project"),
  promptSelect: vi.fn().mockResolvedValue("conductor"),
  promptPassword: vi.fn().mockResolvedValue(""),
  promptMultiSelect: vi.fn().mockResolvedValue([]),
  isInteractive: vi.fn().mockReturnValue(false),
  isCI: vi.fn().mockReturnValue(true),
  isDevContainer: vi.fn().mockReturnValue(false),
  successBox: vi.fn((msg: string) => `[SUCCESS BOX: ${msg}]`),
  showNestedSuccess: vi.fn(),
  showNestedAction: vi.fn(),
}));

import { route } from "../router.js";
import { spawn } from "node:child_process";
import { log, banners } from "../ui/index.js";
import { writeFile } from "node:fs/promises";

describe("router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("route()", () => {
    it("should launch wizard with empty command array", async () => {
      // npx @ensemble-edge/ensemble (no args) launches the wizard
      await route([]);

      // Should show ensemble banner
      expect(banners.ensemble).toHaveBeenCalled();

      // Should create package.json with conductor dependency
      expect(writeFile).toHaveBeenCalledWith(
        expect.stringContaining("package.json"),
        expect.stringContaining("@ensemble-edge/conductor"),
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

    it("should show error for unknown commands (no auto-passthrough)", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      await route(["dev"]);
      // Should show helpful error, not passthrough to wrangler
      expect(spawn).not.toHaveBeenCalledWith(
        "wrangler",
        expect.any(Array),
        expect.any(Object),
      );
      // Should show "Did you mean?" suggestion for 'dev' command
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Did you mean?"),
      );
      consoleSpy.mockRestore();
    });

    it("should passthrough explicit wrangler commands", async () => {
      await route(["wrangler", "deploy", "--dry-run"]);
      expect(spawn).toHaveBeenCalledWith(
        "wrangler",
        ["deploy", "--dry-run"],
        expect.any(Object),
      );
    });

    it("should passthrough tail shortcut to wrangler", async () => {
      await route(["tail"]);
      expect(spawn).toHaveBeenCalledWith(
        "wrangler",
        ["tail"],
        expect.any(Object),
      );
    });
  });

  describe("product init commands", () => {
    it("should run conductor init wizard", async () => {
      await route(["conductor", "init"]);

      expect(banners.ensemble).toHaveBeenCalled();
      expect(writeFile).toHaveBeenCalledWith(
        expect.stringContaining("package.json"),
        expect.stringContaining("@ensemble-edge/conductor"),
      );
    });

    it("should pass project name argument to conductor init", async () => {
      await route(["conductor", "init", "my-custom-project"]);

      expect(banners.ensemble).toHaveBeenCalled();
      expect(writeFile).toHaveBeenCalledWith(
        expect.stringContaining("my-custom-project"),
        expect.stringContaining("@ensemble-edge/conductor"),
      );
    });

    it("should pass project name with flags to conductor init", async () => {
      await route(["conductor", "init", "my-custom-project", "-y"]);

      expect(banners.ensemble).toHaveBeenCalled();
      expect(writeFile).toHaveBeenCalledWith(
        expect.stringContaining("my-custom-project"),
        expect.stringContaining("@ensemble-edge/conductor"),
      );
    });

    it("should run edgit init wizard", async () => {
      await route(["edgit", "init"]);

      expect(banners.ensemble).toHaveBeenCalled();
      expect(writeFile).toHaveBeenCalledWith(
        expect.stringContaining("package.json"),
        expect.stringContaining("@ensemble-edge/edgit"),
      );
    });

    it("should show chamber banner for chamber init", async () => {
      await route(["chamber", "init"]);
      expect(banners.chamber).toHaveBeenCalled();
    });

    it("should run cloud init wizard", async () => {
      await route(["cloud", "init"]);

      expect(banners.ensemble).toHaveBeenCalled();
      expect(writeFile).toHaveBeenCalledWith(
        expect.stringContaining("package.json"),
        expect.stringContaining("@ensemble-edge/cloud"),
      );
    });
  });

  describe("conductor non-init commands", () => {
    it("should show help with no args", async () => {
      await route(["conductor"]);
      expect(banners.conductor).toHaveBeenCalled();
      expect(spawn).not.toHaveBeenCalled();
    });

    // Note: conductor dev/start/stop/restart are handled internally by start.ts/stop.ts
    // They check for conductor.config.ts and don't delegate to npx

    it("should delegate conductor deploy to npx", async () => {
      await route(["conductor", "deploy"]);
      expect(spawn).toHaveBeenCalledWith(
        "npx",
        ["@ensemble-edge/conductor", "deploy"],
        expect.any(Object),
      );
    });

    it("should delegate conductor validate to npx", async () => {
      await route(["conductor", "validate"]);
      expect(spawn).toHaveBeenCalledWith(
        "npx",
        ["@ensemble-edge/conductor", "validate"],
        expect.any(Object),
      );
    });
  });

  describe("edgit non-init commands", () => {
    it("should show help with no args", async () => {
      await route(["edgit"]);
      expect(banners.edgit).toHaveBeenCalled();
    });

    it("should handle edgit tag commands internally", async () => {
      // Tag commands are now handled internally (not delegated to npx)
      // They will error if not in a git repo, which is expected in tests
      await route(["edgit", "tag", "create", "prompt", "v1.0.0"]);
      // In non-git-repo context, logs an error
      expect(log.error).toHaveBeenCalledWith("Not a git repository");
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

    it("should handle cloud status (shows uninitialized without wrangler.toml)", async () => {
      await route(["cloud", "status"]);
      // Status command now shows uninitialized state instead of error
      expect(banners.cloud).toHaveBeenCalled();
    });

    it("should handle unknown cloud subcommand", async () => {
      await route(["cloud", "unknown"]);
      expect(log.error).toHaveBeenCalledWith("Unknown cloud command: unknown");
    });
  });

  describe("chamber commands", () => {
    it("should show coming soon info with no args", async () => {
      await route(["chamber"]);
      expect(banners.chamber).toHaveBeenCalled();
    });

    it("should show coming soon info for any subcommand", async () => {
      await route(["chamber", "status"]);
      expect(banners.chamber).toHaveBeenCalled();
    });
  });
});
