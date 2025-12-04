/**
 * Consistent logging utilities
 */

import { colors, statusIcons, icons } from "./colors.js";

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
 */
export const banners = {
  ensemble: () => {
    console.log("");
    console.log(`  ${icons.ensemble} ${colors.primaryBold("Ensemble")}`);
    console.log(colors.dim("  AI orchestration for Cloudflare Workers"));
    console.log("");
  },

  conductor: () => {
    console.log("");
    console.log(`  ${icons.conductor} ${colors.primaryBold("Conductor")}`);
    console.log(colors.dim("  Edge-native AI workflow orchestration"));
    console.log("");
  },

  edgit: () => {
    console.log("");
    console.log(`  ${icons.edgit} ${colors.primaryBold("Edgit")}`);
    console.log(colors.dim("  Git-native versioning for AI components"));
    console.log("");
  },

  chamber: () => {
    console.log("");
    console.log(`  ${icons.chamber} ${colors.primaryBold("Chamber")}`);
    console.log(colors.dim("  The living edge database"));
    console.log("");
  },

  cloud: () => {
    console.log("");
    console.log(`  ${icons.cloud} ${colors.primaryBold("Ensemble Cloud")}`);
    console.log(colors.dim("  Managed AI orchestration platform"));
    console.log("");
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
