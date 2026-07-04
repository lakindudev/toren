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
  toren [path]              Scan a directory (defaults to current directory)
  toren --format <type>     Select output format (default: console)
  toren --help              Show this help message
  toren --version           Show version number
  toren --doctor            Check global installation health
  toren --uninstall         Safely remove global installation
  toren --max-files <N>     Set max file scan limit (default 50000)

\x1b[1mOutput Formats:\x1b[0m
${formatList}

    console is the default.

\x1b[1mExamples:\x1b[0m
  toren .                   Scan the current directory
  toren ./my-project        Scan a specific project folder
  toren --format json       Output results as JSON
  toren --format json .     Scan a path and output as JSON
`);
}

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} ParsedArgs
 * @property {'exit'|'wait'|'scan'} action
 * @property {string}  [target]  - Resolved path to scan
 * @property {string}  [format]  - Renderer format name
 * @property {boolean} [includeHidden] - Whether to include hidden files
 * @property {number}  [maxFiles] - Max files to scan
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
    return { action: 'exit' };
  }

  if (args.includes('--version') || args.includes('-v') || args.includes('--v')) {
    console.log(pkg.version);
    return { action: 'exit' };
  }

  // ── Lifecycle commands ──────────────────────────────────────────────────
  if (args.includes('--doctor')) {
    runDoctor(pkg.version);
    return { action: 'exit' };
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
    // Accept the token immediately following --format.
    // If the user omits the value (e.g. toren --format) default is used.
    format = args[formatIdx + 1] ?? DEFAULT_FORMAT;
  } else if (args.includes('--json')) {
    format = 'json';
  }

  // ── Hidden files ────────────────────────────────────────────────────────
  const includeHidden = args.includes('--include-hidden');


  // ── Target path ─────────────────────────────────────────────────────────
  // Build the set of tokens that are consumed as values by named flags so
  // we don't accidentally treat them as the positional path argument.
  // Currently only --format consumes a value token.
  const consumedValues = new Set();
  if (formatIdx !== -1 && args[formatIdx + 1] !== undefined) {
    consumedValues.add(args[formatIdx + 1]);
  }

  // ── Max files ───────────────────────────────────────────────────────────
  let maxFiles = undefined;
  const maxFilesIdx = args.indexOf('--max-files');
  if (maxFilesIdx !== -1 && args[maxFilesIdx + 1] !== undefined) {
    maxFiles = parseInt(args[maxFilesIdx + 1], 10);
    consumedValues.add(args[maxFilesIdx + 1]);
  }

  // First non-flag, non-consumed token is the target path; default to cwd.
  const target = args.find(a => !a.startsWith('-') && !consumedValues.has(a)) ?? '.';

  // ── Unknown flag check ──────────────────────────────────────────────────
  const knownFlags = new Set(['--help', '-h', '--version', '-v', '--v', '--doctor', '--uninstall', '--format', '--json', '--include-hidden', '--max-files']);
  const unknownFlag = args.find(a => a.startsWith('-') && !knownFlags.has(a) && !consumedValues.has(a));
  
  if (unknownFlag) {
    console.error(`\x1b[31m  Unknown flag: ${unknownFlag}\x1b[0m`);
    console.error(`  Run \x1b[36mtoren --help\x1b[0m for usage.\n`);
    return { action: 'exit' };
  }

  return { action: 'scan', target, format, includeHidden, maxFiles };
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
  if (parsed.action === 'exit') process.exit(0);
  if (parsed.action === 'wait') return;

  // Validate before scanning — fail fast on bad format names.
  assertValidFormat(parsed.format);

  const render = renderers[parsed.format];

  try {
    const result = scan(parsed.target, { 
      includeHidden: parsed.includeHidden, 
      maxFiles: parsed.maxFiles 
    });
    render(result, { cwd: process.cwd() });
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
