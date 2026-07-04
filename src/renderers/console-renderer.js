/**
 * @fileoverview Toren — Console Renderer
 *
 * Consumes a {@link ScanResult} and produces styled terminal output.
 *
 * Design contract:
 *  - No business logic. Every value rendered is taken directly from ScanResult.
 *  - No imports from the scanner or any domain module.
 *  - Stateless: render() may be called multiple times safely.
 *  - The shape expected here matches the ScanResult typedef in scan.js.
 *    When ScanResult grows new fields, add new render sections; never mutate data.
 *
 * Adding a new output format (JSON, Markdown, HTML …):
 *  - Create src/renderers/<format>-renderer.js
 *  - Export a render(result, options?) function with the same signature
 *  - Import and call it from bin/toren.js based on a --format flag
 */

import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const pkg     = require('../../package.json');

// ---------------------------------------------------------------------------
// ANSI palette — zero external dependencies
// ---------------------------------------------------------------------------

const C = {
  reset:   '\x1b[0m',
  bold:    '\x1b[1m',
  dim:     '\x1b[2m',
  cyan:    '\x1b[36m',
  green:   '\x1b[32m',
  yellow:  '\x1b[33m',
  blue:    '\x1b[34m',
  magenta: '\x1b[35m',
  red:     '\x1b[31m',
  white:   '\x1b[97m',
};

/** Maximum files shown in the structure preview. */
const PREVIEW_LIMIT = 20;

// ---------------------------------------------------------------------------
// Low-level paint / layout helpers  (private to this module)
// ---------------------------------------------------------------------------

/**
 * Wrap `text` with one or more ANSI codes, resetting after.
 * @param {string} text
 * @param {...string} codes
 * @returns {string}
 */
function paint(text, ...codes) {
  return `${codes.join('')}${text}${C.reset}`;
}

/**
 * Print a full-width horizontal rule (≤ 80 chars).
 * @param {string} [char='─']
 */
function divider(char = '─') {
  const width = Math.min(process.stdout.columns ?? 72, 80);
  console.log(paint(char.repeat(width), C.dim));
}

/**
 * Print a titled section header followed by a divider.
 * @param {string} emoji
 * @param {string} title
 */
function section(emoji, title) {
  console.log('');
  console.log(`${emoji}  ${paint(title, C.bold, C.white)}`);
  divider();
}

/**
 * Print a single labelled key-value row.
 * @param {string} label  - Left-hand label (dim)
 * @param {string} value  - Right-hand value
 * @param {string} [valueColor] - Optional ANSI code(s) for the value
 */
function row(label, value, ...valueCodes) {
  const coloured = valueCodes.length ? paint(value, ...valueCodes) : value;
  console.log(`  ${paint(label, C.dim)}  ${coloured}`);
}

// ---------------------------------------------------------------------------
// File-tree renderer  (private)
// ---------------------------------------------------------------------------

/**
 * Recursively print a file tree with classic tree connectors.
 * Stops after PREVIEW_LIMIT files have been printed.
 *
 * @param {import('../scanner/scan.js').DirNode | import('../scanner/scan.js').FileNode} node
 * @param {string}            prefix   - Accumulated indentation
 * @param {boolean}           isLast   - Whether this is the last sibling
 * @param {{ count: number, maxReached: boolean }} counter  - Shared mutable file counter
 */
function renderTree(node, prefix, isLast, counter, depth = 0, maxDepth = 4) {
  if (counter.maxReached) return;
  if (depth >= maxDepth) return;

  const connector = isLast ? '└── ' : '├── ';
  const extension = isLast ? '    ' : '│   ';

  if (node.type === 'directory') {
    console.log(`${prefix}${connector}${paint(`${node.name}/`, C.bold, C.blue)}`);
    const children = node.children ?? [];
    
    if (depth === maxDepth - 1 && children.length > 0) {
       console.log(`${prefix}${extension}└── ${paint('...', C.dim)}`);
       return;
    }

    for (let i = 0; i < children.length; i++) {
      if (counter.count >= PREVIEW_LIMIT) {
        console.log(`${prefix}${extension}└── ${paint('...', C.dim)}`);
        counter.maxReached = true;
        break;
      }
      // Check if this child will be the last one we render due to limits
      let willBeLast = i === children.length - 1;
      
      renderTree(children[i], prefix + extension, willBeLast, counter, depth + 1, maxDepth);
      if (counter.maxReached) break;
    }
  } else {
    console.log(`${prefix}${connector}${paint(node.name, C.white)}`);
    counter.count += 1;
  }
}

function formatDuration(ms) {
  if (ms < 1) return '< 1 ms';
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)} s`;
  return `${Math.round(ms)} ms`;
}

// ---------------------------------------------------------------------------
// Banner  (private)
// ---------------------------------------------------------------------------

function printBanner() {
  const name    = paint('Toren', C.bold, C.cyan);
  const version = paint(`v${pkg.version}`, C.dim);
  const tagline = paint('Codebase Onboarding Intelligence', C.dim);
  console.log('');
  console.log(`  ${name} ${version}  —  ${tagline}`);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Render a ScanResult to the terminal.
 *
 * All sections read exclusively from the ScanResult; no derivations or
 * business decisions are made here.
 *
 * @param {import('../scanner/scan.js').ScanResult} result
 * @param {{ cwd?: string }} [options]
 */
export function render(result, options = {}) {
  const {
    rootPath,
    projectType,
    entryPoints,
    tree,
    flatFiles,
    totalFolders,
    scanDurationMs,
  } = result;

  const cwd    = options.cwd ?? process.cwd();
  const relRoot = path.relative(cwd, rootPath) || '.';

  // ── Banner ────────────────────────────────────────────────────────────────
  printBanner();
  console.log('');

  // ── Summary ───────────────────────────────────────────────────────────────
  section('🔍', 'Project Summary');
  row('Path:         ', paint(relRoot, C.cyan));
  row('Project type: ', paint(projectType, C.bold, C.green));
  row('Total files:  ', paint(String(flatFiles.length), C.yellow));
  row('Total folders:', paint(String(totalFolders), C.yellow));
  row('Scan duration:', paint(formatDuration(scanDurationMs), C.magenta));

  // ── Entry Points ──────────────────────────────────────────────────────────
  section('🚪', 'Entry Points');
  if (entryPoints.length === 0) {
    console.log(paint('  ⚠ No entry points detected (this may be a library or utility project)', C.yellow));
  } else {
    for (const ep of entryPoints) {
      console.log(`  ${paint('→', C.cyan)}  ${paint(ep, C.white)}`);
    }
  }

  // ── Structure Preview ─────────────────────────────────────────────────────
  section('📁', `Folder Structure  ${paint(`(first ${PREVIEW_LIMIT} files)`, C.dim)}`);

  console.log(paint(`${tree.name || '.'}/`, C.bold, C.blue));

  const counter  = { count: 0, maxReached: false };
  const children = tree.children ?? [];
  for (let i = 0; i < children.length; i++) {
    if (counter.count >= PREVIEW_LIMIT) {
      console.log(`└── ${paint('...', C.dim)}`);
      break;
    }
    renderTree(children[i], '', i === children.length - 1, counter);
    if (counter.maxReached) break;
  }

  if (flatFiles.length > PREVIEW_LIMIT) {
    const hidden = flatFiles.length - PREVIEW_LIMIT;
    console.log(paint(`  … and ${hidden} more file(s) not shown`, C.dim));
  }

  // ── Footer ────────────────────────────────────────────────────────────────
  console.log('');
  divider();
  console.log(paint('  ✅  Scan complete.', C.green));
  console.log('');
}
