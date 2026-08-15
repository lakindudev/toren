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

function runCLI(args, options = {}) {
  try {
    const output = execSync(`node ${CLI_PATH} ${args}`, { encoding: 'utf-8', stdio: 'pipe', ...options });
    return {
      output: stripAnsi(output),
      rawOutput: output,
      status: 0
    };
  } catch (err) {
    const raw = (err.stdout || '') + (err.stderr || '');
    return {
      output: stripAnsi(raw),
      rawOutput: raw,
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

  test('Platform: NO_COLOR=1 removes ANSI codes from output', () => {
    const res = runCLI('.', { env: { ...process.env, NO_COLOR: '1' } });
    assert.equal(res.status, 0);
    assert.doesNotMatch(res.rawOutput, /\x1b\[/);
  });

  test('Platform: FORCE_COLOR=1 forces ANSI codes in output', () => {
    // FORCE_COLOR=1 overrides isTTY=false or NO_COLOR
    const res = runCLI('.', { env: { ...process.env, FORCE_COLOR: '1', NO_COLOR: '' } });
    assert.equal(res.status, 0);
    assert.match(res.rawOutput, /\x1b\[/);
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
    assert.match(res.output, /## Configurations/);
    assert.match(res.output, /No configuration files detected\./);
  });

  test('markdown: Package Scripts section present with empty-state message', () => {
    const res = runCLI(`${EMPTY_DIR} --format markdown`);
    assert.equal(res.status, 0);
    assert.match(res.output, /## Scripts/);
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


// ---------------------------------------------------------------------------
// JSON Output Consistency tests (v1.0.7)
// Covers all six required scenarios from the requirement spec.
// ---------------------------------------------------------------------------

describe('JSON Output Consistency', () => {
  // Shared helper: create a temp dir, write files, return cleanup fn.
  function makeDir(files) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'toren-json-'));
    for (const [name, content] of Object.entries(files)) {
      fs.writeFileSync(path.join(dir, name), content);
    }
    return dir;
  }

  // Canonical property order that every JSON response must follow.
  const PROPERTY_ORDER = [
    'meta', 'project', 'frameworks', 'entryPoints',
    'configs', 'scripts', 'statistics', 'structure', 'summary',
  ];

  function getJSON(args) {
    const res = runCLI(`${args} --format json`);
    assert.equal(res.status, 0, `CLI exited with ${res.status}:\n${res.output}`);
    return JSON.parse(res.output);
  }

  // ── 1. Normal repository ──────────────────────────────────────────────────

  test('normal repo: all top-level keys present in canonical order', () => {
    const data = getJSON('.');
    const actualOrder = Object.keys(data);
    assert.deepEqual(actualOrder, PROPERTY_ORDER);
  });

  test('normal repo: project block has name, path and type fields', () => {
    const data = getJSON('.');
    assert.equal(typeof data.project.name, 'string', 'project.name must be string');
    assert.equal(typeof data.project.path, 'string', 'project.path must be string');
    assert.equal(typeof data.project.type, 'string', 'project.type must be string');
    assert.ok(data.project.name.length > 0, 'project.name must not be empty');
  });

  test('normal repo: all array fields are arrays (never null)', () => {
    const data = getJSON('.');
    for (const key of ['frameworks', 'entryPoints', 'configs', 'scripts', 'structure']) {
      assert.ok(Array.isArray(data[key]), `${key} must be an array, got ${typeof data[key]}`);
      assert.notEqual(data[key], null, `${key} must not be null`);
    }
  });

  test('normal repo: statistics block contains only numeric values', () => {
    const data = getJSON('.');
    const { files, folders, durationMs } = data.statistics;
    assert.equal(typeof files,     'number', 'statistics.files must be number');
    assert.equal(typeof folders,   'number', 'statistics.folders must be number');
    assert.equal(typeof durationMs,'number', 'statistics.durationMs must be number');
    assert.ok(Number.isFinite(files),      'statistics.files must be finite');
    assert.ok(Number.isFinite(folders),    'statistics.folders must be finite');
    assert.ok(Number.isFinite(durationMs), 'statistics.durationMs must be finite');
    assert.equal(durationMs, Math.round(durationMs), 'statistics.durationMs must be an integer');
  });

  test('normal repo: statistics and summary contain identical numeric data', () => {
    const data = getJSON('.');
    assert.equal(data.statistics.files,     data.summary.totalFiles,     'files mismatch');
    assert.equal(data.statistics.folders,   data.summary.totalFolders,   'folders mismatch');
    assert.equal(data.statistics.durationMs,data.summary.scanDurationMs, 'duration mismatch');
  });

  test('normal repo: meta block has generatedBy, version, schema', () => {
    const data = getJSON('.');
    assert.equal(data.meta.generatedBy, 'Toren');
    assert.equal(typeof data.meta.version, 'string');
    assert.equal(data.meta.schema, 1);
  });

  test('normal repo: JSON.stringify output is valid JSON (no NaN/undefined)', () => {
    const res = runCLI('. --format json');
    assert.equal(res.status, 0);
    // JSON.parse throws on invalid JSON — this would catch NaN serialised as null incorrectly
    const parsed = JSON.parse(res.output);
    assert.ok(parsed, 'output must be parseable JSON');
    // Verify statistics durationMs is not null (NaN serialises as null)
    assert.notEqual(parsed.statistics.durationMs, null);
    assert.notEqual(parsed.summary.scanDurationMs, null);
  });

  // ── 2. Empty repository ───────────────────────────────────────────────────

  test('empty repo: all array fields are empty arrays (not null/undefined)', () => {
    const dir = makeDir({ 'README.md': '# empty\n' });
    after(() => fs.rmSync(dir, { recursive: true, force: true }));

    const data = getJSON(dir);
    assert.deepEqual(data.frameworks,  []);
    assert.deepEqual(data.scripts,     []);
    assert.equal(typeof data.project.type, 'string');
  });

  test('empty repo: statistics.files reflects actual file count', () => {
    const dir = makeDir({ 'README.md': '# test\n' });
    after(() => fs.rmSync(dir, { recursive: true, force: true }));

    const data = getJSON(dir);
    assert.equal(data.statistics.files,   1, 'should count README.md');
    assert.equal(data.statistics.folders, 0, 'no subdirectories');
    assert.ok(Number.isFinite(data.statistics.durationMs));
  });

  test('empty repo: structure is an array (empty or with root file nodes)', () => {
    const dir = makeDir({});
    after(() => fs.rmSync(dir, { recursive: true, force: true }));

    const data = getJSON(dir);
    assert.ok(Array.isArray(data.structure), 'structure must be an array');
  });

  // ── 3. Repository without package.json ───────────────────────────────────

  test('no package.json: scripts is empty array (never null)', () => {
    const dir = makeDir({ 'main.py': 'print("hello")\n', 'requirements.txt': 'flask\n' });
    after(() => fs.rmSync(dir, { recursive: true, force: true }));

    const data = getJSON(dir);
    assert.ok(Array.isArray(data.scripts), 'scripts must be array');
    assert.deepEqual(data.scripts, [],     'scripts must be empty for Python project');
  });

  test('no package.json: project.type is non-null string', () => {
    const dir = makeDir({ 'main.py': 'print("hello")\n' });
    after(() => fs.rmSync(dir, { recursive: true, force: true }));

    const data = getJSON(dir);
    assert.equal(typeof data.project.type, 'string');
    assert.notEqual(data.project.type, null);
  });

  // ── 4. Repository without frameworks (Unknown type) ───────────────────────

  test('no frameworks: frameworks is empty array (never null or absent)', () => {
    const dir = makeDir({ 'README.md': '# bare project\n' });
    after(() => fs.rmSync(dir, { recursive: true, force: true }));

    const data = getJSON(dir);
    assert.ok(Array.isArray(data.frameworks), 'frameworks must be array even when empty');
    assert.deepEqual(data.frameworks, []);
    assert.equal(data.project.type, 'Unknown');
  });

  test('no frameworks: property order still canonical', () => {
    const dir = makeDir({ 'README.md': '# test\n' });
    after(() => fs.rmSync(dir, { recursive: true, force: true }));

    const data = getJSON(dir);
    assert.deepEqual(Object.keys(data), PROPERTY_ORDER);
  });

  // ── 5. Repository with configs ────────────────────────────────────────────

  test('with configs: configs array contains matched config filenames', () => {
    const dir = makeDir({
      'package.json':  '{"name":"app","version":"1.0.0"}',
      'tsconfig.json': '{"compilerOptions":{}}',
      'vite.config.ts':'export default {}',
    });
    after(() => fs.rmSync(dir, { recursive: true, force: true }));

    const data = getJSON(dir);
    assert.ok(Array.isArray(data.configs), 'configs must be array');
    assert.ok(data.configs.length > 0,     'configs must be non-empty');
    // All items must be strings
    for (const c of data.configs) {
      assert.equal(typeof c, 'string', `config item must be string, got ${typeof c}`);
    }
    assert.ok(data.configs.includes('package.json'), 'package.json should be in configs');
  });

  // ── 6. Repository with scripts ────────────────────────────────────────────

  test('with scripts: each script item has string name and string command', () => {
    const dir = makeDir({
      'package.json': JSON.stringify({
        name: 'my-app',
        scripts: { start: 'node index.js', build: 'tsc', test: 'jest' },
      }),
      'index.js': 'console.log("hi")',
    });
    after(() => fs.rmSync(dir, { recursive: true, force: true }));

    const data = getJSON(dir);
    assert.ok(Array.isArray(data.scripts), 'scripts must be array');
    assert.ok(data.scripts.length > 0,     'scripts must be non-empty');

    for (const s of data.scripts) {
      assert.equal(typeof s.name,    'string', 'script.name must be string');
      assert.equal(typeof s.command, 'string', 'script.command must be string');
      assert.ok(s.name.length    > 0, 'script.name must not be empty');
      assert.ok(s.command.length > 0, 'script.command must not be empty');
    }
  });

  test('with scripts: script names include expected keys from package.json', () => {
    const dir = makeDir({
      'package.json': JSON.stringify({
        name: 'test-app',
        scripts: { start: 'node index.js', test: 'jest', build: 'tsc' },
      }),
      'index.js': 'module.exports = {}',
    });
    after(() => fs.rmSync(dir, { recursive: true, force: true }));

    const data = getJSON(dir);
    const scriptNames = data.scripts.map(s => s.name);
    assert.ok(scriptNames.includes('start'), 'should include "start" script');
    assert.ok(scriptNames.includes('test'),  'should include "test" script');
    assert.ok(scriptNames.includes('build'), 'should include "build" script');
  });

});
