import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CLI_PATH = path.resolve(__dirname, '../bin/toren.js');
const PKG_PATH = path.resolve(__dirname, '../package.json');

const stripAnsi = (str) => str.replace(/\x1b\[[0-9;]*m/g, '');

function runCLI(args) {
  try {
    const output = execSync(`node ${CLI_PATH} ${args}`, { encoding: 'utf-8', stdio: 'pipe' });
    return {
      output: stripAnsi(output),
      status: 0
    };
  } catch (err) {
    return {
      output: stripAnsi(err.stdout + err.stderr),
      status: err.status
    };
  }
}

describe('Toren CLI Integration Tests', () => {

  test('Version command (-v and --version)', () => {
    const pkg = JSON.parse(fs.readFileSync(PKG_PATH, 'utf-8'));
    
    const res1 = runCLI('--version');
    assert.match(res1.output, new RegExp(`Toren ${pkg.version}`));
    assert.equal(res1.status, 0);

    const res2 = runCLI('-v');
    assert.match(res2.output, new RegExp(`Toren ${pkg.version}`));
    assert.equal(res2.status, 0);
  });

  test('Help command (-h and --help)', () => {
    const res1 = runCLI('--help');
    assert.match(res1.output, /USAGE/);
    assert.match(res1.output, /COMMANDS/);
    assert.equal(res1.status, 0);

    const res2 = runCLI('-h');
    assert.match(res2.output, /USAGE/);
    assert.equal(res2.status, 0);
  });

  test('Invalid directory handling', () => {
    const res = runCLI('/path/that/does/not/exist');
    assert.equal(res.status, 1);
    assert.match(res.output, /✖ Invalid directory/);
    assert.match(res.output, /The specified path does not exist/);
  });

  test('Invalid format flag handling', () => {
    const res = runCLI('. --format unknown');
    assert.equal(res.status, 1);
    assert.match(res.output, /✖ Unsupported output format/);
  });

  test('Repository statistics and console renderer consistency', () => {
    const res = runCLI('.');
    assert.equal(res.status, 0);
    
    assert.match(res.output, /Project Summary\n───────────────/);
    assert.match(res.output, /Total files:/);
    assert.match(res.output, /Total folders:/);
    
    // Check new footer timing format
    assert.match(res.output, /Scan completed in \d+ ms/);
  });

  test('JSON output formatting', () => {
    const res = runCLI('. --format json');
    assert.equal(res.status, 0);
    
    const parsed = JSON.parse(res.output);
    assert.ok(parsed.project);
    assert.ok(parsed.summary);
    assert.ok(parsed.entryPoints);
    assert.ok(parsed.structure);
    
    // Check repository stats in JSON
    assert.equal(typeof parsed.summary.totalFiles, 'number');
    assert.equal(typeof parsed.summary.totalFolders, 'number');
    assert.equal(typeof parsed.summary.scanDurationMs, 'number');
  });

  test('Focused output: --project-type', () => {
    const res = runCLI('. --project-type');
    assert.equal(res.status, 0);
    assert.match(res.output, /Project Type\n────────────/);
  });

  test('Focused output: --frameworks', () => {
    const res = runCLI('. --frameworks');
    assert.equal(res.status, 0);
    assert.match(res.output, /Frameworks\n──────────/);
  });

  test('Focused output: --entry-points', () => {
    const res = runCLI('. --entry-points');
    assert.equal(res.status, 0);
    assert.match(res.output, /Entry Points\n────────────/);
  });

  test('Focused output: --configs', () => {
    const res = runCLI('. --configs');
    assert.equal(res.status, 0);
    assert.match(res.output, /Configuration Files\n───────────────────/);
  });

  test('Focused output: --structure', () => {
    const res = runCLI('. --structure');
    assert.equal(res.status, 0);
    assert.match(res.output, /Folder Structure\n────────────────/);
  });

  test('Focused output: --scripts', () => {
    const res = runCLI('. --scripts');
    assert.equal(res.status, 0);
    assert.match(res.output, /Package Scripts\n───────────────/);
  });

  test('Conflicting focused output flags', () => {
    const res = runCLI('. --configs --structure');
    assert.equal(res.status, 1);
    assert.match(res.output, /✖ Conflicting options/);
    assert.match(res.output, /Focused output flags are mutually exclusive/);
  });

});

// ---------------------------------------------------------------------------
// Empty-state tests
// Each test scans a temporary directory that produces known-empty sections.
// ---------------------------------------------------------------------------

describe('Empty-State Rendering', () => {
  // Create a single temp directory shared across all empty-state tests.
  // It contains only a README.md so the scanner has something to walk,
  // but no package.json, no recognised configs, no entry points, no scripts.
  const EMPTY_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'toren-test-'));
  fs.writeFileSync(path.join(EMPTY_DIR, 'README.md'), '# test\n');

  after(() => {
    fs.rmSync(EMPTY_DIR, { recursive: true, force: true });
  });

  // ── Console renderer ──────────────────────────────────────────────────────

  test('console: Frameworks empty state shows canonical message', () => {
    const res = runCLI(EMPTY_DIR);
    assert.equal(res.status, 0);
    assert.match(res.output, /Frameworks\n──────────/);
    assert.match(res.output, /No frameworks detected\./);
  });

  test('console: Entry Points empty state shows canonical message', () => {
    const res = runCLI(EMPTY_DIR);
    assert.equal(res.status, 0);
    assert.match(res.output, /No entry points detected\./);
  });

  test('console: Configuration Files empty state shows canonical message', () => {
    const res = runCLI(EMPTY_DIR);
    assert.equal(res.status, 0);
    assert.match(res.output, /No configuration files detected\./);
  });

  test('console: Package Scripts empty state shows canonical message', () => {
    const res = runCLI(EMPTY_DIR);
    assert.equal(res.status, 0);
    assert.match(res.output, /No package scripts detected\./);
  });

  // ── Focused mode ──────────────────────────────────────────────────────────

  test('--frameworks empty state shows canonical message with period', () => {
    const res = runCLI(`${EMPTY_DIR} --frameworks`);
    assert.equal(res.status, 0);
    assert.match(res.output, /No frameworks detected\./);
    // Must end with a period — guard against regression to 'None detected'
    assert.doesNotMatch(res.output, /None detected/);
  });

  test('--entry-points empty state shows canonical message with period', () => {
    const res = runCLI(`${EMPTY_DIR} --entry-points`);
    assert.equal(res.status, 0);
    assert.match(res.output, /No entry points detected\./);
  });

  test('--configs empty state shows canonical message with period', () => {
    const res = runCLI(`${EMPTY_DIR} --configs`);
    assert.equal(res.status, 0);
    assert.match(res.output, /No configuration files detected\./);
  });

  test('--scripts empty state shows canonical message with period', () => {
    const res = runCLI(`${EMPTY_DIR} --scripts`);
    assert.equal(res.status, 0);
    assert.match(res.output, /No package scripts detected\./);
  });

  // ── JSON renderer ─────────────────────────────────────────────────────────

  test('JSON: empty sections are always-present empty arrays, never omitted', () => {
    const res = runCLI(`${EMPTY_DIR} --format json`);
    assert.equal(res.status, 0);

    const parsed = JSON.parse(res.output);

    // All array fields must be present and be arrays (even when empty)
    assert.ok(Array.isArray(parsed.frameworks),  'frameworks must be an array');
    assert.ok(Array.isArray(parsed.entryPoints), 'entryPoints must be an array');
    assert.ok(Array.isArray(parsed.configs),     'configs must be an array');
    assert.ok(Array.isArray(parsed.scripts),     'scripts must be an array');
    assert.ok(Array.isArray(parsed.structure),   'structure must be an array');

    // For a non-JS project: frameworks and scripts should be empty
    assert.deepEqual(parsed.frameworks,  []);
    assert.deepEqual(parsed.scripts,     []);

    // projectType should be 'Unknown' for a bare directory
    assert.equal(parsed.project.type, 'Unknown');

    // statistics must be present with 0-safe numeric values
    assert.equal(typeof parsed.statistics.files,      'number');
    assert.equal(typeof parsed.statistics.folders,    'number');
    assert.equal(typeof parsed.statistics.durationMs, 'number');

    // summary backward-compat block must also be present
    assert.ok(parsed.summary, 'backward-compat summary block must be present');
  });

  test('JSON: projectType is "Unknown" string, not null or undefined, for unrecognised project', () => {
    const res = runCLI(`${EMPTY_DIR} --format json`);
    assert.equal(res.status, 0);

    const parsed = JSON.parse(res.output);
    assert.equal(typeof parsed.project.type, 'string');
    assert.equal(parsed.project.type, 'Unknown');
    assert.notEqual(parsed.project.type, null);
  });

  // ── Markdown renderer ─────────────────────────────────────────────────────

  test('markdown: Frameworks section present with empty-state message', () => {
    const res = runCLI(`${EMPTY_DIR} --format markdown`);
    assert.equal(res.status, 0);
    assert.match(res.output, /## Frameworks/);
    assert.match(res.output, /No frameworks detected\./);
  });

  test('markdown: Entry Points section present with empty-state message', () => {
    const res = runCLI(`${EMPTY_DIR} --format markdown`);
    assert.equal(res.status, 0);
    assert.match(res.output, /## Entry Points/);
    assert.match(res.output, /No entry points detected\./);
  });

  test('markdown: Configuration Files section present with empty-state message', () => {
    const res = runCLI(`${EMPTY_DIR} --format markdown`);
    assert.equal(res.status, 0);
    assert.match(res.output, /## Configuration Files/);
    assert.match(res.output, /No configuration files detected\./);
  });

  test('markdown: Package Scripts section present with empty-state message', () => {
    const res = runCLI(`${EMPTY_DIR} --format markdown`);
    assert.equal(res.status, 0);
    assert.match(res.output, /## Package Scripts/);
    assert.match(res.output, /No package scripts detected\./);
  });

  // ── HTML renderer ─────────────────────────────────────────────────────────

  test('HTML: Frameworks section present with empty-state message', () => {
    const res = runCLI(`${EMPTY_DIR} --format html`);
    assert.equal(res.status, 0);
    assert.match(res.output, /class="section-title">Frameworks</);
    assert.match(res.output, /No frameworks detected\./);
  });

  test('HTML: Entry Points section present with empty-state message', () => {
    const res = runCLI(`${EMPTY_DIR} --format html`);
    assert.equal(res.status, 0);
    assert.match(res.output, /No entry points detected\./);
  });

  test('HTML: scan duration is plain text, not double-HTML-escaped', () => {
    // Before the fix, formatDuration returned '&lt; 1 ms' and esc() was not
    // called at the call site. After the fix, plain '< 1 ms' goes through esc()
    // at the call site, producing '&lt; 1 ms' in the final HTML — exactly once.
    // We verify the raw string '< 1 ms' (or '>= 1 ms' form) does NOT appear
    // as a double-escaped sequence '&amp;lt;' anywhere in the output.
    const res = runCLI(`${EMPTY_DIR} --format html`);
    assert.equal(res.status, 0);
    assert.doesNotMatch(res.output, /&amp;lt;/);
  });

});


