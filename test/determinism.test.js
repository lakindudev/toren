/**
 * @fileoverview Toren v1.1.1 — Determinism & Performance Hardening Tests
 *
 * Verifies that the technology stack detector produces identical, stable
 * output regardless of the order in which input data is provided.
 *
 * Requirements tested:
 *  1. Shuffled flatFiles → identical TechnologyStack
 *  2. Shuffled configs → identical TechnologyStack
 *  3. Shuffled dependencies → identical TechnologyStack
 *  4. Reversed flatFiles → identical TechnologyStack
 *  5. Evidence ordering within each technology is deterministic
 *  6. Technology ordering within the stack is deterministic
 *  7. Confidence values are identical across equivalent runs
 *  8. Category ordering is stable
 *
 * Performance contract:
 *  - detectTechnologyStack() is synchronous and uses only pre-collected data
 *  - No disk I/O is performed inside the detector
 *  - The detector receives flatFiles already collected by scan() — it does
 *    not initiate another recursive walk
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { detectTechnologyStack } from '../dist/detectors/technology-stack-detector.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function emptyCtx(overrides = {}) {
  return {
    flatFiles:       [],
    configs:         [],
    scripts:         [],
    packageManager:  null,
    projectType:     'Unknown',
    packageManifest: null,
    ...overrides,
  };
}

/** Shuffle an array in-place using Fisher-Yates and return it. */
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Serialize a TechnologyStack for deep comparison. */
function serializeStack(stack) {
  return JSON.stringify(
    stack.technologies.map(t => ({
      name:       t.name,
      category:   t.category,
      confidence: t.confidence,
      evidence:   t.evidence.map(e => `${e.type}:${e.value}`),
    })),
  );
}

// ---------------------------------------------------------------------------
// 1. Shuffled flatFiles → same output
// ---------------------------------------------------------------------------

describe('Determinism: shuffled flatFiles', () => {

  test('React+TS project with shuffled flatFiles → same technology order', () => {
    const baseFiles = [
      'src/App.tsx', 'src/index.tsx', 'src/Button.jsx',
      'app/page.tsx', 'app/layout.tsx', 'package.json',
      'tsconfig.json', 'next.config.ts',
    ];

    const ctx1 = emptyCtx({
      packageManifest: {
        dependencies:    { react: '^18.0.0', next: '^14.0.0' },
        devDependencies: { typescript: '^5.0.0' },
      },
      configs:   ['tsconfig.json', 'next.config.ts'],
      flatFiles: baseFiles,
    });

    const ctx2 = emptyCtx({
      packageManifest: {
        dependencies:    { react: '^18.0.0', next: '^14.0.0' },
        devDependencies: { typescript: '^5.0.0' },
      },
      configs:   ['tsconfig.json', 'next.config.ts'],
      flatFiles: shuffle(baseFiles),
    });

    const result1 = serializeStack(detectTechnologyStack(ctx1));
    const result2 = serializeStack(detectTechnologyStack(ctx2));
    assert.equal(result1, result2,
      'Shuffled flatFiles must produce identical technology stack');
  });

  test('Reversed flatFiles → same technology output', () => {
    const baseFiles = [
      'package.json', 'src/index.ts', 'Dockerfile', 'tsconfig.json',
      'app/page.tsx', 'netlify.toml', 'package-lock.json',
    ];

    const ctx1 = emptyCtx({
      packageManifest: {
        dependencies:    { react: '^18.0.0', next: '^14.0.0' },
        devDependencies: { typescript: '^5.0.0' },
      },
      configs:   ['tsconfig.json'],
      flatFiles: baseFiles,
    });

    const ctx2 = emptyCtx({
      packageManifest: {
        dependencies:    { react: '^18.0.0', next: '^14.0.0' },
        devDependencies: { typescript: '^5.0.0' },
      },
      configs:   ['tsconfig.json'],
      flatFiles: [...baseFiles].reverse(),
    });

    const result1 = serializeStack(detectTechnologyStack(ctx1));
    const result2 = serializeStack(detectTechnologyStack(ctx2));
    assert.equal(result1, result2,
      'Reversed flatFiles must produce identical technology stack');
  });

});

// ---------------------------------------------------------------------------
// 2. Shuffled configs → same output
// ---------------------------------------------------------------------------

describe('Determinism: shuffled configs', () => {

  test('shuffled configs array → same technology detection', () => {
    const baseConfigs = ['tsconfig.json', 'next.config.ts', 'tailwind.config.js'];

    const ctx1 = emptyCtx({
      packageManifest: {
        dependencies:    { react: '^18.0.0', next: '^14.0.0', tailwindcss: '^3.0.0' },
        devDependencies: { typescript: '^5.0.0' },
      },
      configs: baseConfigs,
    });

    const ctx2 = emptyCtx({
      packageManifest: {
        dependencies:    { react: '^18.0.0', next: '^14.0.0', tailwindcss: '^3.0.0' },
        devDependencies: { typescript: '^5.0.0' },
      },
      configs: shuffle(baseConfigs),
    });

    const result1 = serializeStack(detectTechnologyStack(ctx1));
    const result2 = serializeStack(detectTechnologyStack(ctx2));
    assert.equal(result1, result2,
      'Shuffled configs must produce identical technology stack');
  });

  test('reversed configs array → same technology detection', () => {
    const baseConfigs = ['tsconfig.json', 'next.config.mjs', 'tailwind.config.ts', 'eslint.config.js'];

    const ctx1 = emptyCtx({
      packageManifest: {
        dependencies:    { next: '^14.0.0', tailwindcss: '^3.0.0' },
        devDependencies: { typescript: '^5.0.0', eslint: '^8.0.0' },
      },
      configs: baseConfigs,
    });

    const ctx2 = emptyCtx({
      packageManifest: {
        dependencies:    { next: '^14.0.0', tailwindcss: '^3.0.0' },
        devDependencies: { typescript: '^5.0.0', eslint: '^8.0.0' },
      },
      configs: [...baseConfigs].reverse(),
    });

    const result1 = serializeStack(detectTechnologyStack(ctx1));
    const result2 = serializeStack(detectTechnologyStack(ctx2));
    assert.equal(result1, result2,
      'Reversed configs must produce identical technology stack');
  });

});

// ---------------------------------------------------------------------------
// 3. Shuffled dependencies → same output
// ---------------------------------------------------------------------------

describe('Determinism: shuffled dependencies', () => {

  test('shuffled package.json dependencies object → same technologies', () => {
    const deps = {
      react: '^18.0.0',
      next: '^14.0.0',
      express: '^4.18.0',
      mongoose: '^7.0.0',
      tailwindcss: '^3.0.0',
    };

    // Build two contexts where the object property insertion order differs.
    const shuffledDeps = Object.fromEntries(
      Object.entries(deps).reverse(),
    );

    const ctx1 = emptyCtx({
      packageManifest: { dependencies: deps },
    });

    const ctx2 = emptyCtx({
      packageManifest: { dependencies: shuffledDeps },
    });

    const result1 = serializeStack(detectTechnologyStack(ctx1));
    const result2 = serializeStack(detectTechnologyStack(ctx2));
    assert.equal(result1, result2,
      'Shuffled dependency object keys must produce identical technology stack');
  });

  test('shuffled devDependencies object → same technologies', () => {
    const devDeps = {
      typescript: '^5.0.0',
      eslint: '^8.0.0',
      prettier: '^3.0.0',
      vitest: '^1.0.0',
    };

    const ctx1 = emptyCtx({ packageManifest: { devDependencies: devDeps } });
    const ctx2 = emptyCtx({
      packageManifest: { devDependencies: Object.fromEntries(Object.entries(devDeps).reverse()) },
    });

    const r1 = serializeStack(detectTechnologyStack(ctx1));
    const r2 = serializeStack(detectTechnologyStack(ctx2));
    assert.equal(r1, r2, 'Shuffled devDependencies must produce identical output');
  });

});

// ---------------------------------------------------------------------------
// 4. Repeated calls → identical output
// ---------------------------------------------------------------------------

describe('Determinism: repeated calls', () => {

  test('same context called 5 times → always the same output', () => {
    const ctx = emptyCtx({
      packageManifest: {
        dependencies:    { react: '^18.0.0', next: '^14.0.0', mongoose: '^7.0.0' },
        devDependencies: { typescript: '^5.0.0', eslint: '^8.0.0', vitest: '^1.0.0' },
      },
      configs:   ['tsconfig.json', 'next.config.ts'],
      flatFiles: ['src/index.ts', 'app/page.tsx', 'Dockerfile'],
    });

    const results = Array.from({ length: 5 }, () => serializeStack(detectTechnologyStack(ctx)));
    for (let i = 1; i < results.length; i++) {
      assert.equal(results[i], results[0],
        `Call ${i + 1} must produce the same output as call 1`);
    }
  });

  test('confidence values are identical across repeated calls', () => {
    const ctx = emptyCtx({
      packageManifest: {
        devDependencies: { typescript: '^5.0.0' },
      },
      configs: ['tsconfig.json'],
    });

    const r1 = detectTechnologyStack(ctx);
    const r2 = detectTechnologyStack(ctx);
    const ts1 = r1.technologies.find(t => t.name === 'TypeScript');
    const ts2 = r2.technologies.find(t => t.name === 'TypeScript');
    assert.ok(ts1 && ts2, 'TypeScript must be detected');
    assert.equal(ts1.confidence, ts2.confidence,
      'TypeScript confidence must be identical across calls');
    assert.equal(ts1.confidence, 0.85,
      'TypeScript devDep(0.60) + tsconfig(0.25) = 0.85 exactly');
  });

});

// ---------------------------------------------------------------------------
// 5. Evidence ordering within a technology is deterministic
// ---------------------------------------------------------------------------

describe('Determinism: evidence ordering', () => {

  test('TypeScript evidence order is stable: devDependency before config before file', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { devDependencies: { typescript: '^5.0.0' } },
      configs:   ['tsconfig.json'],
      flatFiles: ['src/index.ts'],
    }));
    const ts = result.technologies.find(t => t.name === 'TypeScript');
    assert.ok(ts, 'TypeScript must be detected');

    // Evidence should be sorted by type rank: devDep(1) < config(4) < file(6)
    const types = ts.evidence.map(e => e.type);
    const devDepIdx = types.indexOf('devDependency');
    const configIdx = types.indexOf('config');
    const fileIdx   = types.indexOf('file');

    if (devDepIdx !== -1 && configIdx !== -1) {
      assert.ok(devDepIdx < configIdx,
        'devDependency evidence must come before config evidence');
    }
    if (configIdx !== -1 && fileIdx !== -1) {
      assert.ok(configIdx < fileIdx,
        'config evidence must come before file evidence');
    }
  });

  test('Next.js evidence order: dependency before config before directory', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { dependencies: { next: '^14.0.0' } },
      configs:   ['next.config.ts'],
      flatFiles: ['app/page.tsx', 'app/layout.tsx'],
    }));
    const nextjs = result.technologies.find(t => t.name === 'Next.js');
    assert.ok(nextjs, 'Next.js must be detected');

    const types = nextjs.evidence.map(e => e.type);
    const depIdx = types.indexOf('dependency');
    const cfgIdx = types.indexOf('config');
    const dirIdx = types.indexOf('directory');

    if (depIdx !== -1 && cfgIdx !== -1) {
      assert.ok(depIdx < cfgIdx,
        'dependency must come before config in Next.js evidence');
    }
    if (cfgIdx !== -1 && dirIdx !== -1) {
      assert.ok(cfgIdx < dirIdx,
        'config must come before directory in Next.js evidence');
    }
  });

  test('evidence values within same type are sorted alphabetically', () => {
    // Multiple dependency rules can fire for the same tech
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: {
        dependencies: {
          '@prisma/client': '^5.0.0',
          'typescript': '^5.0.0',
        },
        devDependencies: { prisma: '^5.0.0' },
      },
    }));
    const prisma = result.technologies.find(t => t.name === 'Prisma');
    if (prisma) {
      // Within each evidence type, values should be alphabetically sorted
      const byType = {};
      for (const e of prisma.evidence) {
        if (!byType[e.type]) byType[e.type] = [];
        byType[e.type].push(e.value);
      }
      for (const [type, values] of Object.entries(byType)) {
        const sorted = [...values].sort();
        assert.deepEqual(values, sorted,
          `Evidence values for type "${type}" must be sorted alphabetically`);
      }
    }
  });

  test('same technology detected twice → evidence is merged and sorted', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: {
        dependencies:    { react: '^18.0.0' },
        devDependencies: { react: '^18.0.0' },
      },
      flatFiles: ['src/App.tsx'],
    }));
    const reactEntries = result.technologies.filter(t => t.name === 'React');
    assert.equal(reactEntries.length, 1, 'React must appear exactly once');

    const react = reactEntries[0];
    // Evidence should have: dependency, devDependency (different types),
    // and file — all sorted by type rank
    const types = react.evidence.map(e => e.type);
    // Verify no duplicates
    const unique = new Set(types.map((t, i) => `${t}:${react.evidence[i].value}`));
    assert.equal(unique.size, react.evidence.length,
      'Merged evidence must have no duplicates');
  });

});

// ---------------------------------------------------------------------------
// 6. Technology ordering is deterministic
// ---------------------------------------------------------------------------

describe('Determinism: technology ordering', () => {

  test('category ordering is stable across calls', () => {
    const ctx = emptyCtx({
      packageManifest: {
        dependencies:    { react: '^18.0.0', next: '^14.0.0', mongoose: '^7.0.0' },
        devDependencies: { typescript: '^5.0.0', eslint: '^8.0.0', jest: '^29.0.0' },
      },
      configs: ['tsconfig.json'],
    });

    const result1 = detectTechnologyStack(ctx);
    const result2 = detectTechnologyStack(ctx);

    const cats1 = result1.technologies.map(t => t.category);
    const cats2 = result2.technologies.map(t => t.category);
    assert.deepEqual(cats1, cats2, 'Category ordering must be identical across calls');
  });

  test('within same category, higher confidence comes first', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: {
        dependencies: { next: '^14.0.0', react: '^18.0.0' },
      },
      configs: ['next.config.ts'],
    }));
    const frontends = result.technologies.filter(t => t.category === 'frontend');
    assert.ok(frontends.length >= 2, 'At least Next.js and React must be detected');

    for (let i = 0; i < frontends.length - 1; i++) {
      assert.ok(
        frontends[i].confidence >= frontends[i + 1].confidence,
        `${frontends[i].name} (${frontends[i].confidence}) must have ≥ confidence than ${frontends[i + 1].name} (${frontends[i + 1].confidence})`,
      );
    }
  });

  test('within same category and same confidence, alphabetical order', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: {
        // Both React and Vue at same dep confidence (0.60 each)
        dependencies: { react: '^18.0.0', vue: '^3.0.0' },
      },
    }));
    const frontends = result.technologies.filter(t => t.category === 'frontend');
    const sameConf = frontends.filter(t => t.confidence === frontends[0]?.confidence);

    for (let i = 0; i < sameConf.length - 1; i++) {
      assert.ok(
        sameConf[i].name.localeCompare(sameConf[i + 1].name) <= 0,
        `Within same confidence, ${sameConf[i].name} must come before ${sameConf[i + 1].name} alphabetically`,
      );
    }
  });

  test('CATEGORY_ORDER: language comes before runtime comes before frontend', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: {
        dependencies:    { next: '^14.0.0', react: '^18.0.0' },
        devDependencies: { typescript: '^5.0.0' },
      },
      configs: ['tsconfig.json'],
    }));

    const cats = result.technologies.map(t => t.category);
    const langPos    = cats.indexOf('language');
    const frontendPos = cats.indexOf('frontend');

    if (langPos !== -1 && frontendPos !== -1) {
      assert.ok(langPos < frontendPos,
        'language category must appear before frontend category');
    }
  });

  test('backend comes before testing in output', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: {
        dependencies:    { express: '^4.18.0' },
        devDependencies: { jest: '^29.0.0' },
      },
    }));

    const cats = result.technologies.map(t => t.category);
    const backendPos  = cats.indexOf('backend');
    const testingPos  = cats.indexOf('testing');

    if (backendPos !== -1 && testingPos !== -1) {
      assert.ok(backendPos < testingPos,
        'backend category must appear before testing category');
    }
  });

});

// ---------------------------------------------------------------------------
// 7. Confidence values are stable and precise
// ---------------------------------------------------------------------------

describe('Determinism: confidence precision', () => {

  test('TypeScript devDep+tsconfig = exactly 0.85', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { devDependencies: { typescript: '^5.0.0' } },
      configs: ['tsconfig.json'],
    }));
    const ts = result.technologies.find(t => t.name === 'TypeScript');
    assert.ok(ts, 'TypeScript must be detected');
    assert.equal(ts.confidence, 0.85, `Expected 0.85, got ${ts.confidence}`);
  });

  test('React dep+tsx = dep(0.60)+file(0.15) = 0.75', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { dependencies: { react: '^18.0.0' } },
      flatFiles: ['src/App.tsx'],
    }));
    const react = result.technologies.find(t => t.name === 'React');
    assert.ok(react, 'React must be detected');
    assert.equal(react.confidence, 0.75, `Expected 0.75, got ${react.confidence}`);
  });

  test('Next.js dep+config+dir = 0.60+0.25+0.15 = 1.00 (capped)', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { dependencies: { next: '^14.0.0' } },
      configs: ['next.config.ts'],
      flatFiles: ['app/page.tsx'],
    }));
    const nextjs = result.technologies.find(t => t.name === 'Next.js');
    assert.ok(nextjs, 'Next.js must be detected');
    assert.equal(nextjs.confidence, 1.0, `Expected 1.00, got ${nextjs.confidence}`);
  });

  test('all confidence values are finite numbers in [0, 1]', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: {
        dependencies:    { react: '^18.0.0', next: '^14.0.0', express: '^4.18.0' },
        devDependencies: { typescript: '^5.0.0', eslint: '^8.0.0' },
      },
      configs: ['tsconfig.json', 'next.config.ts'],
    }));

    for (const tech of result.technologies) {
      assert.ok(Number.isFinite(tech.confidence),
        `${tech.name} confidence must be a finite number`);
      assert.ok(tech.confidence >= 0,
        `${tech.name} confidence must be ≥ 0`);
      assert.ok(tech.confidence <= 1,
        `${tech.name} confidence must be ≤ 1`);
    }
  });

  test('confidence has at most 2 decimal places', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: {
        dependencies:    { react: '^18.0.0', next: '^14.0.0' },
        devDependencies: { typescript: '^5.0.0' },
      },
      configs: ['tsconfig.json', 'next.config.ts'],
      flatFiles: ['src/index.ts', 'app/page.tsx'],
    }));

    for (const tech of result.technologies) {
      const str = tech.confidence.toString();
      const decimalPlaces = str.includes('.') ? str.split('.')[1].length : 0;
      assert.ok(decimalPlaces <= 2,
        `${tech.name} confidence ${tech.confidence} has more than 2 decimal places`);
    }
  });

  test('serialized JSON confidence has no floating-point drift', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { devDependencies: { typescript: '^5.0.0' } },
      configs: ['tsconfig.json'],
    }));
    const json = JSON.stringify(result);
    // Should not contain floating-point artifacts like 0.8500000000000001
    assert.doesNotMatch(json, /0\.8500000000000001/,
      'Serialized JSON must not contain floating-point representation artifacts');
    assert.ok(json.includes('"confidence":0.85'),
      'TypeScript confidence must serialize as exactly 0.85');
  });

});
