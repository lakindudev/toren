#!/usr/bin/env node
/**
 * @fileoverview Toren CLI — Entry Point
 *
 * Usage:
 *   toren [path]              Scan <path> (defaults to current directory)
 *   toren --format <type>     Select output format (default: console)
 *   toren --json              Legacy alias for --format json
 *   toren --version           Print version
 *   toren --help              Print usage
 *   toren --doctor            Check global installation health
 *   toren --uninstall         Safely remove global installation
 *   toren --include-hidden    Include hidden files (dot-files) in scan
 *   toren --max-files <N>     Override the max file scan limit
 *
 * Adding a new output format
 * ──────────────────────────
 *   1. Create src/renderers/<format>-renderer.js
 *      and export: render(result, options?) => void
 *   2. Register it in src/renderers/index.js
 *
 *   No changes to this file are required.
 */

import { createRequire } from 'node:module';
import { scan }          from '../src/scanner/scan.js';
import renderers         from '../src/renderers/index.js';
import { getFocusedModeInfo, renderFocusedMode, FOCUSED_FLAGS } from '../src/focused-output.js';
import { runDoctor, runUninstall } from '../src/lifecycle.js';

const require = createRequire(import.meta.url);
const pkg     = require('../package.json');

/** Format used when no --format flag is supplied. */
const DEFAULT_FORMAT = 'console';

/** Derived from the registry — always in sync with available renderers. */
const SUPPORTED_FORMATS = Object.keys(renderers);

// ---------------------------------------------------------------------------
// Help
// ---------------------------------------------------------------------------

function printHelp() {
  const formatList = SUPPORTED_FORMATS.map(f => `      ${f}`).join('\n');
  console.log(`
\x1b[1mUsage:\x1b[0m
  toren [path] [options]

\x1b[1mOptions:\x1b[0m
  --project-type      Show detected project type only
  --frameworks        Show detected frameworks only
  --entry-points      Show detected entry points only
  --structure         Show repository structure only
  --configs           Show detected configuration files only
  --scripts           Show available package scripts only
  --format <type>     Output as console, json, markdown, or html
  --include-hidden    Include hidden files and folders
  --max-files <n>     Set scan file limit
  --help              Show this help message
  --version           Show version number
  --doctor            Run CLI diagnostics
  --uninstall         Remove Toren global installation

\x1b[1mOutput Formats:\x1b[0m
${formatList}

    console is the default.

\x1b[1mExamples:\x1b[0m
  toren .                              Scan the current directory
  toren ./my-project                   Scan a specific project folder
  toren --format json .                Output results as JSON
  toren --format markdown . > out.md   Save a Markdown report to a file
  toren --format html . > out.html     Save an HTML report to a file
  toren --include-hidden .             Include hidden dot-files in scan
  toren --max-files 100000 .           Override the 50k file scan limit
`);
}

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} ParsedArgs
 * @property {'exit'|'wait'|'scan'} action
 * @property {string}  [target]        - Resolved path to scan
 * @property {string}  [format]        - Renderer format name
 * @property {boolean} [includeHidden] - Whether to include hidden files
 * @property {number}  [maxFiles]      - Max files to scan
 */

/**
 * Parse process.argv into a structured options object.
 *
 * Returns { action: 'exit' } when the process should exit immediately.
 * Returns { action: 'wait' } when an async interactive command is running.
 * Returns { action: 'scan', target, format } for normal scan operations.
 *
 * @returns {ParsedArgs}
 */
function parseArgs() {
  const args = process.argv.slice(2);

  // ── Informational flags ─────────────────────────────────────────────────
  if (args.includes('--help') || args.includes('-h')) {
    printHelp();
    return { action: 'exit', code: 0 };
  }

  if (args.includes('--version') || args.includes('-V') || args.includes('-v')) {
    console.log(pkg.version);
    return { action: 'exit', code: 0 };
  }

  // ── Lifecycle commands ──────────────────────────────────────────────────
  if (args.includes('--doctor')) {
    runDoctor(pkg.version);
    return { action: 'exit', code: 0 };
  }

  if (args.includes('--uninstall')) {
    runUninstall();
    return { action: 'wait' };
  }

  // ── Output format ───────────────────────────────────────────────────────
  // --json is a legacy alias for --format json, kept for backwards
  // compatibility. It will be removed in a future major version.
  let format = DEFAULT_FORMAT;

  const formatIdx = args.indexOf('--format');
  if (formatIdx !== -1) {
    const nextToken = args[formatIdx + 1];
    // If the next token is missing or starts with '-', the user omitted the value.
    if (nextToken === undefined || nextToken.startsWith('-')) {
      console.error('');
      console.error('\x1b[31m  --format requires a value.\x1b[0m');
      console.error('');
      console.error(`  Supported formats: ${SUPPORTED_FORMATS.join(', ')}`);
      console.error('');
      console.error('  Run \x1b[36mtoren --help\x1b[0m for usage.');
      console.error('');
      return { action: 'exit', code: 1 };
    }
    format = nextToken;
  } else if (args.includes('--json')) {
    format = 'json';
  }

  // ── Focused Output Flags ────────────────────────────────────────────────
  const focusedInfo = getFocusedModeInfo(args);
  
  if (focusedInfo.error) {
    console.error(focusedInfo.message);
    return { action: 'exit', code: 1 };
  }

  const focusedMode = focusedInfo.mode;

  // ── Hidden files ────────────────────────────────────────────────────────
  const includeHidden = args.includes('--include-hidden');

  // ── Target path ─────────────────────────────────────────────────────────
  // Build the set of tokens that are consumed as values by named flags so
  // we don't accidentally treat them as the positional path argument.
  const consumedValues = new Set();
  if (formatIdx !== -1 && args[formatIdx + 1] !== undefined && !args[formatIdx + 1].startsWith('-')) {
    consumedValues.add(args[formatIdx + 1]);
  }

  // ── Max files ───────────────────────────────────────────────────────────
  let maxFiles = undefined;
  const maxFilesIdx = args.indexOf('--max-files');
  if (maxFilesIdx !== -1) {
    const rawVal = args[maxFilesIdx + 1];
    if (rawVal === undefined || rawVal.startsWith('-')) {
      console.error('');
      console.error('\x1b[31m  --max-files requires a numeric value.\x1b[0m');
      console.error('  Example: toren --max-files 100000');
      console.error('');
      return { action: 'exit', code: 1 };
    }
    maxFiles = parseInt(rawVal, 10);
    if (isNaN(maxFiles) || maxFiles < 1) {
      console.error('');
      console.error(`\x1b[31m  --max-files must be a positive integer, got: ${rawVal}\x1b[0m`);
      console.error('');
      return { action: 'exit', code: 1 };
    }
    consumedValues.add(rawVal);
  }

  // First non-flag, non-consumed token is the target path; default to cwd.
  const target = args.find(a => !a.startsWith('-') && !consumedValues.has(a)) ?? '.';

  // ── Unknown flag check ──────────────────────────────────────────────────
  const knownFlags = new Set([
    '--help', '-h',
    '--version', '-V', '-v',
    '--doctor',
    '--uninstall',
    '--format',
    '--json',
    ...FOCUSED_FLAGS,
    '--include-hidden',
    '--max-files',
  ]);

  const unknownFlag = args.find(
    a => a.startsWith('-') && !knownFlags.has(a) && !consumedValues.has(a),
  );

  if (unknownFlag) {
    console.error(`\x1b[31m  Unknown flag: ${unknownFlag}\x1b[0m`);
    console.error(`  Run \x1b[36mtoren --help\x1b[0m for usage.\n`);
    return { action: 'exit', code: 1 };
  }

  return { action: 'scan', target, format, includeHidden, maxFiles, focusedMode };
}

// ---------------------------------------------------------------------------
// Format validation
// ---------------------------------------------------------------------------

/**
 * Assert that `format` has a registered renderer.
 * Prints a descriptive error message and exits with code 1 if not found.
 *
 * @param {string} format
 */
function assertValidFormat(format) {
  if (renderers[format]) return;

  const list = SUPPORTED_FORMATS.map(f => `  • ${f}`).join('\n');
  console.error('');
  console.error(`\x1b[31m  Unknown output format: ${format}\x1b[0m`);
  console.error('');
  console.error('  Supported formats:');
  console.error('');
  console.error(list);
  console.error('');
  console.error('  Run \x1b[36mtoren --help\x1b[0m for usage.');
  console.error('');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

(function main() {
  const parsed = parseArgs();

  if (parsed.action === 'exit') {
    process.exit(parsed.code ?? 0);
  }
  if (parsed.action === 'wait') return;

  // Validate before scanning — fail fast on bad format names.
  assertValidFormat(parsed.format);

  const render = renderers[parsed.format];

  try {
    const result = scan(parsed.target, {
      includeHidden: parsed.includeHidden,
      maxFiles:      parsed.maxFiles,
    });
    
    if (parsed.focusedMode) {
      renderFocusedMode(parsed.focusedMode, result);
    } else {
      render(result, { cwd: process.cwd() });
    }
  } catch (err) {
    // Render errors in the requested format where possible.
    if (parsed.format === 'json') {
      console.error(JSON.stringify({ error: err.message }, null, 2));
    } else {
      console.error('');
      console.error(`\x1b[31m  ❌  Error: ${err.message}\x1b[0m`);
      console.error('');
    }
    process.exit(1);
  }
})();
