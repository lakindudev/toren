/**
 * @fileoverview Unit and integration tests for generateStackSummary() (v1.1.2)
 *
 * Covers:
 *  - complete stack (full-stack with language, frontend, backend, styling, data, testing)
 *  - frontend-only project (web application headline)
 *  - backend-only project (server application headline)
 *  - minimal project (language only, gracefully degrades)
 *  - unknown / empty project (no headline, empty arrays)
 *  - missing optional categories (no styling, no data, no testing)
 *  - deterministic output across repeated calls
 *  - scan() integration ensuring scanResult.stackSummary is present
 */

import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { generateStackSummary } from '../dist/detectors/stack-summary.js';
import { scan } from '../dist/scanner/scan.js';

function tech(name, category = 'other') {
  return {
    name,
    category,
    confidence: 1.0,
    evidence: [{ type: 'dependency', value: name.toLowerCase() }],
  };
}

const tempDirs = [];
function makeDir(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'toren-summary-test-'));
  tempDirs.push(dir);
  for (const [name, content] of Object.entries(files)) {
    const fullPath = path.join(dir, name);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content);
  }
  return dir;
}

after(() => {
  for (const dir of tempDirs) {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
  }
});

describe('generateStackSummary unit tests', () => {

  test('complete stack: full-stack web application with all categories', () => {
    const stack = {
      technologies: [
        tech('TypeScript', 'language'),
        tech('Next.js', 'frontend'),
        tech('React', 'frontend'),
        tech('Express', 'backend'),
        tech('Tailwind CSS', 'styling'),
        tech('Prisma', 'orm'),
        tech('PostgreSQL', 'database'),
        tech('Vitest', 'testing'),
      ],
      relationships: [],
    };

    const summary = generateStackSummary(stack);

    assert.equal(summary.headline, 'TypeScript full-stack web application');
    assert.deepEqual(summary.frameworks, ['Next.js', 'React', 'Express']);
    assert.deepEqual(summary.styling, ['Tailwind CSS']);
    assert.deepEqual(summary.data, ['Prisma', 'PostgreSQL']);
    assert.deepEqual(summary.testing, ['Vitest']);
  });

  test('frontend-only project: web application headline', () => {
    const stack = {
      technologies: [
        tech('TypeScript', 'language'),
        tech('React', 'frontend'),
        tech('Tailwind CSS', 'styling'),
      ],
      relationships: [],
    };

    const summary = generateStackSummary(stack);

    assert.equal(summary.headline, 'TypeScript web application');
    assert.deepEqual(summary.frameworks, ['React']);
    assert.deepEqual(summary.styling, ['Tailwind CSS']);
    assert.deepEqual(summary.data, []);
    assert.deepEqual(summary.testing, []);
  });

  test('backend-only project: server application headline', () => {
    const stack = {
      technologies: [
        tech('TypeScript', 'language'),
        tech('NestJS', 'backend'),
        tech('PostgreSQL', 'database'),
      ],
      relationships: [],
    };

    const summary = generateStackSummary(stack);

    assert.equal(summary.headline, 'TypeScript server application');
    assert.deepEqual(summary.frameworks, ['NestJS']);
    assert.deepEqual(summary.styling, []);
    assert.deepEqual(summary.data, ['PostgreSQL']);
    assert.deepEqual(summary.testing, []);
  });

  test('minimal project: language only, graceful degradation', () => {
    const stack = {
      technologies: [
        tech('TypeScript', 'language'),
      ],
      relationships: [],
    };

    const summary = generateStackSummary(stack);

    // Language only: degrades gracefully, does NOT invent "TypeScript full-stack application"
    assert.equal(summary.headline, 'TypeScript application');
    assert.deepEqual(summary.frameworks, []);
    assert.deepEqual(summary.styling, []);
    assert.deepEqual(summary.data, []);
    assert.deepEqual(summary.testing, []);
  });

  test('unknown / empty project: no headline, all arrays empty', () => {
    const stack = {
      technologies: [],
      relationships: [],
    };

    const summary = generateStackSummary(stack);

    assert.equal(summary.headline, undefined);
    assert.deepEqual(summary.frameworks, []);
    assert.deepEqual(summary.styling, []);
    assert.deepEqual(summary.data, []);
    assert.deepEqual(summary.testing, []);
  });

  test('missing optional categories: styling, data, testing omitted when absent', () => {
    const stack = {
      technologies: [
        tech('JavaScript', 'language'),
        tech('Vue', 'frontend'),
      ],
      relationships: [],
    };

    const summary = generateStackSummary(stack);

    assert.equal(summary.headline, 'JavaScript web application');
    assert.deepEqual(summary.frameworks, ['Vue']);
    assert.deepEqual(summary.styling, []);
    assert.deepEqual(summary.data, []);
    assert.deepEqual(summary.testing, []);
  });

  test('deterministic output across multiple calls', () => {
    const stack = {
      technologies: [
        tech('TypeScript', 'language'),
        tech('Next.js', 'frontend'),
        tech('Tailwind CSS', 'styling'),
        tech('PostgreSQL', 'database'),
      ],
      relationships: [],
    };

    const res1 = generateStackSummary(stack);
    const res2 = generateStackSummary(stack);

    assert.deepEqual(res1, res2);
  });

  test('scan() integrates stackSummary properly', async () => {
    const dir = makeDir({
      'package.json': JSON.stringify({
        name: 'test-summary-app',
        version: '1.0.0',
        dependencies: { next: '^14.0.0', react: '^18.0.0' },
        devDependencies: { typescript: '^5.0.0' },
      }),
      'tsconfig.json': '{}',
    });

    const result = await scan(dir);

    assert.ok('stackSummary' in result);
    assert.ok(result.stackSummary.headline?.includes('web application'));
    assert.ok(result.stackSummary.frameworks.includes('Next.js'));
    assert.ok(result.stackSummary.frameworks.includes('React'));
  });

});
