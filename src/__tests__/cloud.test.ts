/**
 * Tests for cloud commands
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock child_process spawn
vi.mock("node:child_process", () => ({
  spawn: vi.fn(() => ({
    stdin: { write: vi.fn(), end: vi.fn() },
    stdout: { on: vi.fn() },
    stderr: { on: vi.fn() },
    on: vi.fn((event, callback) => {
      if (event === "close") {
        callback(0); // Simulate success
      }
    }),
  })),
}));

// Track existsSync return value
let mockWranglerExists = false;
let mockWranglerContent = "";

// Mock fs modules
vi.mock("node:fs", () => ({
  existsSync: vi.fn(() => mockWranglerExists),
}));

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(() => Promise.resolve(mockWranglerContent)),
  writeFile: vi.fn(() => Promise.resolve()),
}));

// Mock UI module
vi.mock("../ui/index.js", () => ({
  colors: {
    dim: (s: string) => s,
    bold: (s: string) => s,
    accent: (s: string) => s,
    success: (s: string) => s,
    warning: (s: string) => s,
    error: (s: string) => s,
    underline: (s: string) => s,
    primaryBold: (s: string) => s,
  },
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    dim: vi.fn(),
  },
  banners: {
    cloud: vi.fn(),
  },
  createSpinner: vi.fn(() => ({
    start: vi.fn().mockReturnThis(),
    success: vi.fn().mockReturnThis(),
    error: vi.fn().mockReturnThis(),
  })),
  successBox: vi.fn((title, content) => `${title}\n${content}`),
  promptConfirm: vi.fn().mockResolvedValue(false),
  isInteractive: vi.fn().mockReturnValue(false),
}));

import {
  cloudInit,
  cloudStatus,
  cloudRotate,
  cloudDisable,
  showCloudHelp,
  routeCloudCommand,
} from "../commands/cloud.js";
import { log, banners } from "../ui/index.js";

describe("cloud commands", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWranglerExists = false;
    mockWranglerContent = "";
  });

  describe("showCloudHelp", () => {
    it("should show banner and help text", () => {
      showCloudHelp();
      expect(banners.cloud).toHaveBeenCalled();
    });
  });

  describe("routeCloudCommand", () => {
    it("should show help with no args", async () => {
      await routeCloudCommand([]);
      expect(banners.cloud).toHaveBeenCalled();
    });

    it("should show help with --help flag", async () => {
      await routeCloudCommand(["--help"]);
      expect(banners.cloud).toHaveBeenCalled();
    });

    it("should show help with -h flag", async () => {
      await routeCloudCommand(["-h"]);
      expect(banners.cloud).toHaveBeenCalled();
    });

    it("should route to init command", async () => {
      await routeCloudCommand(["init"]);
      // Without wrangler.toml, should error
      expect(log.error).toHaveBeenCalledWith("No wrangler.toml found.");
    });

    it("should route to status command", async () => {
      await routeCloudCommand(["status"]);
      // Status command now shows uninitialized state instead of error
      expect(banners.cloud).toHaveBeenCalled();
    });

    it("should route to rotate command", async () => {
      await routeCloudCommand(["rotate"]);
      expect(log.error).toHaveBeenCalledWith("No wrangler.toml found.");
    });

    it("should route to disable command", async () => {
      await routeCloudCommand(["disable"]);
      expect(log.error).toHaveBeenCalledWith("No wrangler.toml found.");
    });

    it("should handle unknown subcommand", async () => {
      await routeCloudCommand(["unknown"]);
      expect(log.error).toHaveBeenCalledWith("Unknown cloud command: unknown");
    });
  });

  describe("cloudInit", () => {
    it("should error without wrangler.toml", async () => {
      await cloudInit([]);
      expect(log.error).toHaveBeenCalledWith("No wrangler.toml found.");
    });

    it("should work with wrangler.toml present", async () => {
      mockWranglerExists = true;
      mockWranglerContent = 'name = "test-worker"';

      await cloudInit([]);
      expect(banners.cloud).toHaveBeenCalled();
      // Should not error about missing config
      expect(log.error).not.toHaveBeenCalledWith("No wrangler.toml found.");
    });

    it("should parse --env flag", async () => {
      mockWranglerExists = true;
      mockWranglerContent = 'name = "test-worker"';

      await cloudInit(["--env", "staging"]);
      expect(banners.cloud).toHaveBeenCalled();
    });
  });

  describe("cloudStatus", () => {
    it("should show uninitialized status without wrangler.toml", async () => {
      await cloudStatus([]);
      // Status command now shows uninitialized state instead of error
      expect(banners.cloud).toHaveBeenCalled();
    });

    it("should output JSON with --json flag and no config", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await cloudStatus(["--json"]);
      expect(consoleSpy).toHaveBeenCalledWith(
        JSON.stringify({
          initialized: false,
          enabled: false,
          error: "No wrangler.toml - Conductor project required",
        }),
      );

      consoleSpy.mockRestore();
    });

    it("should show status when wrangler.toml exists", async () => {
      mockWranglerExists = true;
      mockWranglerContent = 'name = "test-worker"';

      await cloudStatus([]);
      expect(banners.cloud).toHaveBeenCalled();
    });

    it("should show enabled status when cloud is configured", async () => {
      mockWranglerExists = true;
      mockWranglerContent = `name = "test-worker"
[ensemble.cloud]
enabled = true`;

      await cloudStatus([]);
      expect(banners.cloud).toHaveBeenCalled();
    });

    it("should output JSON with enabled status", async () => {
      mockWranglerExists = true;
      mockWranglerContent = `name = "test-worker"
[ensemble.cloud]
enabled = true`;

      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await cloudStatus(["--json"]);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"enabled":true'),
      );

      consoleSpy.mockRestore();
    });
  });

  describe("cloudRotate", () => {
    it("should error without wrangler.toml", async () => {
      await cloudRotate([]);
      expect(log.error).toHaveBeenCalledWith("No wrangler.toml found.");
    });

    it("should show warning without --yes flag", async () => {
      mockWranglerExists = true;
      mockWranglerContent = 'name = "test-worker"';

      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await cloudRotate([]);
      // Should show warning about confirmation
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it("should rotate with --yes flag", async () => {
      mockWranglerExists = true;
      mockWranglerContent = 'name = "test-worker"';

      await cloudRotate(["--yes"]);
      expect(banners.cloud).toHaveBeenCalled();
    });

    it("should rotate with -y flag", async () => {
      mockWranglerExists = true;
      mockWranglerContent = 'name = "test-worker"';

      await cloudRotate(["-y"]);
      expect(banners.cloud).toHaveBeenCalled();
    });

    it("should parse --env flag with --yes", async () => {
      mockWranglerExists = true;
      mockWranglerContent = 'name = "test-worker"';

      await cloudRotate(["--env", "staging", "--yes"]);
      expect(banners.cloud).toHaveBeenCalled();
    });
  });

  describe("cloudDisable", () => {
    it("should error without wrangler.toml", async () => {
      await cloudDisable([]);
      expect(log.error).toHaveBeenCalledWith("No wrangler.toml found.");
    });

    it("should show warning without --yes flag", async () => {
      mockWranglerExists = true;
      mockWranglerContent = 'name = "test-worker"';

      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await cloudDisable([]);
      // Should show warning about confirmation
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it("should disable with --yes flag", async () => {
      mockWranglerExists = true;
      mockWranglerContent = `name = "test-worker"
[ensemble.cloud]
enabled = true`;

      await cloudDisable(["--yes"]);
      expect(banners.cloud).toHaveBeenCalled();
    });

    it("should disable with -y flag", async () => {
      mockWranglerExists = true;
      mockWranglerContent = `name = "test-worker"
[ensemble.cloud]
enabled = true`;

      await cloudDisable(["-y"]);
      expect(banners.cloud).toHaveBeenCalled();
    });
  });
});
