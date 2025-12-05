/**
 * Tests for conductor commands
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Track mock values
let mockExistsSync = false;

// Mock child_process spawn
vi.mock("node:child_process", () => ({
  spawn: vi.fn(() => ({
    stdin: { write: vi.fn(), end: vi.fn() },
    stdout: { on: vi.fn() },
    stderr: { on: vi.fn() },
    on: vi.fn((event, callback) => {
      if (event === "close") {
        callback(0);
      }
    }),
  })),
}));

// Mock fs modules
vi.mock("node:fs", () => ({
  existsSync: vi.fn(() => mockExistsSync),
}));

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(() => Promise.resolve("{}")),
  writeFile: vi.fn(() => Promise.resolve()),
  mkdir: vi.fn(() => Promise.resolve()),
  readdir: vi.fn(() => Promise.resolve([])),
  stat: vi.fn(() => Promise.resolve({ isDirectory: () => false })),
  copyFile: vi.fn(() => Promise.resolve()),
}));

// Mock UI module
vi.mock("../ui/index.js", () => ({
  colors: {
    dim: (s: string) => s,
    bold: (s: string) => s,
    accent: (s: string) => s,
    success: (s: string) => s,
    warning: (s: string) => s,
    underline: (s: string) => s,
  },
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    dim: vi.fn(),
  },
  banners: {
    conductor: vi.fn(),
  },
  createSpinner: vi.fn(() => ({
    start: vi.fn().mockReturnThis(),
    success: vi.fn().mockReturnThis(),
    error: vi.fn().mockReturnThis(),
  })),
  successBox: vi.fn((title, content) => `${title}\n${content}`),
}));

import {
  conductorInit,
  conductorValidate,
  conductorKeys,
  showConductorHelp,
  routeConductorCommand,
} from "../commands/conductor.js";
import { log, banners } from "../ui/index.js";

describe("conductor commands", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExistsSync = false;
  });

  describe("showConductorHelp", () => {
    it("should show banner and help text", () => {
      showConductorHelp();
      expect(banners.conductor).toHaveBeenCalled();
    });
  });

  describe("routeConductorCommand", () => {
    it("should show help with no args", async () => {
      await routeConductorCommand([]);
      expect(banners.conductor).toHaveBeenCalled();
    });

    it("should show help with --help flag", async () => {
      await routeConductorCommand(["--help"]);
      expect(banners.conductor).toHaveBeenCalled();
    });

    it("should show help with -h flag", async () => {
      await routeConductorCommand(["-h"]);
      expect(banners.conductor).toHaveBeenCalled();
    });

    it("should route to init command", async () => {
      await routeConductorCommand(["init"]);
      // Without conductor package, shows info message
      expect(log.info).toHaveBeenCalledWith("Install Conductor first:");
    });

    it("should route to validate command", async () => {
      await routeConductorCommand(["validate"]);
      // Not in a conductor project
      expect(log.error).toHaveBeenCalledWith("Not a Conductor project.");
    });

    it("should route to keys command", async () => {
      await routeConductorCommand(["keys"]);
      expect(log.warn).toHaveBeenCalledWith(
        "Key management via ensemble CLI coming soon...",
      );
    });

    it("should handle unknown subcommand", async () => {
      await routeConductorCommand(["unknown"]);
      expect(log.error).toHaveBeenCalledWith(
        "Unknown conductor command: unknown",
      );
    });
  });

  describe("conductorInit", () => {
    it("should require conductor package installed", async () => {
      await conductorInit([]);
      expect(banners.conductor).toHaveBeenCalled();
      expect(log.info).toHaveBeenCalledWith("Install Conductor first:");
    });

    it("should show help for npx fallback", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await conductorInit(["my-project"]);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe("conductorValidate", () => {
    it("should error when not in a conductor project", async () => {
      await conductorValidate([]);
      expect(log.error).toHaveBeenCalledWith("Not a Conductor project.");
    });
  });

  describe("conductorKeys", () => {
    it("should show coming soon message", async () => {
      await conductorKeys([]);
      expect(log.warn).toHaveBeenCalledWith(
        "Key management via ensemble CLI coming soon...",
      );
    });

    it("should show wrangler secret commands", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await conductorKeys([]);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });
});
