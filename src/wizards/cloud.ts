/**
 * Cloud Connection Wizard
 *
 * Handles Ensemble Cloud connection:
 * - Check if user wants to connect to cloud
 * - Guide them to cloud init command
 */

import { colors, log, promptConfirm, isInteractive } from "../ui/index.js";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface CloudWizardOptions {
  /** Skip confirmation prompts */
  yes?: boolean;
  /** Working directory */
  cwd?: string;
}

export interface CloudWizardResult {
  /** Whether user wants to connect to cloud */
  wantsConnection: boolean;
  /** Whether user skipped the prompt */
  skipped: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Wizard
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Run the cloud connection wizard
 *
 * Used by init flow to ask about cloud connection.
 * For actual cloud setup, users run 'ensemble cloud init'.
 *
 * @param options - Wizard options
 * @returns Result indicating user's choice
 */
export async function cloudWizard(
  options: CloudWizardOptions = {},
): Promise<CloudWizardResult> {
  const interactive = isInteractive() && !options.yes;

  if (!interactive) {
    return { wantsConnection: false, skipped: true };
  }

  const wantsConnection = await promptConfirm(
    "Connect to Ensemble Cloud?",
    false,
  );

  if (wantsConnection) {
    log.newline();
    log.info("Run 'ensemble cloud init' to configure cloud connection");
  } else {
    log.info("No problem! Connect anytime: ensemble cloud init");
  }

  return { wantsConnection, skipped: false };
}
