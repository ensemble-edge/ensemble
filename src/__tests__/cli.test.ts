import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the router module
vi.mock("../router.js", () => ({
  route: vi.fn(),
}));

// Mock UI module
vi.mock("../ui/index.js", () => ({
  colors: {
    bold: (s: string) => s,
    dim: (s: string) => s,
    accent: (s: string) => s,
    underline: (s: string) => s,
  },
  log: {
    error: vi.fn(),
  },
  banners: {
    ensemble: vi.fn(),
  },
}));

import { run } from "../cli.js";
import { route } from "../router.js";
import { version } from "../version.js";
import { log, banners } from "../ui/index.js";

describe("cli", () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    processExitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation(() => undefined as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("run()", () => {
    it("should show help when no arguments provided", async () => {
      await run(["node", "ensemble"]);

      expect(banners.ensemble).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalled();
      expect(route).not.toHaveBeenCalled();
    });

    it("should show help with --help flag", async () => {
      await run(["node", "ensemble", "--help"]);

      expect(banners.ensemble).toHaveBeenCalled();
      expect(route).not.toHaveBeenCalled();
    });

    it("should show help with -h flag", async () => {
      await run(["node", "ensemble", "-h"]);

      expect(banners.ensemble).toHaveBeenCalled();
      expect(route).not.toHaveBeenCalled();
    });

    it("should show version with --version flag", async () => {
      await run(["node", "ensemble", "--version"]);

      expect(consoleLogSpy).toHaveBeenCalledWith(`ensemble v${version}`);
      expect(route).not.toHaveBeenCalled();
    });

    it("should show version with -v flag", async () => {
      await run(["node", "ensemble", "-v"]);

      expect(consoleLogSpy).toHaveBeenCalledWith(`ensemble v${version}`);
      expect(route).not.toHaveBeenCalled();
    });

    it("should route commands to router", async () => {
      await run(["node", "ensemble", "conductor", "init"]);

      expect(route).toHaveBeenCalledWith(["conductor", "init"]);
    });

    it("should route with additional arguments", async () => {
      await run(["node", "ensemble", "dev", "--port", "3000"]);

      expect(route).toHaveBeenCalledWith(["dev", "--port", "3000"]);
    });

    it("should handle router errors", async () => {
      vi.mocked(route).mockRejectedValueOnce(new Error("Test error"));

      await run(["node", "ensemble", "conductor"]);

      expect(log.error).toHaveBeenCalledWith("Test error");
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it("should handle non-Error throws", async () => {
      vi.mocked(route).mockRejectedValueOnce("string error");

      await run(["node", "ensemble", "conductor"]);

      // Should exit but not call log.error since it's not an Error instance
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it("should use process.argv by default", async () => {
      const originalArgv = process.argv;
      process.argv = ["node", "ensemble", "--version"];

      await run();

      expect(consoleLogSpy).toHaveBeenCalledWith(`ensemble v${version}`);

      process.argv = originalArgv;
    });
  });
});
