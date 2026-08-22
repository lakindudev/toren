/**
 * @fileoverview Tests for detectPackageManager (unit) and scan() integration.
 *
 * Covers all 8 specified cases:
 *  1. package-lock.json  → npm
 *  2. pnpm-lock.yaml     → pnpm
 *  3. yarn.lock          → yarn
 *  4. bun.lock           → bun
 *  5. bun.lockb          → bun
 *  6. no lockfile        → null
 *  7. nested lockfile does not influence root detection
 *  8. multiple conflicting lockfiles → null / ambiguous
 *
 * Plus integration tests via scan() verifying ScanResult.packageManager.
 */

import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { detectPackageManager } from '../src/detectors/package-manager-detector.js';
import { scan }                 from '../src/scanner/scan.js';

// ---------------------------------------------------------------------------
// Unit tests — detectPackageManager(flatFiles)
// ---------------------------------------------------------------------------

describe('detectPackageManager — unit', () => {

  // ── 1. package-lock.json → npm ───────────────────────────────────────────

  test('package-lock.json at root → npm', () => {
    const result = detectPackageManager(['package-lock.json', 'src/index.js', 'package.json']);
    assert.equal(result.packageManager, 'npm');
    assert.deepEqual(result.packageManagers, ['npm']);
    assert.equal(result.ambiguous, false);
  });

  // ── 2. pnpm-lock.yaml → pnpm ─────────────────────────────────────────────

  test('pnpm-lock.yaml at root → pnpm', () => {
    const result = detectPackageManager(['pnpm-lock.yaml', 'src/index.ts', 'package.json']);
    assert.equal(result.packageManager, 'pnpm');
    assert.deepEqual(result.packageManagers, ['pnpm']);
    assert.equal(result.ambiguous, false);
  });

  // ── 3. yarn.lock → yarn ──────────────────────────────────────────────────

  test('yarn.lock at root → yarn', () => {
    const result = detectPackageManager(['yarn.lock', 'src/App.tsx', 'package.json']);
    assert.equal(result.packageManager, 'yarn');
    assert.deepEqual(result.packageManagers, ['yarn']);
    assert.equal(result.ambiguous, false);
  });

  // ── 4. bun.lock → bun ────────────────────────────────────────────────────

  test('bun.lock at root → bun', () => {
    const result = detectPackageManager(['bun.lock', 'index.ts', 'package.json']);
    assert.equal(result.packageManager, 'bun');
    assert.deepEqual(result.packageManagers, ['bun']);
    assert.equal(result.ambiguous, false);
  });

  // ── 5. bun.lockb → bun ───────────────────────────────────────────────────

  test('bun.lockb at root → bun', () => {
    const result = detectPackageManager(['bun.lockb', 'index.ts', 'package.json']);
    assert.equal(result.packageManager, 'bun');
    assert.deepEqual(result.packageManagers, ['bun']);
    assert.equal(result.ambiguous, false);
  });

  test('both bun.lock and bun.lockb present → single bun (same manager, no ambiguity)', () => {
    // Two lockfiles for the same manager should not produce ambiguity
    const result = detectPackageManager(['bun.lock', 'bun.lockb', 'package.json']);
    assert.equal(result.packageManager, 'bun');
    assert.deepEqual(result.packageManagers, ['bun']);
    assert.equal(result.ambiguous, false);
  });

  // ── 6. No lockfile → null ─────────────────────────────────────────────────

  test('no lockfile present → null', () => {
    const result = detectPackageManager(['src/index.js', 'package.json', 'README.md']);
    assert.equal(result.packageManager, null);
    assert.deepEqual(result.packageManagers, []);
    assert.equal(result.ambiguous, false);
  });

  test('empty flatFiles → null', () => {
    const result = detectPackageManager([]);
    assert.equal(result.packageManager, null);
    assert.deepEqual(result.packageManagers, []);
    assert.equal(result.ambiguous, false);
  });

  // ── 7. Nested lockfile does NOT determine root package manager ────────────

  test('nested package-lock.json does not determine root package manager', () => {
    const result = detectPackageManager([
      'examples/foo/package-lock.json',   // nested — must be ignored
      'packages/web/yarn.lock',           // nested — must be ignored
      'src/index.js',
      'package.json',
    ]);
    assert.equal(result.packageManager, null,
      'nested lockfiles must not influence root package manager detection');
    assert.deepEqual(result.packageManagers, []);
    assert.equal(result.ambiguous, false);
  });

  test('nested pnpm-lock.yaml does not determine root package manager', () => {
    const result = detectPackageManager([
      'apps/backend/pnpm-lock.yaml',
      'README.md',
    ]);
    assert.equal(result.packageManager, null);
    assert.deepEqual(result.packageManagers, []);
  });

  test('root lockfile takes priority; nested files of other managers ignored', () => {
    const result = detectPackageManager([
      'yarn.lock',                          // root — yarn
      'packages/api/package-lock.json',     // nested — ignored
      'src/index.ts',
    ]);
    assert.equal(result.packageManager, 'yarn');
    assert.deepEqual(result.packageManagers, ['yarn']);
    assert.equal(result.ambiguous, false);
  });

  // ── 8. Multiple conflicting lockfiles → null / ambiguous ─────────────────

  test('package-lock.json + yarn.lock at root → null, ambiguous', () => {
    const result = detectPackageManager([
      'package-lock.json',
      'yarn.lock',
      'src/index.js',
    ]);
    assert.equal(result.packageManager, null,
      'conflicting lockfiles must produce null packageManager');
    assert.equal(result.ambiguous, true,
      'conflicting lockfiles must set ambiguous=true');
    assert.ok(result.packageManagers.includes('npm'),  'npm must be listed');
    assert.ok(result.packageManagers.includes('yarn'), 'yarn must be listed');
  });

  test('pnpm-lock.yaml + yarn.lock at root → null, ambiguous', () => {
    const result = detectPackageManager(['pnpm-lock.yaml', 'yarn.lock', 'package.json']);
    assert.equal(result.packageManager, null);
    assert.equal(result.ambiguous, true);
    assert.ok(result.packageManagers.includes('pnpm'));
    assert.ok(result.packageManagers.includes('yarn'));
  });

  test('three conflicting lockfiles at root → null, ambiguous, all listed', () => {
    const result = detectPackageManager([
      'package-lock.json',
      'yarn.lock',
      'pnpm-lock.yaml',
      'src/index.js',
    ]);
    assert.equal(result.packageManager, null);
    assert.equal(result.ambiguous, true);
    assert.equal(result.packageManagers.length, 3,
      'all three unique package managers must be listed');
  });

  // ── Extra correctness ─────────────────────────────────────────────────────

  test('packageManagers array is always sorted deterministically', () => {
    // Regardless of input order, output must be sorted
    const r1 = detectPackageManager(['yarn.lock', 'package-lock.json']);
    const r2 = detectPackageManager(['package-lock.json', 'yarn.lock']);
    assert.deepEqual(r1.packageManagers, r2.packageManagers,
      'output must be deterministic regardless of input order');
  });

  test('non-lockfile at root does not trigger detection', () => {
    // "lock.json" is not a recognized lockfile name
    const result = detectPackageManager(['lock.json', 'some-lock.yaml', 'package.json']);
    assert.equal(result.packageManager, null);
    assert.deepEqual(result.packageManagers, []);
    assert.equal(result.ambiguous, false);
  });

});

// ---------------------------------------------------------------------------
// Integration tests — scan() → ScanResult.packageManager
// ---------------------------------------------------------------------------

describe('detectPackageManager — scan() integration', () => {

  // Helper: create a temp directory, write files, return the dir path.
  // The caller must clean up via after().
  function makeDir(files) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'toren-pm-'));
    for (const [name, content] of Object.entries(files)) {
      const fullPath = path.join(dir, name);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, content);
    }
    return dir;
  }

  test('ScanResult includes packageManager field', () => {
    const dir = makeDir({ 'README.md': '# test\n' });
    after(() => fs.rmSync(dir, { recursive: true, force: true }));

    const result = scan(dir);
    assert.ok('packageManager' in result,
      'ScanResult must contain packageManager field');
  });

  test('ScanResult.packageManager is string or null — never undefined', () => {
    const dir = makeDir({ 'README.md': '# test\n' });
    after(() => fs.rmSync(dir, { recursive: true, force: true }));

    const result = scan(dir);
    const pm = result.packageManager;
    assert.ok(pm === null || typeof pm === 'string',
      `packageManager must be string|null, got ${typeof pm}`);
  });

  test('npm project: package-lock.json → ScanResult.packageManager = "npm"', () => {
    const dir = makeDir({
      'package.json':      '{"name":"app","version":"1.0.0"}',
      'package-lock.json': '{"lockfileVersion":3}',
      'index.js':          'module.exports = {}',
    });
    after(() => fs.rmSync(dir, { recursive: true, force: true }));

    const result = scan(dir);
    assert.equal(result.packageManager, 'npm');
  });

  test('pnpm project: pnpm-lock.yaml → ScanResult.packageManager = "pnpm"', () => {
    const dir = makeDir({
      'package.json':    '{"name":"app","version":"1.0.0"}',
      'pnpm-lock.yaml':  'lockfileVersion: "6.0"\n',
    });
    after(() => fs.rmSync(dir, { recursive: true, force: true }));

    const result = scan(dir);
    assert.equal(result.packageManager, 'pnpm');
  });

  test('yarn project: yarn.lock → ScanResult.packageManager = "yarn"', () => {
    const dir = makeDir({
      'package.json': '{"name":"app","version":"1.0.0"}',
      'yarn.lock':    '# yarn lockfile v1\n',
    });
    after(() => fs.rmSync(dir, { recursive: true, force: true }));

    const result = scan(dir);
    assert.equal(result.packageManager, 'yarn');
  });

  test('bun project: bun.lockb → ScanResult.packageManager = "bun"', () => {
    const dir = makeDir({
      'package.json': '{"name":"app","version":"1.0.0"}',
      'bun.lockb':    '',
    });
    after(() => fs.rmSync(dir, { recursive: true, force: true }));

    const result = scan(dir);
    assert.equal(result.packageManager, 'bun');
  });

  test('no lockfile → ScanResult.packageManager = null', () => {
    const dir = makeDir({
      'README.md': '# bare\n',
    });
    after(() => fs.rmSync(dir, { recursive: true, force: true }));

    const result = scan(dir);
    assert.equal(result.packageManager, null);
  });

  test('conflicting lockfiles at root → ScanResult.packageManager = null', () => {
    const dir = makeDir({
      'package.json':      '{"name":"app","version":"1.0.0"}',
      'package-lock.json': '{"lockfileVersion":3}',
      'yarn.lock':         '# yarn lockfile v1\n',
    });
    after(() => fs.rmSync(dir, { recursive: true, force: true }));

    const result = scan(dir);
    assert.equal(result.packageManager, null,
      'ambiguous lockfiles must result in null at the ScanResult level');
  });

  test('nested lockfile only: ScanResult.packageManager = null', () => {
    const dir = makeDir({
      'README.md':                      '# root\n',
      'examples/app/package-lock.json': '{"lockfileVersion":3}',
    });
    after(() => fs.rmSync(dir, { recursive: true, force: true }));

    const result = scan(dir);
    assert.equal(result.packageManager, null,
      'nested lockfiles must not influence root packageManager');
  });

  test('toren repo itself is detected as npm (has package-lock.json)', () => {
    // This test documents the live behaviour on the toren repository itself.
    const result = scan('.');
    assert.equal(result.packageManager, 'npm',
      'toren uses package-lock.json; should be detected as npm');
  });

});
