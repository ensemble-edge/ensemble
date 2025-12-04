/**
 * @ensemble-edge/ensemble
 * Unified CLI for the Ensemble ecosystem
 *
 * Entry points:
 * - ensemble conductor  → AI workflow orchestration
 * - ensemble edgit      → Component versioning
 * - ensemble chamber    → Edge data layer
 * - ensemble cloud      → Managed platform connection
 * - ensemble <wrangler> → Passthrough to wrangler
 */

export { run } from "./cli.js";
export { version } from "./version.js";
