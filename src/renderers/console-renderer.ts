import type { ScanResult, DirNode, TreeNode, FileNode, ScriptInfo, ImportantFile, HealthObservation } from "../types/index.js";
/**
 * @fileoverview Toren — Console Renderer
 *
 * Consumes a {@link ScanResult} and produces styled terminal output.
 *
 * Design contract:
 *  - Presentation-only. Every value rendered comes from ScanResult.
 *    Presentation-level derivations (e.g. frameworks list from projectType) are
 *    permitted here; business logic is not.
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
// Cross-platform capability detection
// ---------------------------------------------------------------------------

function shouldEnableColors(): boolean {
  if ('FORCE_COLOR' in process.env) {
    return process.env.FORCE_COLOR !== '0' && process.env.FORCE_COLOR !== 'false';
  }
  if ('NO_COLOR' in process.env) return false;
  if (!process.stdout || !process.stdout.isTTY) return false;
  if (process.env.TERM === 'dumb') return false;
  return true;
}

function isUnicodeSupported(): boolean {
  if (process.platform !== 'win32') {
    return process.env.TERM !== 'linux';
  }
  return Boolean(
    process.env.CI ||
    process.env.WT_SESSION ||
    process.env.TERMINUS_SUBLIME ||
    process.env.ConEmuTask === '{cmd::Cmder}' ||
    process.env.TERM_PROGRAM === 'Terminus-Sublime' ||
    process.env.TERM_PROGRAM === 'vscode' ||
    process.env.TERM === 'xterm-256color' ||
    process.env.TERM === 'alacritty' ||
    process.env.TERMINAL_EMULATOR === 'JetBrains-JediTerm'
  );
}

const useColors  = shouldEnableColors();
const useUnicode = isUnicodeSupported();

const CHARS = {
  dash:   useUnicode ? '─'    : '-',
  corner: useUnicode ? '└── ' : '\\-- ',
  tee:    useUnicode ? '├── ' : '+-- ',
  pipe:   useUnicode ? '│   ' : '|   ',
};

// ---------------------------------------------------------------------------
// Low-level paint / layout helpers  (private to this module)
// ---------------------------------------------------------------------------

/**
 * Wrap `text` with one or more ANSI codes, resetting after.
 * @param {string} text
 * @param {...string} codes
 * @returns {string}
 */
function paint(text: string, ...codes: string[]): string {
  if (!useColors) return text;
  return `${codes.join('')}${text}${C.reset}`;
}

/**
 * Print a titled section header followed by a matched-length divider.
 * @param {string} title
 */
function section(title: string): void {
  const cleanTitle = title.replace(/\x1b\[[0-9;]*m/g, '');
  console.log(paint(title, C.bold, C.white));
  console.log(paint(CHARS.dash.repeat(cleanTitle.length), C.dim));
  console.log('');
}

/**
 * Print a single labelled key-value row.
 * @param {string} label  - Left-hand label (dim)
 * @param {string} value  - Right-hand value
 * @param {string} [valueColor] - Optional ANSI code(s) for the value
 */
function row(label: string, value: string, ...valueCodes: string[]): void {
  const coloured = valueCodes.length ? paint(value, ...valueCodes) : value;
  console.log(`${paint(label, C.dim)} ${coloured}`);
}

/**
 * Format a scan duration into a human-readable string.
 * Mirrors the formatDuration helpers in markdown-renderer and html-renderer.
 * @param {number} ms
 * @returns {string}
 */
function formatDuration(ms: number): string {
  if (ms < 1)     return '< 1 ms';
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)} s`;
  return `${Math.round(ms)} ms`;
}

/**
 * Derive a frameworks array from the projectType string.
 * Returns [] when no specific framework is detected (projectType is falsy or 'Unknown').
 * Mirrors the identical derivation in json-renderer.js — both must stay in sync.
 *
 * @param {string} projectType
 * @returns {string[]}
 */
function deriveFrameworks(projectType: string): string[] {
  if (!projectType || projectType === 'Unknown') return [];
  return [projectType];
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
 * @param {number}            limit    - Max files to render
 * @param {number}            depth    - Current depth
 * @param {number}            maxDepth - Max recursion depth
 */
function renderTree(node: DirNode | FileNode | TreeNode, prefix: string, isLast: boolean, counter: { count: number, maxReached?: boolean }, limit = PREVIEW_LIMIT, depth = 0, maxDepth = 4): void {
  if (counter.maxReached) return;
  if (depth >= maxDepth) return;

  const connector = isLast ? CHARS.corner : CHARS.tee;
  const extension = isLast ? '    ' : CHARS.pipe;

  if (node.type === 'directory') {
    console.log(`${prefix}${connector}${paint(`${node.name}${path.sep}`, C.bold, C.blue)}`);
    const children = node.children ?? [];
    
    if (depth === maxDepth - 1 && children.length > 0) {
       console.log(`${prefix}${extension}${CHARS.corner}${paint('...', C.dim)}`);
       return;
    }

    for (let i = 0; i < children.length; i++) {
      if (counter.count >= limit) {
        console.log(`${prefix}${extension}${CHARS.corner}${paint('...', C.dim)}`);
        counter.maxReached = true;
        break;
      }
      // Check if this child will be the last one we render due to limits
      let willBeLast = i === children.length - 1;
      
      renderTree(children[i], prefix + extension, willBeLast, counter, limit, depth + 1, maxDepth);
      if (counter.maxReached) break;
    }
  } else {
    console.log(`${prefix}${connector}${paint(node.name, C.white)}`);
    counter.count += 1;
  }
}


// ---------------------------------------------------------------------------
// Banner  (private)
// ---------------------------------------------------------------------------

function printBanner(): void {
  const name    = paint('Toren', C.bold, C.cyan);
  const version = paint(`v${pkg.version}`, C.dim);
  const tagline = paint('Codebase Onboarding Intelligence', C.dim);
  console.log(`${name} ${version}  —  ${tagline}`);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Render a ScanResult to the terminal.
 *
 * All sections read from the ScanResult. Presentation-level derivations
 * (e.g. frameworks list) are computed here; no business logic is added.
 *
 * @param {import('../scanner/scan.js').ScanResult} result
 * @param {{ cwd?: string }} [options]
 */
export function render(result: ScanResult, options: { cwd?: string } = {}): void {
  const {
    rootPath,
    projectType,
    entryPoints,
    configs = [],
    scripts = [],
    packageManager,
    importantFiles = [],
    projectInfo = null,
    health = [],
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
  section('Project Summary');
  row('Path:         ', paint(relRoot, C.cyan));
  if (projectInfo && projectInfo.name) {
    row('Name:         ', paint(projectInfo.name, C.white));
  }
  row('Project type: ', paint(projectType, C.bold, C.green));
  if (packageManager) {
    row('Pkg manager:  ', paint(packageManager, C.white));
  }
  row('Total files:  ', paint(String(flatFiles.length), C.yellow));
  row('Total folders:', paint(String(totalFolders), C.yellow));
  console.log('');

  // ── Project Health ────────────────────────────────────────────────────────
  section('Project Health');
  if (health.length === 0) {
    console.log(paint('No project health observations available.', C.dim));
  } else {
    for (const h of health) {
      let icon = 'ℹ';
      let color = C.white;
      if (h.status === 'pass') {
        icon = '✓';
        color = C.green;
      } else if (h.status === 'warning') {
        icon = '⚠';
        color = C.yellow;
      }
      console.log(`${paint(icon, color)} ${h.message}`);
    }
  }
  console.log('');

  // ── Important Files ───────────────────────────────────────────────────────
  section('Important Files');
  if (importantFiles.length === 0) {
    console.log(paint('No important files detected.', C.dim));
  } else {
    importantFiles.forEach((f, idx) => {
      console.log(`${idx + 1}. ${paint(f.path, C.white)}`);
      console.log(`   ${paint(f.reason, C.dim)}`);
      if (idx < importantFiles.length - 1) console.log('');
    });
  }
  console.log('');

  // ── Frameworks ────────────────────────────────────────────────────────────
  section('Frameworks');
  const frameworks = deriveFrameworks(projectType);
  if (frameworks.length === 0) {
    console.log(paint('No frameworks detected.', C.dim));
  } else {
    for (const fw of frameworks) {
      console.log(paint(fw, C.white));
    }
  }
  console.log('');

  // ── Entry Points ──────────────────────────────────────────────────────────
  section('Entry Points');
  if (entryPoints.length === 0) {
    console.log(paint('No entry points detected.', C.dim));
  } else {
    for (const ep of entryPoints) {
      console.log(paint(ep, C.white));
    }
  }
  console.log('');

  // ── Configuration Files ───────────────────────────────────────────────────
  section('Configuration Files');
  if (configs.length === 0) {
    console.log(paint('No configuration files detected.', C.dim));
  } else {
    for (const c of configs) {
      console.log(paint(c, C.white));
    }
  }
  console.log('');

  // ── Package Scripts ───────────────────────────────────────────────────────
  section('Package Scripts');
  if (scripts.length === 0) {
    console.log(paint('No package scripts detected.', C.dim));
  } else {
    for (let i = 0; i < scripts.length; i++) {
      const s = scripts[i];
      const usage = s.usage || `npm run ${s.name}`;
      console.log(paint(usage, C.white));
      if (s.description) {
        console.log(`  ${paint(s.description, C.dim)}`);
      } else {
        console.log(`  ${paint(s.command, C.dim)}`);
      }
      if (i < scripts.length - 1) console.log('');
    }
  }
  console.log('');

  // ── Structure Preview ─────────────────────────────────────────────────────
  section('Folder Structure');

  console.log(paint(`${tree.name || '.'}${path.sep}`, C.bold, C.blue));

  const counter  = { count: 0, maxReached: false };
  const children = tree.children ?? [];
  for (let i = 0; i < children.length; i++) {
    if (counter.count >= PREVIEW_LIMIT) {
      console.log(`${CHARS.corner}${paint('...', C.dim)}`);
      break;
    }
    renderTree(children[i], '', i === children.length - 1, counter);
    if (counter.maxReached) break;
  }

  if (flatFiles.length > PREVIEW_LIMIT) {
    const hidden = flatFiles.length - PREVIEW_LIMIT;
    console.log(paint(`… ${hidden} more file(s) not shown`, C.dim));
  }

  // ── Footer ────────────────────────────────────────────────────────────────
  console.log('');
  console.log(paint(`Scan completed in ${formatDuration(scanDurationMs)}`, C.green));
  console.log('');
}

/**
 * Render only the project structure for the --structure flag.
 * 
 * @param {import('../scanner/scan.js').ScanResult} result
 */
export function renderStructure(result: ScanResult): void {
  const { tree, flatFiles } = result;

  section('Folder Structure');
  console.log(paint(`${tree.name || '.'}${path.sep}`, C.bold, C.blue));

  const counter  = { count: 0, maxReached: false };
  const children = tree.children ?? [];
  const limit = flatFiles.length; // No preview limit for focused --structure

  for (let i = 0; i < children.length; i++) {
    if (counter.count >= limit) {
      console.log(`${CHARS.corner}${paint('...', C.dim)}`);
      break;
    }
    renderTree(children[i], '', i === children.length - 1, counter, limit, 0, Infinity);
    if (counter.maxReached) break;
  }
}
