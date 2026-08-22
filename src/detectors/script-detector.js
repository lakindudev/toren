/**
 * @fileoverview Toren — Script Detector with Intelligence Layer
 *
 * Reads package.json scripts and enriches each entry with:
 *  - category  — functional grouping (development, build, testing, etc.)
 *  - description — human-readable purpose string
 *  - usage — ready-to-run command string for the detected package manager
 *
 * Design contract:
 *  - Backward compatible: name and command are always present and unchanged.
 *  - category and description are null when no deterministic match exists.
 *  - usage is always a string — derived from packageManager or falls back to
 *    "npm run <name>" when packageManager is null.
 *  - Descriptions are never fabricated. Only canonical mappings and known
 *    command-keyword inferences are used.
 *  - Deterministic: same input always produces the same output.
 *  - Graceful: malformed or missing package.json returns an empty array.
 *
 * @module detectors/script-detector
 */

import fs   from 'node:fs';
import path from 'node:path';

// ---------------------------------------------------------------------------
// Description and category tables — keyed by exact script name (lowercase)
// ---------------------------------------------------------------------------

/**
 * Maps a known script name to its canonical human-readable description.
 * @type {Map<string, string>}
 */
const NAME_DESCRIPTIONS = new Map([
  ['dev',        'Start the development server'],
  ['develop',    'Start the development server'],
  ['start',      'Start the application'],
  ['serve',      'Serve the application'],
  ['preview',    'Preview the production build'],
  ['build',      'Create a production build'],
  ['test',       'Run the test suite'],
  ['test:watch', 'Run tests in watch mode'],
  ['test:e2e',   'Run end-to-end tests'],
  ['lint',       'Run code-quality checks'],
  ['lint:fix',   'Run code-quality checks and fix supported issues'],
  ['format',     'Format the codebase'],
  ['typecheck',  'Run static type checks'],
  ['check',      'Run project checks'],
  ['clean',      'Remove generated build artifacts'],
  ['generate',   'Generate project files or code'],
  ['migrate',    'Run database migrations'],
  ['seed',       'Seed the database'],
  ['deploy',     'Deploy the application'],
]);

/**
 * Maps a known script name to its functional category.
 * @type {Map<string, string>}
 */
const NAME_CATEGORIES = new Map([
  ['dev',        'development'],
  ['develop',    'development'],
  ['start',      'development'],
  ['serve',      'development'],
  ['preview',    'development'],
  ['build',      'build'],
  ['test',       'testing'],
  ['test:watch', 'testing'],
  ['test:e2e',   'testing'],
  ['lint',       'quality'],
  ['lint:fix',   'quality'],
  ['format',     'quality'],
  ['typecheck',  'quality'],
  ['check',      'quality'],
  ['clean',      'utility'],
  ['generate',   'utility'],
  ['migrate',    'database'],
  ['seed',       'database'],
  ['deploy',     'deployment'],
]);

// ---------------------------------------------------------------------------
// Command-keyword inference — ordered most-specific first
// ---------------------------------------------------------------------------

/**
 * Ordered list of command-keyword → { description, category } inferences.
 * Evaluated only when a script name has no entry in NAME_DESCRIPTIONS.
 * More specific patterns (e.g. "playwright test") must appear before broader
 * ones (e.g. "jest") to prevent false matches.
 *
 * @type {Array<{ keyword: string, description: string, category: string }>}
 */
const COMMAND_INFERENCE = [
  { keyword: 'playwright test', description: 'Run end-to-end tests',                          category: 'testing'     },
  { keyword: 'cypress run',     description: 'Run end-to-end tests',                          category: 'testing'     },
  { keyword: 'vitest',          description: 'Run the test suite',                            category: 'testing'     },
  { keyword: 'jest',            description: 'Run the test suite',                            category: 'testing'     },
  { keyword: 'tsc --noEmit',    description: 'Run static type checks',                        category: 'quality'     },
  { keyword: 'eslint',          description: 'Run code-quality checks',                       category: 'quality'     },
  { keyword: 'prettier',        description: 'Format the codebase',                           category: 'quality'     },
];

// ---------------------------------------------------------------------------
// Usage builder
// ---------------------------------------------------------------------------

/**
 * Script names that npm treats as built-in lifecycle commands.
 * These do NOT need the "run" subcommand: `npm test`, `npm start`, etc.
 * @type {Set<string>}
 */
const NPM_LIFECYCLE = new Set(['test', 'start', 'stop', 'restart']);

/**
 * Script names that bun exposes as direct subcommands (no "run" needed).
 * @type {Set<string>}
 */
const BUN_LIFECYCLE = new Set(['test', 'start']);

/**
 * Build the ready-to-run usage string for a script.
 *
 * Rules:
 *  npm:  lifecycle commands (test, start…) → `npm <name>`
 *        all others                        → `npm run <name>`
 *  pnpm: all scripts                       → `pnpm <name>`   (pnpm forwards directly)
 *  yarn: all scripts                       → `yarn <name>`
 *  bun:  lifecycle commands (test, start)  → `bun <name>`
 *        all others                        → `bun run <name>`
 *  null: conservative fallback             → `npm run <name>` (always valid)
 *
 * @param {string}      name           - Script name
 * @param {string|null} packageManager - Detected package manager or null
 * @returns {string}
 */
function buildUsage(name, packageManager) {
  switch (packageManager) {
    case 'npm':
      return NPM_LIFECYCLE.has(name) ? `npm ${name}` : `npm run ${name}`;

    case 'pnpm':
      // pnpm forwards all script names without requiring the 'run' sub-command.
      return `pnpm ${name}`;

    case 'yarn':
      // yarn similarly runs scripts directly without 'run'.
      return `yarn ${name}`;

    case 'bun':
      return BUN_LIFECYCLE.has(name) ? `bun ${name}` : `bun run ${name}`;

    default:
      // null or unknown — conservative: `npm run <name>` is always valid even
      // for lifecycle names, so we keep it unconditionally safe.
      return `npm run ${name}`;
  }
}

// ---------------------------------------------------------------------------
// Description + category resolver
// ---------------------------------------------------------------------------

/**
 * Resolve description and category for a single script entry.
 * Priority: exact name match → command-keyword inference → null.
 *
 * @param {string} name
 * @param {string} command
 * @returns {{ description: string|null, category: string|null }}
 */
function resolveIntelligence(name, command) {
  // 1. Exact name match (canonical mapping — highest confidence).
  const nameDescription = NAME_DESCRIPTIONS.get(name) ?? null;
  const nameCategory    = NAME_CATEGORIES.get(name)    ?? null;

  if (nameDescription !== null || nameCategory !== null) {
    return { description: nameDescription, category: nameCategory };
  }

  // 2. Command-keyword inference (fallback — only for unknown names).
  for (const { keyword, description, category } of COMMAND_INFERENCE) {
    if (command.includes(keyword)) {
      return { description, category };
    }
  }

  // 3. Unknown — do not fabricate.
  return { description: null, category: null };
}

// ---------------------------------------------------------------------------
// Types (JSDoc — no TypeScript dependency required)
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} ScriptItem
 * @property {string}      name          - Script name as declared in package.json
 * @property {string}      command       - Raw script command string
 * @property {string|null} category      - Functional category, or null when unknown
 * @property {string|null} description   - Human-readable purpose, or null when unknown
 * @property {string}      usage         - Ready-to-run invocation string
 */

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Detect and enrich npm/package scripts from package.json.
 *
 * The `packageManager` parameter is optional for backward compatibility.
 * When omitted (or null), usage strings fall back to `npm run <name>`.
 *
 * @param {string}      rootPath       - Absolute path of the scanned root
 * @param {string|null} [packageManager=null] - Detected package manager name
 * @returns {{ scripts: ScriptItem[] }}
 */
export function detectScripts(rootPath, packageManager = null) {
  const scripts = [];
  const pkgPath = path.join(rootPath, 'package.json');

  try {
    if (fs.existsSync(pkgPath)) {
      const content = fs.readFileSync(pkgPath, 'utf8');
      const pkg     = JSON.parse(content);

      if (pkg.scripts && typeof pkg.scripts === 'object') {
        for (const [name, command] of Object.entries(pkg.scripts)) {
          if (typeof command !== 'string') continue;

          const { description, category } = resolveIntelligence(name, command);

          scripts.push({
            name,
            command,
            category,
            description,
            usage: buildUsage(name, packageManager),
          });
        }
      }
    }
  } catch {
    // Return empty scripts on malformed or unreadable package.json
  }

  return { scripts };
}
