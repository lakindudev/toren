import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
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
    assert.match(res.output, /Project Structure\n─────────────────/);
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
