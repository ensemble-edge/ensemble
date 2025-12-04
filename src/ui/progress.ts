/**
 * Progress indicators for multi-step operations
 */

import { colors } from "./colors.js";

export interface Step {
  id: string;
  name: string;
}

/**
 * Render a step header
 *
 * @example
 * console.log(renderStepHeader(3, 11, 'Project Name'));
 * // Output: "Step 3 of 11: Project Name"
 */
export function renderStepHeader(
  current: number,
  total: number,
  name: string,
): string {
  return colors.dim(`Step ${current} of ${total}: `) + colors.bold(name);
}

/**
 * Render a progress bar
 *
 * @example
 * console.log(renderProgressBar(3, 10));
 * // Output: "████████████░░░░░░░░░░░░░░░░░░ 3/10"
 */
export function renderProgressBar(
  current: number,
  total: number,
  width: number = 30,
): string {
  const filled = Math.round((current / total) * width);
  const empty = width - filled;
  const bar = "█".repeat(filled) + "░".repeat(empty);
  return colors.accent(bar) + colors.dim(` ${current}/${total}`);
}

/**
 * Render step header + progress bar
 */
export function renderProgress(
  current: number,
  total: number,
  name: string,
): string {
  return (
    renderStepHeader(current, total, name) +
    "\n" +
    renderProgressBar(current, total)
  );
}

/**
 * Conductor init steps
 */
export const CONDUCTOR_INIT_STEPS: Step[] = [
  { id: "init", name: "Initialize" },
  { id: "detect", name: "Detect Project" },
  { id: "name", name: "Project Name" },
  { id: "examples", name: "Examples" },
  { id: "cloudflare-auth", name: "Cloudflare Auth" },
  { id: "account", name: "Account Selection" },
  { id: "ai-provider", name: "AI Provider" },
  { id: "structure", name: "Create Structure" },
  { id: "deps", name: "Install Dependencies" },
  { id: "configure", name: "Configure Wrangler" },
  { id: "complete", name: "Complete" },
];

/**
 * Edgit init steps
 */
export const EDGIT_INIT_STEPS: Step[] = [
  { id: "validate", name: "Validate Git" },
  { id: "detect", name: "Detect Existing Setup" },
  { id: "configure", name: "Configuration" },
  { id: "scan", name: "Scan Components" },
  { id: "register", name: "Register Components" },
  { id: "gitignore", name: "Update .gitignore" },
  { id: "conductor", name: "Conductor Integration" },
  { id: "complete", name: "Complete" },
];

/**
 * Cloud init steps
 */
export const CLOUD_INIT_STEPS: Step[] = [
  { id: "generate", name: "Generate Key" },
  { id: "store", name: "Store Secret" },
  { id: "enable", name: "Enable Endpoint" },
];
