#!/usr/bin/env node
/**
 * @fileoverview Toren CLI — Entry Point
 *
 * Usage:
 *   toren [path]          Scan <path> (defaults to current directory)
 *   toren --version       Print version
 *   toren --help          Print usage
 *
 * All terminal output and formatting live here.
 * Core scanning logic is delegated to src/scanner/scan.js.
 */

import path from 'node:path';
import { createRequire } from 'node:module';
import { scan } from '../src/scanner/scan.js';

// ---------------------------------------------------------------------------
// Helpers — package metadata
// ---------------------------------------------------------------------------

const require  = createRequire(import.meta.url);
const pkg      = require('../package.json');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum number of files shown in the structure preview. */
const PREVIEW_LIMIT = 20;

// ANSI colour helpers (no external deps — raw escape codes).
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

// ---------------------------------------------------------------------------
// Formatting utilities
// ---------------------------------------------------------------------------

/**
 * Wrap text with ANSI colour codes.
 * @param {string} text
 * @param {...string} codes - One or more C.* values
 * @returns {string}
 */
function paint(text, ...codes) {
  return `${codes.join('')}${text}${C.reset}`;
}

/**
 * Print a horizontal divider the width of the terminal (max 80 chars).
 * @param {string} [char='─']
 */
function divider(char = '─') {
  const width = Math.min(process.stdout.columns ?? 72, 80);
  console.log(paint(char.repeat(width), C.dim));
}

/**
 * Print a section header.
 * @param {string} emoji
 * @param {string} title
 */
function sectionHeader(emoji, title) {
  console.log('');
  console.log(`${emoji}  ${paint(title, C.bold, C.white)}`);
  divider();
}

/**
 * Render the file tree, depth-first, with classic tree connectors.
 * Stops after PREVIEW_LIMIT files are printed.
 *
 * @param {import('../src/scanner/scan.js').DirNode | import('../src/scanner/scan.js').FileNode} node
 * @param {string} prefix        - Current indentation prefix
 * @param {boolean} isLast       - Whether this node is the last child of its parent
 * @param {{ count: number }}  counter - Mutable counter shared across recursion
 */
function renderTree(node, prefix, isLast, counter) {
  if (counter.count >= PREVIEW_LIMIT) return;

  const connector = isLast ? '└── ' : '├── ';
  const extension = isLast ? '    ' : '│   ';

  if (node.type === 'directory') {
    const label = paint(`${node.name}/`, C.bold, C.blue);
    console.log(`${prefix}${connector}${label}`);
    const children = node.children ?? [];
    for (let i = 0; i < children.length; i++) {
      if (counter.count >= PREVIEW_LIMIT) break;
      renderTree(children[i], prefix + extension, i === children.length - 1, counter);
    }
  } else {
    const label = paint(node.name, C.white);
    console.log(`${prefix}${connector}${label}`);
    counter.count += 1;
  }
}

// ---------------------------------------------------------------------------
// Banner
// ---------------------------------------------------------------------------

function printBanner() {
  const version = paint(`v${pkg.version}`, C.dim);
  const name    = paint('Toren', C.bold, C.cyan);
  const tagline = paint('Codebase Onboarding Intelligence', C.dim);
  console.log('');
  console.log(`  ${name} ${version}  —  ${tagline}`);
}

// ---------------------------------------------------------------------------
// Core output renderer
// ---------------------------------------------------------------------------

/**
 * Take a scan result and pretty-print it to stdout.
 * @param {import('../src/scanner/scan.js').ScanResult} result
 */
function renderReport(result) {
  const { rootPath, projectType, entryPoints, tree, flatFiles } = result;

  printBanner();
  console.log('');

  // ── Overview ──────────────────────────────────────────────────────────────
  const relRoot = path.relative(process.cwd(), rootPath) || '.';
  console.log(`  ${paint('Scanning:', C.dim)}  ${paint(relRoot, C.cyan)}`);
  console.log(`  ${paint('Files found:', C.dim)} ${paint(String(flatFiles.length), C.yellow)}`);

  // ── Project Type ──────────────────────────────────────────────────────────
  sectionHeader('📦', 'Project Type');
  console.log(`  ${paint('✅', C.green)}  ${paint(projectType, C.bold, C.green)}`);

  // ── Entry Points ──────────────────────────────────────────────────────────
  sectionHeader('🚪', 'Entry Points');
  if (entryPoints.length === 0) {
    console.log(paint('  No known entry points detected.', C.dim));
  } else {
    for (const ep of entryPoints) {
      console.log(`  ${paint('→', C.cyan)}  ${paint(ep, C.white)}`);
    }
  }

  // ── Structure Preview ─────────────────────────────────────────────────────
  sectionHeader('📁', `Folder Structure  ${paint(`(first ${PREVIEW_LIMIT} files)`, C.dim)}`);

  const rootLabel = paint(`${tree.name || '.'}/`, C.bold, C.blue);
  console.log(rootLabel);

  const counter  = { count: 0 };
  const children = tree.children ?? [];
  for (let i = 0; i < children.length; i++) {
    if (counter.count >= PREVIEW_LIMIT) break;
    renderTree(children[i], '', i === children.length - 1, counter);
  }

  if (flatFiles.length > PREVIEW_LIMIT) {
    const hidden = flatFiles.length - PREVIEW_LIMIT;
    console.log(paint(`  … and ${hidden} more file(s) not shown`, C.dim));
  }

  // ── Footer ────────────────────────────────────────────────────────────────
  console.log('');
  divider();
  console.log(paint(`  ✅  Scan complete.`, C.green));
  console.log('');
}

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

function printHelp() {
  console.log(`
${paint('Usage:', C.bold)}
  toren [path]        Scan a directory (defaults to current directory)
  toren --help        Show this help message
  toren --version     Show version number

${paint('Examples:', C.bold)}
  toren .             Scan the current directory
  toren ./my-project  Scan a specific project folder
`);
}

/**
 * Parse process.argv and return the resolved target path.
 * Returns null if the process should exit after printing help/version.
 * @returns {string|null}
 */
function parseArgs() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    printHelp();
    return null;
  }

  if (args.includes('--version') || args.includes('-v')) {
    console.log(pkg.version);
    return null;
  }

  // First non-flag argument is the target path; default to cwd.
  const target = args.find(a => !a.startsWith('-')) ?? '.';
  return target;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

(function main() {
  const targetArg = parseArgs();
  if (targetArg === null) process.exit(0);

  try {
    const result = scan(targetArg);
    renderReport(result);
  } catch (err) {
    console.error('');
    console.error(paint(`  ❌  Error: ${err.message}`, C.red));
    console.error('');
    process.exit(1);
  }
})();
