#!/usr/bin/env node
/**
 * @fileoverview Toren CLI — Entry Point
 *
 * Usage:
 *   toren [path]          Scan <path> (defaults to current directory)
 *   toren --version       Print version
 *   toren --help          Print usage
 *
 * Output formatting is fully delegated to src/renderers/console-renderer.js.
 * To add a new output format (--format json | md | html), import the
 * corresponding renderer and call its render() function here.
 */

import { createRequire } from 'node:module';
import { scan }   from '../src/scanner/scan.js';
import { render } from '../src/renderers/console-renderer.js';


const require = createRequire(import.meta.url);
const pkg     = require('../package.json');

// ---------------------------------------------------------------------------
// Help / Version
// ---------------------------------------------------------------------------

function printHelp() {
  console.log(`
\x1b[1mUsage:\x1b[0m
  toren [path]        Scan a directory (defaults to current directory)
  toren --help        Show this help message
  toren --version     Show version number

\x1b[1mExamples:\x1b[0m
  toren .             Scan the current directory
  toren ./my-project  Scan a specific project folder
`);
}

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

/**
 * Parse process.argv and return the resolved target path.
 * Returns null when the process should exit immediately (--help / --version).
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
    render(result, { cwd: process.cwd() });
  } catch (err) {
    console.error('');
    console.error(`\x1b[31m  ❌  Error: ${err.message}\x1b[0m`);
    console.error('');
    process.exit(1);
  }
})();
