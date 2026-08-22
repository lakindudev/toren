/**
 * @fileoverview Tests for script intelligence — detectScripts() enrichment.
 *
 * Covers:
 *  - BC: {name, command} always present and unchanged
 *  - All four output fields present on every item
 *  - Canonical name → description mappings
 *  - Command-keyword inference for unknown names
 *  - Unknown commands / names → description null, category null
 *  - Category assignments for each functional group
 *  - Usage strings for npm, pnpm, yarn, bun
 *  - Usage fallback when packageManager is null
 *  - npm lifecycle shortcuts (test, start) vs run prefix
 *  - bun lifecycle shortcuts vs bun run prefix
 *  - Empty scripts block
 *  - Malformed package.json remains graceful
 *  - Integration via scan() — enriched items in ScanResult
 */

import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { detectScripts } from '../src/detectors/script-detector.js';
import { scan }          from '../src/scanner/scan.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create a temp directory with a package.json containing the given scripts.
 * Returns the directory path. Caller must clean up.
 */
function makeDir(scripts, extraPkg = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'toren-scripts-'));
  const pkg = { name: 'test-app', version: '1.0.0', scripts, ...extraPkg };
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify(pkg));
  return dir;
}

/** Run detectScripts against a temp dir built from a scripts map. */
function runDetect(scripts, packageManager = null, extraPkg = {}) {
  const dir = makeDir(scripts, extraPkg);
  after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return detectScripts(dir, packageManager).scripts;
}

// ---------------------------------------------------------------------------
// BC — {name, command} always present and unchanged
// ---------------------------------------------------------------------------

describe('script intelligence — backward compatibility', () => {

  test('name and command are always present on every script item', () => {
    const result = runDetect({ start: 'node index.js', test: 'jest' });
    for (const s of result) {
      assert.equal(typeof s.name,    'string', 'name must be string');
      assert.equal(typeof s.command, 'string', 'command must be string');
      assert.ok(s.name.length    > 0, 'name must not be empty');
      assert.ok(s.command.length > 0, 'command must not be empty');
    }
  });

  test('name and command values are unchanged from package.json', () => {
    const result = runDetect({ 'my-script': 'custom-tool --flag' });
    assert.equal(result[0].name,    'my-script');
    assert.equal(result[0].command, 'custom-tool --flag');
  });

  test('all four intelligence fields are present on every item', () => {
    const result = runDetect({ dev: 'vite', unknown: 'custom-internal-tool' });
    for (const s of result) {
      assert.ok('category'    in s, `category missing on "${s.name}"`);
      assert.ok('description' in s, `description missing on "${s.name}"`);
      assert.ok('usage'       in s, `usage missing on "${s.name}"`);
    }
  });

  test('empty scripts block returns empty array', () => {
    const result = runDetect({});
    assert.deepEqual(result, []);
  });

  test('malformed package.json returns empty array gracefully', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'toren-bad-pkg-'));
    after(() => fs.rmSync(dir, { recursive: true, force: true }));
    fs.writeFileSync(path.join(dir, 'package.json'), 'NOT JSON {{{{');
    const { scripts } = detectScripts(dir, null);
    assert.deepEqual(scripts, []);
  });

  test('missing package.json returns empty array gracefully', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'toren-no-pkg-'));
    after(() => fs.rmSync(dir, { recursive: true, force: true }));
    // No package.json written
    const { scripts } = detectScripts(dir, null);
    assert.deepEqual(scripts, []);
  });

});

// ---------------------------------------------------------------------------
// Descriptions — name-based canonical mappings
// ---------------------------------------------------------------------------

describe('script intelligence — descriptions by name', () => {

  const NAME_MAP = [
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
  ];

  for (const [name, expectedDescription] of NAME_MAP) {
    test(`"${name}" → "${expectedDescription}"`, () => {
      const result = runDetect({ [name]: 'some-tool' });
      assert.equal(result.length, 1);
      assert.equal(result[0].description, expectedDescription,
        `description for "${name}" must be "${expectedDescription}"`);
    });
  }

});

// ---------------------------------------------------------------------------
// Descriptions — command-keyword inference (fallback for unknown names)
// ---------------------------------------------------------------------------

describe('script intelligence — descriptions by command inference', () => {

  test('command contains "eslint" → "Run code-quality checks"', () => {
    const result = runDetect({ 'check-code': 'eslint .' });
    assert.equal(result[0].description, 'Run code-quality checks');
  });

  test('command contains "prettier" → "Format the codebase"', () => {
    const result = runDetect({ 'fmt': 'prettier --write .' });
    assert.equal(result[0].description, 'Format the codebase');
  });

  test('command contains "tsc --noEmit" → "Run static type checks"', () => {
    const result = runDetect({ 'types': 'tsc --noEmit' });
    assert.equal(result[0].description, 'Run static type checks');
  });

  test('command contains "vitest" → "Run the test suite"', () => {
    const result = runDetect({ 'unit': 'vitest run' });
    assert.equal(result[0].description, 'Run the test suite');
  });

  test('command contains "jest" → "Run the test suite"', () => {
    const result = runDetect({ 'unit': 'jest --ci' });
    assert.equal(result[0].description, 'Run the test suite');
  });

  test('command contains "playwright test" → "Run end-to-end tests"', () => {
    const result = runDetect({ 'e2e': 'playwright test' });
    assert.equal(result[0].description, 'Run end-to-end tests');
  });

  test('command contains "cypress run" → "Run end-to-end tests"', () => {
    const result = runDetect({ 'e2e': 'cypress run --headless' });
    assert.equal(result[0].description, 'Run end-to-end tests');
  });

  test('playwright test matched before plain "jest" when both present in command', () => {
    // This verifies ordering — "playwright test" is more specific than "jest"
    const result = runDetect({ 'e2e': 'playwright test --reporter=jest' });
    assert.equal(result[0].description, 'Run end-to-end tests');
  });

});

// ---------------------------------------------------------------------------
// Unknown descriptions — must be null, never fabricated
// ---------------------------------------------------------------------------

describe('script intelligence — unknown descriptions are null', () => {

  test('completely custom command → description null', () => {
    const result = runDetect({ 'publish-docs': 'custom-internal-tool abc' });
    assert.equal(result[0].description, null,
      'description must be null for unrecognised commands');
  });

  test('unknown name AND unrecognised command → category null and description null', () => {
    const result = runDetect({ 'do-magic': 'internal-magic --wand' });
    assert.equal(result[0].description, null);
    assert.equal(result[0].category,    null);
  });

  test('known name takes priority over unrecognised command', () => {
    // name="test" is known; command is not. Description should come from name.
    const result = runDetect({ test: 'custom-test-runner --weird-flag' });
    assert.equal(result[0].description, 'Run the test suite');
    assert.equal(result[0].category,    'testing');
  });

});

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

describe('script intelligence — categories', () => {

  const CATEGORY_MAP = [
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
  ];

  for (const [name, expectedCategory] of CATEGORY_MAP) {
    test(`"${name}" → category "${expectedCategory}"`, () => {
      const result = runDetect({ [name]: 'some-tool' });
      assert.equal(result[0].category, expectedCategory);
    });
  }

  test('command-inferred category: eslint → quality', () => {
    const result = runDetect({ 'my-lint': 'eslint src' });
    assert.equal(result[0].category, 'quality');
  });

  test('command-inferred category: vitest → testing', () => {
    const result = runDetect({ 'my-test': 'vitest' });
    assert.equal(result[0].category, 'testing');
  });

});

// ---------------------------------------------------------------------------
// Usage — npm
// ---------------------------------------------------------------------------

describe('script intelligence — usage: npm', () => {

  test('npm: "dev" → "npm run dev"  (not a lifecycle command)', () => {
    const result = runDetect({ dev: 'vite' }, 'npm');
    assert.equal(result[0].usage, 'npm run dev');
  });

  test('npm: "test" → "npm test"  (lifecycle shortcut)', () => {
    const result = runDetect({ test: 'jest' }, 'npm');
    assert.equal(result[0].usage, 'npm test');
  });

  test('npm: "start" → "npm start"  (lifecycle shortcut)', () => {
    const result = runDetect({ start: 'node index.js' }, 'npm');
    assert.equal(result[0].usage, 'npm start');
  });

  test('npm: "stop" → "npm stop"  (lifecycle shortcut)', () => {
    const result = runDetect({ stop: 'node stop.js' }, 'npm');
    assert.equal(result[0].usage, 'npm stop');
  });

  test('npm: "build" → "npm run build"', () => {
    const result = runDetect({ build: 'tsc' }, 'npm');
    assert.equal(result[0].usage, 'npm run build');
  });

  test('npm: "lint:fix" → "npm run lint:fix"', () => {
    const result = runDetect({ 'lint:fix': 'eslint --fix .' }, 'npm');
    assert.equal(result[0].usage, 'npm run lint:fix');
  });

  test('npm: unknown script → "npm run <name>"', () => {
    const result = runDetect({ 'publish-docs': 'my-tool' }, 'npm');
    assert.equal(result[0].usage, 'npm run publish-docs');
  });

});

// ---------------------------------------------------------------------------
// Usage — pnpm
// ---------------------------------------------------------------------------

describe('script intelligence — usage: pnpm', () => {

  test('pnpm: "dev" → "pnpm dev"', () => {
    const result = runDetect({ dev: 'vite' }, 'pnpm');
    assert.equal(result[0].usage, 'pnpm dev');
  });

  test('pnpm: "test" → "pnpm test"', () => {
    const result = runDetect({ test: 'vitest' }, 'pnpm');
    assert.equal(result[0].usage, 'pnpm test');
  });

  test('pnpm: "start" → "pnpm start"', () => {
    const result = runDetect({ start: 'node index.js' }, 'pnpm');
    assert.equal(result[0].usage, 'pnpm start');
  });

  test('pnpm: "build" → "pnpm build"', () => {
    const result = runDetect({ build: 'tsc' }, 'pnpm');
    assert.equal(result[0].usage, 'pnpm build');
  });

  test('pnpm: "lint:fix" → "pnpm lint:fix"', () => {
    const result = runDetect({ 'lint:fix': 'eslint --fix .' }, 'pnpm');
    assert.equal(result[0].usage, 'pnpm lint:fix');
  });

});

// ---------------------------------------------------------------------------
// Usage — yarn
// ---------------------------------------------------------------------------

describe('script intelligence — usage: yarn', () => {

  test('yarn: "dev" → "yarn dev"', () => {
    const result = runDetect({ dev: 'vite' }, 'yarn');
    assert.equal(result[0].usage, 'yarn dev');
  });

  test('yarn: "test" → "yarn test"', () => {
    const result = runDetect({ test: 'jest' }, 'yarn');
    assert.equal(result[0].usage, 'yarn test');
  });

  test('yarn: "start" → "yarn start"', () => {
    const result = runDetect({ start: 'node index.js' }, 'yarn');
    assert.equal(result[0].usage, 'yarn start');
  });

  test('yarn: "build" → "yarn build"', () => {
    const result = runDetect({ build: 'tsc' }, 'yarn');
    assert.equal(result[0].usage, 'yarn build');
  });

});

// ---------------------------------------------------------------------------
// Usage — bun
// ---------------------------------------------------------------------------

describe('script intelligence — usage: bun', () => {

  test('bun: "dev" → "bun run dev"  (not a bun shortcut)', () => {
    const result = runDetect({ dev: 'bun --hot index.ts' }, 'bun');
    assert.equal(result[0].usage, 'bun run dev');
  });

  test('bun: "test" → "bun test"  (bun shortcut)', () => {
    const result = runDetect({ test: 'bun test' }, 'bun');
    assert.equal(result[0].usage, 'bun test');
  });

  test('bun: "start" → "bun start"  (bun shortcut)', () => {
    const result = runDetect({ start: 'bun index.ts' }, 'bun');
    assert.equal(result[0].usage, 'bun start');
  });

  test('bun: "build" → "bun run build"', () => {
    const result = runDetect({ build: 'bun build ./src/index.ts' }, 'bun');
    assert.equal(result[0].usage, 'bun run build');
  });

  test('bun: "lint" → "bun run lint"', () => {
    const result = runDetect({ lint: 'eslint .' }, 'bun');
    assert.equal(result[0].usage, 'bun run lint');
  });

});

// ---------------------------------------------------------------------------
// Usage — null / unknown package manager fallback
// ---------------------------------------------------------------------------

describe('script intelligence — usage: null packageManager fallback', () => {

  test('null: "dev" → "npm run dev"  (conservative fallback)', () => {
    const result = runDetect({ dev: 'vite' }, null);
    assert.equal(result[0].usage, 'npm run dev');
  });

  test('null: "test" → "npm run test"  (conservative — always valid)', () => {
    // "npm run test" is always valid even though "npm test" is also valid.
    const result = runDetect({ test: 'jest' }, null);
    assert.equal(result[0].usage, 'npm run test');
  });

  test('null: "start" → "npm run start"  (conservative fallback)', () => {
    const result = runDetect({ start: 'node index.js' }, null);
    assert.equal(result[0].usage, 'npm run start');
  });

  test('null: "build" → "npm run build"', () => {
    const result = runDetect({ build: 'tsc' }, null);
    assert.equal(result[0].usage, 'npm run build');
  });

  test('undefined packageManager treated same as null', () => {
    // Backward-compat: old callers may call detectScripts(rootPath) with no 2nd arg
    const dir = makeDir({ dev: 'vite' });
    after(() => fs.rmSync(dir, { recursive: true, force: true }));
    // No packageManager argument — should use default (null → "npm run dev")
    const { scripts } = detectScripts(dir);
    assert.equal(scripts[0].usage, 'npm run dev');
  });

});

// ---------------------------------------------------------------------------
// Integration — scan() ScanResult.scripts has enriched items
// ---------------------------------------------------------------------------

describe('script intelligence — scan() integration', () => {

  test('scan result scripts contain all five fields', () => {
    const dir = makeDir({ dev: 'vite', test: 'jest', build: 'tsc' });
    after(() => fs.rmSync(dir, { recursive: true, force: true }));

    // Write a package-lock.json so packageManager is detected as npm
    fs.writeFileSync(path.join(dir, 'package-lock.json'), '{"lockfileVersion":3}');

    const result = scan(dir);
    assert.ok(result.scripts.length > 0, 'must have scripts');

    for (const s of result.scripts) {
      assert.ok('name'        in s, `name missing on "${s.name}"`);
      assert.ok('command'     in s, `command missing on "${s.name}"`);
      assert.ok('category'    in s, `category missing on "${s.name}"`);
      assert.ok('description' in s, `description missing on "${s.name}"`);
      assert.ok('usage'       in s, `usage missing on "${s.name}"`);
    }
  });

  test('scan: npm project — "test" usage = "npm test"', () => {
    const dir = makeDir({ test: 'jest' });
    after(() => fs.rmSync(dir, { recursive: true, force: true }));
    fs.writeFileSync(path.join(dir, 'package-lock.json'), '{"lockfileVersion":3}');

    const result = scan(dir);
    const testScript = result.scripts.find(s => s.name === 'test');
    assert.ok(testScript, '"test" script must be present');
    assert.equal(testScript.usage, 'npm test');
  });

  test('scan: pnpm project — "dev" usage = "pnpm dev"', () => {
    const dir = makeDir({ dev: 'vite' });
    after(() => fs.rmSync(dir, { recursive: true, force: true }));
    fs.writeFileSync(path.join(dir, 'pnpm-lock.yaml'), 'lockfileVersion: "6.0"\n');

    const result = scan(dir);
    const devScript = result.scripts.find(s => s.name === 'dev');
    assert.ok(devScript, '"dev" script must be present');
    assert.equal(devScript.usage, 'pnpm dev');
  });

  test('scan: toren repo — scripts are enriched (real-world check)', () => {
    const torenRoot = path.resolve(__dirname, '..');
    const result    = scan(torenRoot);

    // toren has a "test" script: "node --test"
    const testScript = result.scripts.find(s => s.name === 'test');
    assert.ok(testScript, '"test" script must exist in toren');
    assert.equal(typeof testScript.usage, 'string', 'usage must be a string');
    assert.ok(testScript.usage.length > 0, 'usage must not be empty');
  });

});
