import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  colors,
  statusIcons,
  renderStepHeader,
  renderProgressBar,
  renderProgress,
  keys,
  hints,
  renderHint,
  box,
  successBox,
  infoBox,
  warningBox,
  section,
  listItem,
  CONDUCTOR_INIT_STEPS,
  EDGIT_INIT_STEPS,
  CLOUD_INIT_STEPS,
} from "../ui/index.js";

describe("ui/colors", () => {
  describe("colors", () => {
    it("should export color functions", () => {
      expect(typeof colors.bold).toBe("function");
      expect(typeof colors.dim).toBe("function");
      expect(typeof colors.accent).toBe("function");
      expect(typeof colors.primary).toBe("function");
      expect(typeof colors.success).toBe("function");
      expect(typeof colors.error).toBe("function");
      expect(typeof colors.warning).toBe("function");
      expect(typeof colors.underline).toBe("function");
    });

    it("should apply formatting to strings", () => {
      // These will include ANSI codes in the output
      const result = colors.bold("test");
      expect(result).toContain("test");
    });
  });

  describe("statusIcons", () => {
    it("should export status icons", () => {
      expect(statusIcons.success).toBeDefined();
      expect(statusIcons.error).toBeDefined();
      expect(statusIcons.warning).toBeDefined();
      expect(statusIcons.info).toBeDefined();
      expect(statusIcons.pending).toBeDefined();
      expect(statusIcons.active).toBeDefined();
    });
  });
});

describe("ui/progress", () => {
  describe("renderStepHeader", () => {
    it("should render step header with current/total", () => {
      const result = renderStepHeader(3, 11, "Project Name");
      expect(result).toContain("Step 3 of 11");
      expect(result).toContain("Project Name");
    });
  });

  describe("renderProgressBar", () => {
    it("should render progress bar", () => {
      const result = renderProgressBar(5, 10);
      expect(result).toContain("5/10");
      expect(result).toContain("█"); // filled
      expect(result).toContain("░"); // empty
    });

    it("should handle 0 progress", () => {
      const result = renderProgressBar(0, 10);
      expect(result).toContain("0/10");
    });

    it("should handle complete progress", () => {
      const result = renderProgressBar(10, 10);
      expect(result).toContain("10/10");
    });

    it("should accept custom width", () => {
      const result = renderProgressBar(5, 10, 20);
      expect(result).toContain("5/10");
    });
  });

  describe("renderProgress", () => {
    it("should combine header and bar", () => {
      const result = renderProgress(3, 10, "Installing");
      expect(result).toContain("Step 3 of 10");
      expect(result).toContain("Installing");
      expect(result).toContain("3/10");
    });
  });

  describe("step constants", () => {
    it("should export CONDUCTOR_INIT_STEPS", () => {
      expect(Array.isArray(CONDUCTOR_INIT_STEPS)).toBe(true);
      expect(CONDUCTOR_INIT_STEPS.length).toBeGreaterThan(0);
      expect(CONDUCTOR_INIT_STEPS[0]).toHaveProperty("id");
      expect(CONDUCTOR_INIT_STEPS[0]).toHaveProperty("name");
    });

    it("should export EDGIT_INIT_STEPS", () => {
      expect(Array.isArray(EDGIT_INIT_STEPS)).toBe(true);
      expect(EDGIT_INIT_STEPS.length).toBeGreaterThan(0);
    });

    it("should export CLOUD_INIT_STEPS", () => {
      expect(Array.isArray(CLOUD_INIT_STEPS)).toBe(true);
      expect(CLOUD_INIT_STEPS.length).toBeGreaterThan(0);
    });
  });
});

describe("ui/hints", () => {
  describe("keys", () => {
    it("should export key constants", () => {
      expect(keys.enter).toBeDefined();
      expect(keys.space).toBeDefined();
      expect(keys.up).toBeDefined();
      expect(keys.down).toBeDefined();
      expect(keys.escape).toBeDefined();
    });
  });

  describe("hints", () => {
    it("should export hint messages", () => {
      expect(hints.confirm).toBeDefined();
      expect(hints.text).toBeDefined();
      expect(hints.select).toBeDefined();
      expect(hints.multiselect).toBeDefined();
      expect(hints.cancel).toBeDefined();
    });
  });

  describe("renderHint", () => {
    it("should render hint with dimmed styling", () => {
      const result = renderHint("Press enter to continue");
      expect(result).toContain("Press enter to continue");
    });

    it("should render predefined hints", () => {
      const result = renderHint(hints.confirm);
      expect(result).toContain("Enter");
    });
  });
});

describe("ui/box", () => {
  describe("box", () => {
    it("should create a bordered box", () => {
      const result = box("Test content");
      expect(result).toContain("Test content");
      expect(result).toContain("│"); // vertical border
    });

    it("should handle multiline content", () => {
      const result = box("Line 1\nLine 2");
      expect(result).toContain("Line 1");
      expect(result).toContain("Line 2");
    });

    it("should accept custom width", () => {
      const result = box("Test", { width: 40 });
      expect(result).toContain("Test");
    });
  });

  describe("successBox", () => {
    it("should create a success box with icon", () => {
      const result = successBox("Success!", "Operation completed");
      expect(result).toContain("Success!");
      expect(result).toContain("Operation completed");
    });
  });

  describe("infoBox", () => {
    it("should create an info box", () => {
      const result = infoBox("Info!", "Some information");
      expect(result).toContain("Info!");
      expect(result).toContain("Some information");
    });
  });

  describe("warningBox", () => {
    it("should create a warning box", () => {
      const result = warningBox("Warning!", "Be careful");
      expect(result).toContain("Warning!");
      expect(result).toContain("Be careful");
    });
  });

  describe("section", () => {
    it("should create a section with title", () => {
      const result = section("Title", "Content here");
      expect(result).toContain("Title");
      expect(result).toContain("Content here");
    });
  });

  describe("listItem", () => {
    it("should create a labeled list item", () => {
      const result = listItem("→", "Label", "Description");
      expect(result).toContain("→");
      expect(result).toContain("Label");
      expect(result).toContain("Description");
    });
  });
});
