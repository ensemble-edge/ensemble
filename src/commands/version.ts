/**
 * Enhanced version command
 *
 * Shows the Ensemble landscape:
 * - CLI version and update status
 * - Scans for all Ensemble projects in subdirectories
 * - Shows each project's packages and update status
 * - Tree view display for easy visualization
 */

import { colors, createSpinner } from "../ui/index.js";
import {
  getLandscape,
  displayLandscape,
  displayLandscapeCompact,
} from "./landscape.js";

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Show version information with full landscape scan
 */
export async function showVersion(): Promise<void> {
  const spinner = createSpinner("Scanning for Ensemble projects...");
  spinner.start();

  try {
    const landscape = await getLandscape(process.cwd(), 3);
    spinner.stop();

    console.log("");
    displayLandscape(landscape);
  } catch (error) {
    spinner.stop();
    console.log(
      `${colors.bold("ensemble")} v${(await import("../version.js")).version}`,
    );
    console.log("");
    console.log(colors.dim("Could not scan for projects."));
  }
}

/**
 * Show version in compact format (for scripts/CI)
 */
export async function showVersionCompact(): Promise<void> {
  const landscape = await getLandscape(process.cwd(), 3);
  displayLandscapeCompact(landscape);
}
