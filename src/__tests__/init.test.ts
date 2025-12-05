/**
 * Tests for unified init wizard
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { existsSync } from "node:fs";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { resolve } from "node:path";

// Mock child_process
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

// Mock fs
vi.mock("node:fs", () => ({
  existsSync: vi.fn(() => false),
}));

vi.mock("node:fs/promises", () => ({
  mkdir: vi.fn(() => Promise.resolve()),
  writeFile: vi.fn(() => Promise.resolve()),
  rm: vi.fn(() => Promise.resolve()),
}));

// Mock prompts
vi.mock("../ui/prompts.js", () => ({
  promptConfirm: vi.fn().mockResolvedValue(false),
  promptText: vi.fn().mockResolvedValue("my-test-project"),
  promptSelect: vi.fn().mockResolvedValue("conductor"),
  promptPassword: vi.fn().mockResolvedValue(""),
  promptMultiSelect: vi.fn().mockResolvedValue([]),
  isInteractive: vi.fn().mockReturnValue(false),
  isCI: vi.fn().mockReturnValue(true),
}));

// Mock UI
vi.mock("../ui/index.js", () => ({
  colors: {
    bold: (s: string) => s,
    dim: (s: string) => s,
    accent: (s: string) => s,
    success: (s: string) => s,
    warning: (s: string) => s,
    underline: (s: string) => s,
    error: (s: string) => s,
  },
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
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
  promptText: vi.fn().mockResolvedValue("my-test-project"),
  promptSelect: vi.fn().mockResolvedValue("conductor"),
  promptPassword: vi.fn().mockResolvedValue(""),
  isInteractive: vi.fn().mockReturnValue(false),
  isCI: vi.fn().mockReturnValue(true),
  successBox: vi.fn((msg: string) => `[SUCCESS BOX: ${msg}]`),
  showNestedSuccess: vi.fn(),
  showNestedAction: vi.fn(),
}));

import {
  initWizard,
  conductorInit,
  edgitInit,
  chamberInit,
  cloudInit,
} from "../commands/init.js";
import { banners, log } from "../ui/index.js";
import { spawn } from "node:child_process";

describe("init wizard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("initWizard", () => {
    it("should show ensemble banner", async () => {
      await initWizard();
      expect(banners.ensemble).toHaveBeenCalled();
    });

    it("should create project directory and package.json", async () => {
      await initWizard();

      expect(mkdir).toHaveBeenCalled();
      expect(writeFile).toHaveBeenCalledWith(
        expect.stringContaining("package.json"),
        expect.stringContaining("@ensemble-edge/conductor"),
      );
    });

    it("should run package manager install", async () => {
      await initWizard();

      // First spawn is for install, second is for product init
      expect(spawn).toHaveBeenCalledWith(
        expect.stringMatching(/npm|pnpm|yarn|bun/),
        ["install"],
        expect.any(Object),
      );
    });
  });

  describe("conductorInit", () => {
    it("should create conductor project", async () => {
      await conductorInit();

      expect(banners.ensemble).toHaveBeenCalled();
      expect(writeFile).toHaveBeenCalledWith(
        expect.stringContaining("package.json"),
        expect.stringContaining("@ensemble-edge/conductor"),
      );
    });

    it("should skip install with skipInstall option", async () => {
      vi.mocked(spawn).mockClear();

      await conductorInit({ skipInstall: true });

      // Should not call pnpm install
      expect(spawn).not.toHaveBeenCalledWith(
        "pnpm",
        ["install"],
        expect.any(Object),
      );
    });
  });

  describe("edgitInit", () => {
    it("should create edgit project", async () => {
      await edgitInit();

      expect(banners.ensemble).toHaveBeenCalled();
      expect(writeFile).toHaveBeenCalledWith(
        expect.stringContaining("package.json"),
        expect.stringContaining("@ensemble-edge/edgit"),
      );
    });
  });

  describe("chamberInit", () => {
    it("should show chamber banner and vision", async () => {
      await chamberInit();

      expect(banners.chamber).toHaveBeenCalled();
    });
  });

  describe("cloudInit", () => {
    it("should create cloud project", async () => {
      await cloudInit();

      expect(banners.ensemble).toHaveBeenCalled();
      expect(writeFile).toHaveBeenCalledWith(
        expect.stringContaining("package.json"),
        expect.stringContaining("@ensemble-edge/cloud"),
      );
    });
  });
});
