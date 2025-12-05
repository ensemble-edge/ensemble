/**
 * Animated spinner for async operations
 */

import { colors, statusIcons } from "./colors.js";

const SPINNER_FRAMES = ["◐", "◓", "◑", "◒"];
const SPINNER_INTERVAL = 80; // ms

export interface SpinnerOptions {
  text: string;
  stream?: NodeJS.WriteStream;
}

export interface Spinner {
  start: () => Spinner;
  stop: () => Spinner;
  success: (options?: { text?: string }) => Spinner;
  error: (options?: { text?: string }) => Spinner;
  warn: (options?: { text?: string }) => Spinner;
  update: (text: string) => Spinner;
}

/**
 * Create an animated spinner
 *
 * @example
 * const spinner = createSpinner('Installing dependencies...').start();
 * await install();
 * spinner.success({ text: 'Installed dependencies' });
 */
export function createSpinner(text: string): Spinner {
  let frame = 0;
  let interval: NodeJS.Timeout | null = null;
  let currentText = text;
  const stream = process.stderr;

  const clearLine = () => {
    stream.write("\r\x1b[K");
  };

  const render = () => {
    clearLine();
    stream.write(`${colors.accent(SPINNER_FRAMES[frame])} ${currentText}`);
    frame = (frame + 1) % SPINNER_FRAMES.length;
  };

  const spinner: Spinner = {
    start() {
      if (interval) return this;
      render();
      interval = setInterval(render, SPINNER_INTERVAL);
      return this;
    },

    stop() {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
      clearLine();
      return this;
    },

    success(options?: { text?: string }) {
      this.stop();
      const finalText = options?.text ?? currentText;
      stream.write(`${colors.success(statusIcons.success)} ${finalText}\n`);
      return this;
    },

    error(options?: { text?: string }) {
      this.stop();
      const finalText = options?.text ?? currentText;
      stream.write(`${colors.error(statusIcons.error)} ${finalText}\n`);
      return this;
    },

    warn(options?: { text?: string }) {
      this.stop();
      const finalText = options?.text ?? currentText;
      stream.write(`${colors.warning(statusIcons.warning)} ${finalText}\n`);
      return this;
    },

    update(text: string) {
      currentText = text;
      return this;
    },
  };

  return spinner;
}

/**
 * Run an async function with a spinner
 *
 * @example
 * const result = await withSpinner('Installing...', async () => {
 *   return await install();
 * });
 */
export async function withSpinner<T>(
  message: string,
  fn: () => Promise<T>,
): Promise<T> {
  const spinner = createSpinner(message).start();

  try {
    const result = await fn();
    spinner.success();
    return result;
  } catch (error) {
    spinner.error();
    throw error;
  }
}
