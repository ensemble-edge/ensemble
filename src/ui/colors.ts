/**
 * Brand colors and ANSI terminal mapping
 *
 * Both `ensemble` and `edgit` share identical visual patterns
 * for brand cohesion and trust transfer.
 */

import pc from "picocolors";

/**
 * Brand color palette (hex values for reference)
 */
export const palette = {
  // Primary - Magenta/Purple (Ensemble brand)
  primary: "#d946ef",
  primaryBold: "#e879f9",

  // Accent - Cyan (highlights, interactive elements)
  accent: "#22d3ee",
  accentBold: "#67e8f9",

  // Status
  success: "#22c55e",
  warning: "#eab308",
  error: "#ef4444",

  // Text
  bold: "#ffffff",
  normal: "#f3f4f6",
  dim: "#6b7280",
  muted: "#4b5563",
};

/**
 * Terminal ANSI color functions
 */
export const colors = {
  // Brand
  primary: (s: string) => pc.magenta(s),
  primaryBold: (s: string) => pc.bold(pc.magenta(s)),
  accent: (s: string) => pc.cyan(s),
  accentBold: (s: string) => pc.bold(pc.cyan(s)),

  // Status
  success: (s: string) => pc.green(s),
  warning: (s: string) => pc.yellow(s),
  error: (s: string) => pc.red(s),

  // Text
  bold: (s: string) => pc.bold(pc.white(s)),
  normal: (s: string) => s,
  dim: (s: string) => pc.dim(s),
  muted: (s: string) => pc.gray(s),

  // Utilities
  underline: (s: string) => pc.underline(s),
  strikethrough: (s: string) => pc.strikethrough(s),
};

/**
 * Product icons
 */
export const icons = {
  ensemble: "🎼",
  conductor: "🎼",
  edgit: "🔀",
  chamber: "🗄️",
  cloud: "☁️",
};

/**
 * Status icons
 */
export const statusIcons = {
  success: "✓",
  error: "✗",
  warning: "⚠",
  info: "ℹ",
  pending: "○",
  active: "◉",
};
