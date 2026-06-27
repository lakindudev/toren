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
import { runDoctor, runUninstall } from '../src/lifecycle.js';

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
  toren --doctor      Check global installation health
  toren --uninstall   Safely remove global installation

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
    return { action: 'exit' };
  }

  if (args.includes('--version') || args.includes('-v')) {
    console.log(pkg.version);
    return { action: 'exit' };
  }
  
  if (args.includes('--doctor')) {
    runDoctor(pkg.version);
    return { action: 'exit' };
  }
  
  if (args.includes('--uninstall')) {
    runUninstall();
    return { action: 'wait' };
  }

  // First non-flag argument is the target path; default to cwd.
  const target = args.find(a => !a.startsWith('-')) ?? '.';
  return { action: 'scan', target };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

(function main() {
  const parsed = parseArgs();
  if (parsed.action === 'exit') process.exit(0);
  if (parsed.action === 'wait') return;

  try {
    const result = scan(parsed.target);
    render(result, { cwd: process.cwd() });
  } catch (err) {
    console.error('');
    console.error(`\x1b[31m  ❌  Error: ${err.message}\x1b[0m`);
    console.error('');
    process.exit(1);
  }
})();
