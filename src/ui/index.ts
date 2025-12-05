/**
 * Shared UI module for Ensemble CLI
 *
 * Provides consistent visual patterns across all commands:
 * - Brand colors
 * - Animated spinners
 * - Progress bars
 * - Keyboard hints
 * - Boxed messages
 * - Logging utilities
 */

// Colors and icons
export { colors, palette, icons, statusIcons } from "./colors.js";

// Spinner
export { createSpinner, withSpinner } from "./spinner.js";
export type { Spinner, SpinnerOptions } from "./spinner.js";

// Progress
export {
  renderStepHeader,
  renderProgressBar,
  renderProgress,
  CONDUCTOR_INIT_STEPS,
  EDGIT_INIT_STEPS,
  CLOUD_INIT_STEPS,
} from "./progress.js";
export type { Step } from "./progress.js";

// Hints
export {
  keys,
  hints,
  renderHint,
  renderValidation,
  validations,
} from "./hints.js";

// Box
export {
  box,
  successBox,
  infoBox,
  warningBox,
  recommendBox,
  section,
  listItem,
} from "./box.js";

// Logger
export {
  log,
  banners,
  printCommand,
  printUrl,
  showNestedSuccess,
  showNestedAction,
} from "./logger.js";

// Prompts
export {
  promptConfirm,
  promptText,
  promptSelect,
  promptPassword,
  promptMultiSelect,
  isInteractive,
  isCI,
} from "./prompts.js";
export type { Choice } from "./prompts.js";
