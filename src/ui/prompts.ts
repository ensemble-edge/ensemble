/**
 * Interactive prompts for CLI wizards
 *
 * Wraps the `prompts` library with ensemble styling
 */

import { existsSync } from "node:fs";
import prompts from "prompts";
import { colors } from "./colors.js";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface Choice<T> {
  title: string;
  value: T;
  description?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

// Handle Ctrl+C gracefully
prompts.override({});

// ─────────────────────────────────────────────────────────────────────────────
// Confirm Prompt
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ask a yes/no question
 *
 * @example
 * const confirmed = await promptConfirm('Continue?', true);
 */
export async function promptConfirm(
  message: string,
  initial: boolean = true,
): Promise<boolean> {
  const response = await prompts({
    type: "confirm",
    name: "value",
    message: colors.normal(message),
    initial,
  });

  // Handle Ctrl+C
  if (response.value === undefined) {
    console.log("");
    process.exit(1);
  }

  return response.value;
}

// ─────────────────────────────────────────────────────────────────────────────
// Text Input Prompt
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ask for text input
 *
 * @example
 * const name = await promptText('Project name:', 'my-project');
 */
export async function promptText(
  message: string,
  initial?: string,
  options?: {
    validate?: (value: string) => boolean | string;
  },
): Promise<string> {
  const response = await prompts({
    type: "text",
    name: "value",
    message: colors.normal(message),
    initial,
    validate: options?.validate,
  });

  // Handle Ctrl+C
  if (response.value === undefined) {
    console.log("");
    process.exit(1);
  }

  return response.value;
}

// ─────────────────────────────────────────────────────────────────────────────
// Select Prompt
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Select from a list of options
 *
 * @example
 * const pm = await promptSelect('Package manager:', [
 *   { title: 'npm', value: 'npm' },
 *   { title: 'pnpm', value: 'pnpm' },
 * ]);
 */
export async function promptSelect<T>(
  message: string,
  choices: Choice<T>[],
  initial?: number,
): Promise<T> {
  const response = await prompts({
    type: "select",
    name: "value",
    message: colors.normal(message),
    choices: choices.map((c) => ({
      title: c.title,
      value: c.value,
      description: c.description,
    })),
    initial: initial ?? 0,
  });

  // Handle Ctrl+C
  if (response.value === undefined) {
    console.log("");
    process.exit(1);
  }

  return response.value;
}

// ─────────────────────────────────────────────────────────────────────────────
// Password Prompt
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ask for password/secret input (masked)
 *
 * @example
 * const apiKey = await promptPassword('API key:');
 */
export async function promptPassword(message: string): Promise<string> {
  const response = await prompts({
    type: "password",
    name: "value",
    message: colors.normal(message),
  });

  // Handle Ctrl+C
  if (response.value === undefined) {
    console.log("");
    process.exit(1);
  }

  return response.value;
}

// ─────────────────────────────────────────────────────────────────────────────
// Multi-Select Prompt
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Select multiple options from a list
 *
 * @example
 * const features = await promptMultiSelect('Features:', [
 *   { title: 'AI Agents', value: 'agents' },
 *   { title: 'Documentation', value: 'docs' },
 * ]);
 */
export async function promptMultiSelect<T>(
  message: string,
  choices: Choice<T>[],
): Promise<T[]> {
  const response = await prompts({
    type: "multiselect",
    name: "value",
    message: colors.normal(message),
    choices: choices.map((c) => ({
      title: c.title,
      value: c.value,
      description: c.description,
    })),
  });

  // Handle Ctrl+C
  if (response.value === undefined) {
    console.log("");
    process.exit(1);
  }

  return response.value;
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility: Check if running in interactive mode
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check if the terminal is interactive (TTY)
 */
export function isInteractive(): boolean {
  return process.stdout.isTTY === true;
}

/**
 * Check if running in CI environment
 */
export function isCI(): boolean {
  return !!(
    process.env.CI ||
    process.env.GITHUB_ACTIONS ||
    process.env.GITLAB_CI ||
    process.env.CIRCLECI ||
    process.env.TRAVIS ||
    process.env.JENKINS_URL ||
    process.env.BUILDKITE
  );
}

/**
 * Check if running inside a dev container or remote container
 *
 * Detects:
 * - VS Code Dev Containers (REMOTE_CONTAINERS=true)
 * - GitHub Codespaces (CODESPACES=true)
 * - Generic Docker containers (/.dockerenv exists)
 * - Podman containers (/run/.containerenv exists)
 * - Container env var set by runtime
 */
export function isDevContainer(): boolean {
  // VS Code Dev Container or Codespaces (most reliable)
  if (
    process.env.REMOTE_CONTAINERS === "true" ||
    process.env.CODESPACES === "true"
  ) {
    return true;
  }

  // Generic container detection via env
  if (
    process.env.container === "docker" ||
    process.env.container === "podman"
  ) {
    return true;
  }

  // Check for container marker files (fallback)
  try {
    if (existsSync("/.dockerenv") || existsSync("/run/.containerenv")) {
      return true;
    }
  } catch {
    // Ignore errors - graceful fallback
  }

  return false;
}
