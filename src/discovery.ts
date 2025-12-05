/**
 * Cross-product discovery - suggests related Ensemble products
 *
 * Shows contextual hints about sibling products when relevant.
 * Designed to be non-intrusive: only shown on help commands or init success.
 */

import { existsSync } from "node:fs";
import { colors, log } from "./ui/index.js";

/**
 * Product relationship map - what products complement each other
 */
const PRODUCT_HINTS: Record<string, { related: string[]; context: string }> = {
  conductor: {
    related: ["edgit", "cloud"],
    context: "orchestrating AI workflows",
  },
  edgit: {
    related: ["conductor", "cloud"],
    context: "versioning AI components",
  },
  cloud: {
    related: ["conductor", "edgit"],
    context: "connecting to Ensemble Cloud",
  },
  chamber: {
    related: ["conductor"],
    context: "caching AI responses",
  },
};

/**
 * Product descriptions for hints
 */
const PRODUCT_DESCRIPTIONS: Record<string, string> = {
  conductor: "AI workflow orchestration for Cloudflare Workers",
  edgit: "Git tag-based versioning for prompts and configs",
  cloud: "Connect your worker to Ensemble Cloud dashboard",
  chamber: "Semantic caching for AI responses (coming soon)",
};

/**
 * Detect which Ensemble products are already set up in the current project
 */
export function detectInstalledProducts(): string[] {
  const installed: string[] = [];

  // Check for Conductor (wrangler.toml with conductor patterns)
  if (existsSync("wrangler.toml")) {
    installed.push("conductor");
  }

  // Check for Edgit (.edgit directory)
  if (existsSync(".edgit") || existsSync(".edgit/components.json")) {
    installed.push("edgit");
  }

  // Check for package.json dependencies
  if (existsSync("package.json")) {
    try {
      // We could read package.json here for more detection
      // For now, keep it simple with file-based detection
    } catch {
      // Ignore errors
    }
  }

  return installed;
}

/**
 * Get suggested products based on what's currently being used
 */
export function getSuggestedProducts(currentProduct: string): string[] {
  const hints = PRODUCT_HINTS[currentProduct];
  if (!hints) return [];

  const installed = detectInstalledProducts();

  // Suggest products that are related but not yet installed
  return hints.related.filter((product) => !installed.includes(product));
}

/**
 * Show a hint about related products (non-intrusive)
 */
export function showProductHint(currentProduct: string): void {
  const suggestions = getSuggestedProducts(currentProduct);
  if (suggestions.length === 0) return;

  // Pick one suggestion randomly to keep hints varied
  const suggestion =
    suggestions[Math.floor(Math.random() * suggestions.length)];
  if (!suggestion) return;

  const description = PRODUCT_DESCRIPTIONS[suggestion];
  if (!description) return;

  console.log("");
  console.log(colors.dim("─".repeat(50)));
  console.log(
    colors.dim("💡 Tip:"),
    colors.accent(`ensemble ${suggestion}`),
    colors.dim(`— ${description}`),
  );
}

/**
 * Show product hints after successful init commands
 */
export function showInitHints(product: string): void {
  const hints = PRODUCT_HINTS[product];
  if (!hints) return;

  const suggestions = getSuggestedProducts(product);
  if (suggestions.length === 0) return;

  console.log("");
  console.log(colors.bold("Next steps:"));

  for (const suggestion of suggestions.slice(0, 2)) {
    const desc = PRODUCT_DESCRIPTIONS[suggestion];
    if (desc) {
      console.log(
        `  ${colors.accent(`ensemble ${suggestion} init`)}  ${colors.dim(desc)}`,
      );
    }
  }
}

/**
 * Show ecosystem overview when running `ensemble` with no args
 */
export function showEcosystemStatus(): void {
  const installed = detectInstalledProducts();

  if (installed.length === 0) {
    return;
  }

  console.log("");
  console.log(colors.bold("Detected in this project:"));
  for (const product of installed) {
    console.log(`  ${colors.success("✓")} ${product}`);
  }

  const notInstalled = ["conductor", "edgit", "cloud"].filter(
    (p) => !installed.includes(p),
  );
  if (notInstalled.length > 0) {
    console.log("");
    console.log(colors.dim("Available:"));
    for (const product of notInstalled) {
      const desc = PRODUCT_DESCRIPTIONS[product];
      console.log(`  ${colors.dim("○")} ${product}  ${colors.dim(desc ?? "")}`);
    }
  }
}
