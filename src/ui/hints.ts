/**
 * Keyboard input hints for interactive prompts
 */

import { colors } from "./colors.js";

/**
 * Keyboard key symbols
 */
export const keys = {
  enter: "⏎ Enter",
  up: "↑",
  down: "↓",
  space: "␣ Space",
  tab: "⇥ Tab",
  escape: "Esc",
  ctrl: "Ctrl",
  shift: "Shift",
};

/**
 * Context-specific hints
 */
export const hints = {
  confirm: `${keys.enter} to accept default`,
  text: `Type value, ${keys.enter} to submit`,
  select: `${keys.up}${keys.down} to navigate, ${keys.enter} to select`,
  multiselect: `${keys.up}${keys.down} navigate, ${keys.space} to toggle, ${keys.enter} to confirm`,
  cancel: `${keys.escape} to cancel`,
};

/**
 * Render a hint line
 */
export function renderHint(hint: string): string {
  return colors.dim(`  ${hint}`);
}

/**
 * Render a validation message
 */
export function renderValidation(message: string): string {
  return colors.dim(`  (${message})`);
}

/**
 * Common validation messages
 */
export const validations = {
  lowercase: "lowercase with hyphens",
  required: "required",
  optional: "optional",
  url: "must be a valid URL",
  email: "must be a valid email",
  path: "must be a valid path",
};
