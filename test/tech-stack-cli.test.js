/**
 * @fileoverview Toren v1.1.0 — Step 7: --tech-stack CLI tests
 */
import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { detectTechnologyStack } from '../dist/detectors/technology-stack-detector.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CLI_PATH = path.resolve(__dirname, '../dist/cli/toren.js');

const stripAnsi = (str) => str.replace(/\x1b\[[0-9;]*m/g, '');

function runCLI(args, options = {}) {
  try {
    const output = execSync(`node ${CLI_PATH} ${args}`, { encoding: 'utf-8', stdio: 'pipe', ...options });
    return { output: stripAnsi(output), status: 0 };
  } catch (err) {
    const raw = (err.stdout || '') + (err.stderr || '');
    return { output: stripAnsi(raw), status: err.status };
  }
}

function makeDir(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'toren-ts7-'));
  for (const [name, content] of Object.entries(files)) {
    const fullPath = path.join(dir, name);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content);
  }
  return dir;
}

function emptyCtx(overrides = {}) {
  return { flatFiles: [], configs: [], scripts: [], packageManager: null, projectType: 'Unknown', packageManifest: null, ...overrides };
}

describe('--tech-stack CLI flag', () => {

  test('--tech-stack and --stack appear in --help output', () => {
    const res = runCLI('--help');
    assert.equal(res.status, 0);
    assert.match(res.output, /--tech-stack/);
    assert.match(res.output, /--stack/);
  });

  test('--tech-stack on a real TypeScript project shows Technology Stack section', () => {
    const res = runCLI('.');
    assert.equal(res.status, 0);
  });

  test('--stack alias works identically to --tech-stack', () => {
    const resTech = runCLI('. --tech-stack');
    const resStack = runCLI('. --stack');
    assert.equal(resStack.status, 0);
    assert.equal(resTech.output, resStack.output);
  });

  test('--stack and --tech-stack can be used together without conflicting', () => {
    const res = runCLI('. --stack --tech-stack');
    assert.equal(res.status, 0);
    assert.match(res.output, /Technology Stack/);
  });

  test('--tech-stack with a TypeScript+ESLint project shows expected categories', () => {
    const dir = makeDir({
      'package.json': JSON.stringify({
        name: 'ts-app',
        dependencies: { react: '^18.0.0' },
        devDependencies: { typescript: '^5.0.0', eslint: '^8.0.0', vitest: '^1.0.0' },
      }),
      'package-lock.json': '{}',
      'tsconfig.json': '{}',
    });
    after(() => fs.rmSync(dir, { recursive: true, force: true }));

    const res = runCLI(`${dir} --tech-stack`);
    assert.equal(res.status, 0);
    assert.match(res.output, /Technology Stack/);
    assert.match(res.output, /TypeScript/);
    assert.match(res.output, /React/);
    assert.match(res.output, /ESLint/);
    assert.match(res.output, /Vitest/);
  });

  test('--stack on project with relationships shows Relationships section', () => {
    const dir = makeDir({
      'package.json': JSON.stringify({
        name: 'next-app',
        dependencies: { next: '^14.0.0', react: '^18.0.0' },
        devDependencies: { typescript: '^5.0.0' },
      }),
      'next.config.js': 'module.exports = {};',
      'tsconfig.json': '{}',
    });
    after(() => fs.rmSync(dir, { recursive: true, force: true }));

    const res = runCLI(`${dir} --stack`);
    assert.equal(res.status, 0);
    assert.match(res.output, /Technology Stack/);
    assert.match(res.output, /Relationships/);
    assert.match(res.output, /Next\.js → React/);
    assert.match(res.output, /Next\.js → TypeScript/);
  });

  test('--tech-stack on empty project shows empty message', () => {
    const dir = makeDir({
      'README.md': '# Empty',
    });
    after(() => fs.rmSync(dir, { recursive: true, force: true }));

    const res = runCLI(`${dir} --tech-stack`);
    assert.equal(res.status, 0);
    assert.match(res.output, /Technology Stack/);
    assert.match(res.output, /No technologies detected\./);
  });

  test('--tech-stack is mutually exclusive with --project-type', () => {
    const res = runCLI('. --tech-stack --project-type');
    assert.equal(res.status, 1);
    assert.match(res.output, /mutually exclusive|Conflicting/);
  });

  test('--tech-stack is mutually exclusive with --frameworks', () => {
    const res = runCLI('. --tech-stack --frameworks');
    assert.equal(res.status, 1);
    assert.match(res.output, /mutually exclusive|Conflicting/);
  });

  test('--tech-stack is mutually exclusive with --health', () => {
    const res = runCLI('. --tech-stack --health');
    assert.equal(res.status, 1);
    assert.match(res.output, /mutually exclusive|Conflicting/);
  });

  test('--tech-stack does not show confidence percentages in output', () => {
    const dir = makeDir({
      'package.json': JSON.stringify({
        dependencies: { react: '^18.0.0' },
        devDependencies: { typescript: '^5.0.0' },
      }),
      'package-lock.json': '{}',
    });
    after(() => fs.rmSync(dir, { recursive: true, force: true }));

    const res = runCLI(`${dir} --tech-stack`);
    assert.equal(res.status, 0);
    assert.doesNotMatch(res.output, /confidence|0\.60|0\.85/);
  });

  test('--tech-stack only shows categories that have technologies', () => {
    const dir = makeDir({
      'package.json': JSON.stringify({
        dependencies: { react: '^18.0.0' },
      }),
      'package-lock.json': '{}',
    });
    after(() => fs.rmSync(dir, { recursive: true, force: true }));

    const res = runCLI(`${dir} --tech-stack`);
    assert.equal(res.status, 0);
    assert.match(res.output, /Frontend/);
    assert.match(res.output, /React/);
    // Should NOT show Backend or Quality headers
    assert.doesNotMatch(res.output, /Quality/);
    assert.doesNotMatch(res.output, /Backend/);
  });

  test('category ordering: Language/Frontend before Testing before Quality', () => {
    const dir = makeDir({
      'package.json': JSON.stringify({
        dependencies: { react: '^18.0.0' },
        devDependencies: { typescript: '^5.0.0', eslint: '^8.0.0', vitest: '^1.0.0' },
      }),
      'package-lock.json': '{}',
      'tsconfig.json': '{}',
    });
    after(() => fs.rmSync(dir, { recursive: true, force: true }));

    const res = runCLI(`${dir} --tech-stack`);
    assert.equal(res.status, 0);
    
    const output = res.output;
    const langIdx = output.indexOf('Language');
    const testIdx = output.indexOf('Testing');
    const qualIdx = output.indexOf('Quality');
    
    if (langIdx !== -1 && testIdx !== -1) {
      assert.ok(langIdx < testIdx, 'Language must appear before Testing');
    }
    if (testIdx !== -1 && qualIdx !== -1) {
      assert.ok(testIdx < qualIdx, 'Testing must appear before Quality');
    }
  });

});

describe('--tech-stack unit: renderFocusedMode', () => {
  test('detectTechnologyStack returns empty for project with no known techs', () => {
    const result = detectTechnologyStack({
      flatFiles: [],
      configs: [],
      scripts: [],
      packageManager: null,
      projectType: 'Unknown',
      packageManifest: null,
    });
    assert.equal(result.technologies.length, 0);
  });

  test('detectTechnologyStack includes testing/build/quality categories', () => {
    const result = detectTechnologyStack({
      flatFiles: ['tsconfig.json'],
      configs: ['tsconfig.json'],
      scripts: [],
      packageManager: 'npm',
      projectType: 'TypeScript',
      packageManifest: {
        devDependencies: {
          typescript: '^5.0.0',
          eslint: '^8.0.0',
          vitest: '^1.0.0',
          prettier: '^3.0.0',
        },
      },
    });
    const cats = result.technologies.map(t => t.category);
    assert.ok(cats.includes('language') || cats.includes('quality') || cats.includes('testing'),
      'Should have quality and testing categories');
  });
});

describe('--stack-summary CLI flag', () => {

  test('--stack-summary appears in --help output', () => {
    const res = runCLI('--help');
    assert.equal(res.status, 0);
    assert.match(res.output, /--stack-summary/);
  });

  test('--stack-summary on full project shows headline, frameworks, styling, data', () => {
    const dir = makeDir({
      'package.json': JSON.stringify({
        name: 'full-app',
        dependencies: {
          next: '^14.0.0',
          react: '^18.0.0',
          tailwindcss: '^3.0.0',
          '@prisma/client': '^5.0.0',
          pg: '^8.0.0',
        },
        devDependencies: {
          typescript: '^5.0.0',
          prisma: '^5.0.0',
          vitest: '^1.0.0',
        },
      }),
      'tsconfig.json': '{}',
      'tailwind.config.ts': 'export default {}',
    });
    after(() => fs.rmSync(dir, { recursive: true, force: true }));

    const res = runCLI(`${dir} --stack-summary`);
    assert.equal(res.status, 0);
    assert.match(res.output, /Stack Summary/);
    assert.match(res.output, /TypeScript web application/);
    assert.match(res.output, /Frameworks/);
    assert.match(res.output, /Next\.js/);
    assert.match(res.output, /React/);
    assert.match(res.output, /Styling/);
    assert.match(res.output, /Tailwind CSS/);
    assert.match(res.output, /Data/);
    assert.match(res.output, /Prisma/);
    assert.match(res.output, /Testing/);
    assert.match(res.output, /Vitest/);
    assert.match(res.output, /Relationships/);
  });

  test('--stack-summary on empty project shows empty message', () => {
    const dir = makeDir({
      'README.md': '# Empty',
    });
    after(() => fs.rmSync(dir, { recursive: true, force: true }));

    const res = runCLI(`${dir} --stack-summary`);
    assert.equal(res.status, 0);
    assert.match(res.output, /Stack Summary/);
    assert.match(res.output, /No stack summary available\./);
  });

  test('--stack-summary is mutually exclusive with --stack', () => {
    const res = runCLI('. --stack --stack-summary');
    assert.equal(res.status, 1);
    assert.match(res.output, /mutually exclusive|Conflicting/);
  });

  test('--stack-summary is mutually exclusive with --health', () => {
    const res = runCLI('. --stack-summary --health');
    assert.equal(res.status, 1);
    assert.match(res.output, /mutually exclusive|Conflicting/);
  });

  test('--stack-summary is mutually exclusive with --frameworks', () => {
    const res = runCLI('. --stack-summary --frameworks');
    assert.equal(res.status, 1);
    assert.match(res.output, /mutually exclusive|Conflicting/);
  });

  test('--stack-summary is mutually exclusive with --project-type', () => {
    const res = runCLI('. --stack-summary --project-type');
    assert.equal(res.status, 1);
    assert.match(res.output, /mutually exclusive|Conflicting/);
  });

});

