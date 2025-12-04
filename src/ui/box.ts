/**
 * Box drawing for success summaries and callouts
 */

import { colors } from "./colors.js";

/**
 * Box characters
 */
const BOX = {
  topLeft: "┌",
  topRight: "┐",
  bottomLeft: "└",
  bottomRight: "┘",
  horizontal: "─",
  vertical: "│",
};

/**
 * Draw a box around content
 *
 * @example
 * console.log(box('Hello, World!'));
 * // ┌─────────────────┐
 * // │  Hello, World!  │
 * // └─────────────────┘
 */
export function box(content: string, options?: { width?: number }): string {
  const lines = content.split("\n");
  const maxLineWidth = Math.max(...lines.map((l) => stripAnsi(l).length));
  const width = options?.width ?? maxLineWidth + 4; // 2 padding + 2 border

  const innerWidth = width - 2;
  const horizontalLine = BOX.horizontal.repeat(innerWidth);

  const top = BOX.topLeft + horizontalLine + BOX.topRight;
  const bottom = BOX.bottomLeft + horizontalLine + BOX.bottomRight;

  const paddedLines = lines.map((line) => {
    const stripped = stripAnsi(line);
    const padding = innerWidth - stripped.length - 2; // -2 for left/right space
    const rightPad = " ".repeat(Math.max(0, padding));
    return BOX.vertical + " " + line + rightPad + " " + BOX.vertical;
  });

  return [top, ...paddedLines, bottom].join("\n");
}

/**
 * Draw a success box
 */
export function successBox(title: string, content?: string): string {
  const titleLine = `${colors.success("✓")} ${title}`;
  const lines = content ? [titleLine, "", content] : [titleLine];
  return box(lines.join("\n"));
}

/**
 * Draw an info box
 */
export function infoBox(title: string, content?: string): string {
  const titleLine = `${colors.accent("ℹ")} ${title}`;
  const lines = content ? [titleLine, "", content] : [titleLine];
  return box(lines.join("\n"));
}

/**
 * Draw a warning box
 */
export function warningBox(title: string, content?: string): string {
  const titleLine = `${colors.warning("⚠")} ${title}`;
  const lines = content ? [titleLine, "", content] : [titleLine];
  return box(lines.join("\n"));
}

/**
 * Draw a recommendation box (for cross-product discovery)
 */
export function recommendBox(lines: string[]): string {
  return box(lines.join("\n"));
}

/**
 * Strip ANSI escape codes from a string
 */
function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*m/g, "");
}

/**
 * Create a section with a header
 */
export function section(title: string, content: string): string {
  return `${colors.bold(title)}\n\n${content}`;
}

/**
 * Create a labeled list item
 */
export function listItem(
  icon: string,
  label: string,
  description: string,
): string {
  return `   ${icon}  ${colors.bold(label)}\n       ${colors.dim(description)}`;
}
