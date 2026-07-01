/**
 * @fileoverview Toren — Renderer Registry
 *
 * Maps format-name strings to their render functions.
 *
 * ┌─────────────────────────────────────────────────────────┐
 * │  How to add a new output format:                        │
 * │                                                         │
 * │  1. Create src/renderers/<format>-renderer.js           │
 * │     and export:  render(result, options?) => void       │
 * │                                                         │
 * │  2. Import it here and add one line to RENDERERS.       │
 * │                                                         │
 * │  No changes to bin/toren.js or scan.js are needed.     │
 * └─────────────────────────────────────────────────────────┘
 *
 * @module renderers/index
 */

import { render as renderConsole   } from './console-renderer.js';
import { render as renderJson      } from './json-renderer.js';
import { render as renderMarkdown  } from './markdown-renderer.js';
import { render as renderHtml      } from './html-renderer.js';

/**
 * Registry of all available output renderers.
 *
 * Keys   — format names accepted by the `--format` flag.
 * Values — render functions with the signature:
 *            render(result: ScanResult, options?: { cwd?: string }) => void
 *
 * @type {Record<string, function(import('../scanner/scan.js').ScanResult, object=): void>}
 */
const renderers = {
  console:  renderConsole,
  json:     renderJson,
  markdown: renderMarkdown,
  md:       renderMarkdown,  // Short alias — points to the same renderer.
  html:     renderHtml,
  web:      renderHtml,      // Friendly alias — points to the same renderer.
};

export default renderers;
