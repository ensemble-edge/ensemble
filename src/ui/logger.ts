/**
 * Consistent logging utilities
 */

import { colors, statusIcons, icons } from "./colors.js";

// ─────────────────────────────────────────────────────────────────────────────
// ASCII Art Banners
// ─────────────────────────────────────────────────────────────────────────────

const ASCII_BANNERS = {
  conductor: `
   ______                __           __
  / ____/___  ____  ____/ /_  _______/ /_____  _____
 / /   / __ \\/ __ \\/ __  / / / / ___/ __/ __ \\/ ___/
/ /___/ /_/ / / / / /_/ / /_/ / /__/ /_/ /_/ / /
\\____/\\____/_/ /_/\\__,_/\\__,_/\\___/\\__/\\____/_/
`,

  edgit: `
   ______    __      _ __
  / ____/___/ /___ _(_) /_
 / __/ / __  / __ \`/ / __/
/ /___/ /_/ / /_/ / / /_
\\____/\\__,_/\\__, /_/\\__/
           /____/
`,

  cloud: `
   ________                __
  / ____/ /___  __  ______/ /
 / /   / / __ \\/ / / / __  /
/ /___/ / /_/ / /_/ / /_/ /
\\____/_/\\____/\\__,_/\\__,_/
`,

  ensemble: `
   ______                          __    __
  / ____/___  ________  ____ ___  / /_  / /__
 / __/ / __ \\/ ___/ _ \\/ __ \`__ \\/ __ \\/ / _ \\
/ /___/ / / (__  )  __/ / / / / / /_/ / /  __/
\\____/_/ /_/____/\\___/_/ /_/ /_/_.___/_/\\___/
`,
};

/**
 * Get terminal width (defaults to 80 if unavailable)
 */
function getTerminalWidth(): number {
  return process.stdout.columns || 80;
}

/**
 * Check if terminal is wide enough for ASCII art
 */
function useAsciiArt(): boolean {
  return getTerminalWidth() >= 60;
}

/**
 * Log levels
 */
export const log = {
  /**
   * Success message
   */
  success: (message: string) => {
    console.log(`${colors.success(statusIcons.success)} ${message}`);
  },

  /**
   * Error message
   */
  error: (message: string) => {
    console.error(`${colors.error(statusIcons.error)} ${message}`);
  },

  /**
   * Warning message
   */
  warn: (message: string) => {
    console.log(`${colors.warning(statusIcons.warning)} ${message}`);
  },

  /**
   * Info message
   */
  info: (message: string) => {
    console.log(`${colors.accent(statusIcons.info)} ${message}`);
  },

  /**
   * Dim/muted message
   */
  dim: (message: string) => {
    console.log(colors.dim(message));
  },

  /**
   * Plain message (no prefix)
   */
  plain: (message: string) => {
    console.log(message);
  },

  /**
   * Blank line
   */
  newline: () => {
    console.log("");
  },

  /**
   * Indented message
   */
  indent: (message: string, level: number = 1) => {
    const indent = "  ".repeat(level);
    console.log(`${indent}${message}`);
  },
};

/**
 * Product banners
 *
 * Uses ASCII art for wide terminals (>= 60 cols), falls back to simple
 * emoji-based banners for narrow terminals.
 */
export const banners = {
  ensemble: () => {
    if (useAsciiArt()) {
      console.log(colors.primary(ASCII_BANNERS.ensemble));
      console.log(colors.dim("Ensemble CLI — by Ensemble-Edge"));
      console.log("");
    } else {
      console.log("");
      console.log(`  ${icons.ensemble} ${colors.primaryBold("Ensemble CLI")}`);
      console.log(colors.dim("  by Ensemble-Edge"));
      console.log("");
    }
  },

  conductor: () => {
    if (useAsciiArt()) {
      console.log(colors.primary(ASCII_BANNERS.conductor));
      console.log(colors.dim("by Ensemble-Edge"));
      console.log("");
    } else {
      console.log("");
      console.log(`  ${icons.conductor} ${colors.primaryBold("Conductor")}`);
      console.log(colors.dim("  Edge-native AI workflow orchestration"));
      console.log("");
    }
  },

  edgit: () => {
    if (useAsciiArt()) {
      console.log(colors.primary(ASCII_BANNERS.edgit));
      console.log(colors.dim("by Ensemble-Edge"));
      console.log("");
    } else {
      console.log("");
      console.log(`  ${icons.edgit} ${colors.primaryBold("Edgit")}`);
      console.log(colors.dim("  Git-native versioning for AI components"));
      console.log("");
    }
  },

  chamber: () => {
    // Chamber doesn't have ASCII art yet (coming soon product)
    console.log("");
    console.log(`  ${icons.chamber} ${colors.primaryBold("Chamber")}`);
    console.log(colors.dim("  The living edge database"));
    console.log("");
  },

  cloud: () => {
    if (useAsciiArt()) {
      console.log(colors.primary(ASCII_BANNERS.cloud));
      console.log(colors.dim("by Ensemble-Edge"));
      console.log("");
    } else {
      console.log("");
      console.log(`  ${icons.cloud} ${colors.primaryBold("Ensemble Cloud")}`);
      console.log(colors.dim("  Managed AI orchestration platform"));
      console.log("");
    }
  },
};

/**
 * Print a command example
 */
export function printCommand(cmd: string, description?: string): void {
  if (description) {
    console.log(`  ${colors.accent(cmd)}  ${colors.dim(description)}`);
  } else {
    console.log(`  ${colors.accent(cmd)}`);
  }
}

/**
 * Print a URL
 */
export function printUrl(label: string, url: string): void {
  console.log(
    `${colors.dim(label + ":")} ${colors.underline(colors.accent(url))}`,
  );
}

/**
 * Show nested success item (indented with checkmark)
 */
export function showNestedSuccess(message: string): void {
  console.log(`   ${colors.success("✓")} ${message}`);
}

/**
 * Show nested action item (indented, dim)
 */
export function showNestedAction(message: string): void {
  console.log(`   ${colors.dim(message)}`);
}
