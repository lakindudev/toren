/**
 * @fileoverview Toren v1.1.1 — False-Positive Regression Suite
 *
 * This is one of the most important test files in the v1.1.1 release.
 *
 * Every test case verifies that a plausible but INSUFFICIENT signal does NOT
 * produce a false technology detection. Where practical, the corresponding
 * true-positive case is also included.
 *
 * Cases covered:
 *  1.  react/ directory only        → NOT React
 *  2.  React dep present            → React (true positive)
 *  3.  next/ directory only         → NOT Next.js
 *  4.  Next dep present             → Next.js (true positive)
 *  5.  README.md only               → No technologies
 *  6.  redis/ directory only        → NOT Redis
 *  7.  Redis dep present            → Redis (true positive)
 *  8.  docker/ directory only       → NOT Docker
 *  9.  Dockerfile present           → Docker (true positive)
 * 10.  tests/ directory only        → NOT Jest / Vitest / Mocha
 * 11.  Jest dep present             → Jest (true positive)
 * 12.  prisma/ directory only       → NOT Prisma
 * 13.  prisma/schema.prisma present → Prisma (true positive)
 * 14.  tailwind-example.css only    → NOT Tailwind CSS
 * 15.  Tailwind dep present         → Tailwind CSS (true positive)
 * 16.  Vercel README mention        → NOT Vercel
 * 17.  vercel.json present          → Vercel (true positive)
 * 18.  custom-react-helper dep      → NOT React
 * 19.  redis-utils dep              → NOT Redis
 * 20.  next-settings.json file      → NOT Next.js
 * 21.  fixtures/example-react/      → NOT React (nested fixture)
 * 22.  Minimal repo                 → No invented technologies
 * 23.  *.tsx without react dep      → NOT React
 * 24.  jsconfig.json only           → NOT JavaScript
 * 25.  tsconfig.json only           → NOT TypeScript
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

/** Find a technology by name in results. */
const find = (result, name) => result.technologies.find(t => t.name === name);
const findCat = (result, cat) => result.technologies.find(t => t.category === cat);

// ===========================================================================
// CASE 1 & 2: React — directory vs. dependency
// ===========================================================================

describe('False positive: React', () => {

  test('Case 1: react/ directory alone does NOT detect React', () => {
    const result = detectTechnologyStack(emptyCtx({
      flatFiles: ['react/index.js', 'react/utils.js'],
    }));
    assert.equal(find(result, 'React'), undefined,
      'react/ directory alone must NOT trigger React detection');
  });

  test('Case 1b: react/ directory in examples/ alone does NOT detect React', () => {
    const result = detectTechnologyStack(emptyCtx({
      flatFiles: ['examples/react/index.js', 'examples/react/package.json'],
    }));
    assert.equal(find(result, 'React'), undefined,
      'examples/react/ alone must NOT detect React');
  });

  test('Case 2 (true positive): react dependency → React detected', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { dependencies: { react: '^18.0.0' } },
    }));
    assert.ok(find(result, 'React'), 'react dependency must detect React');
  });

  test('Case 2b (true positive): react devDependency → React detected', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { devDependencies: { react: '^18.0.0' } },
    }));
    assert.ok(find(result, 'React'), 'react devDependency must detect React');
  });

  test('*.tsx files without react dependency → NOT React', () => {
    // tsx files are file evidence (0.15) — below threshold without dep
    const result = detectTechnologyStack(emptyCtx({
      flatFiles: ['src/App.tsx', 'src/Button.tsx', 'src/Page.tsx'],
    }));
    assert.equal(find(result, 'React'), undefined,
      '*.tsx files alone (0.15) must NOT detect React without a dependency');
  });

  test('*.jsx files without react dependency → NOT React', () => {
    const result = detectTechnologyStack(emptyCtx({
      flatFiles: ['src/App.jsx', 'src/Button.jsx'],
    }));
    assert.equal(find(result, 'React'), undefined,
      '*.jsx files alone must NOT detect React');
  });

  test('custom-react-helper dependency → NOT React (Case 18)', () => {
    // Exact package name lookup: 'react' must not match 'custom-react-helper'
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { dependencies: { 'custom-react-helper': '^1.0.0' } },
    }));
    assert.equal(find(result, 'React'), undefined,
      'custom-react-helper dep must NOT detect React (partial name match)');
  });

  test('react-query dep alone → NOT React', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { dependencies: { '@tanstack/react-query': '^5.0.0' } },
    }));
    assert.equal(find(result, 'React'), undefined,
      '@tanstack/react-query alone must NOT detect React');
  });

});

// ===========================================================================
// CASE 3 & 4: Next.js — directory vs. dependency
// ===========================================================================

describe('False positive: Next.js', () => {

  test('Case 3: next/ directory alone does NOT detect Next.js', () => {
    const result = detectTechnologyStack(emptyCtx({
      flatFiles: ['next/utils.js', 'next/types.ts'],
    }));
    assert.equal(find(result, 'Next.js'), undefined,
      'next/ directory alone must NOT trigger Next.js detection');
  });

  test('Case 4 (true positive): next dependency → Next.js detected', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { dependencies: { next: '^14.0.0' } },
    }));
    assert.ok(find(result, 'Next.js'), 'next dependency must detect Next.js');
  });

  test('next.config.ts alone (0.25) → NOT Next.js (below threshold)', () => {
    // Config alone = 0.25 < 0.60 AND no strong evidence → doubly suppressed
    const result = detectTechnologyStack(emptyCtx({
      configs: ['next.config.ts'],
    }));
    assert.equal(find(result, 'Next.js'), undefined,
      'next.config.ts alone must NOT detect Next.js (config=0.25 < threshold)');
  });

  test('next-settings.json file only → NOT Next.js (Case 20)', () => {
    // A file named next-settings.json does not match the next.config.* pattern
    const result = detectTechnologyStack(emptyCtx({
      flatFiles: ['next-settings.json'],
    }));
    assert.equal(find(result, 'Next.js'), undefined,
      'next-settings.json must NOT detect Next.js');
  });

  test('app/ + pages/ directories without next dep → NOT Next.js', () => {
    // directory evidence = 0.15 < threshold, and no strong evidence
    const result = detectTechnologyStack(emptyCtx({
      flatFiles: ['app/page.tsx', 'pages/index.tsx'],
    }));
    assert.equal(find(result, 'Next.js'), undefined,
      'app/ + pages/ directories alone must NOT detect Next.js');
  });

  test('Next.js alone does NOT imply Vercel', () => {
    // Vercel must only be detected from vercel.json, not from Next.js
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { dependencies: { next: '^14.0.0' } },
    }));
    assert.ok(find(result, 'Next.js'), 'Next.js must be detected');
    assert.equal(find(result, 'Vercel'), undefined,
      'Next.js alone must NOT imply Vercel');
  });

});

// ===========================================================================
// CASE 5: README only → no technologies
// ===========================================================================

describe('False positive: README-only repository', () => {

  test('Case 5: README.md only → empty technology stack', () => {
    const result = detectTechnologyStack(emptyCtx({
      flatFiles: ['README.md'],
    }));
    assert.equal(result.technologies.length, 0,
      'README.md alone must produce no detected technologies');
  });

  test('README.md mentioning Next.js → NOT Next.js (Case 3)', () => {
    // README text is never parsed — only file presence matters
    const result = detectTechnologyStack(emptyCtx({
      flatFiles: ['README.md'],
    }));
    assert.equal(find(result, 'Next.js'), undefined,
      'README mention alone must not detect Next.js');
  });

  test('README.md mentioning Vercel → NOT Vercel (Case 16)', () => {
    const result = detectTechnologyStack(emptyCtx({
      flatFiles: ['README.md'],
    }));
    assert.equal(find(result, 'Vercel'), undefined,
      'README mention alone must not detect Vercel');
  });

});

// ===========================================================================
// CASE 6 & 7: Redis — directory vs. dependency
// ===========================================================================

describe('False positive: Redis', () => {

  test('Case 6: redis/ directory alone does NOT detect Redis', () => {
    const result = detectTechnologyStack(emptyCtx({
      flatFiles: ['redis/cache.js', 'redis/client.js'],
    }));
    assert.equal(find(result, 'Redis'), undefined,
      'redis/ directory alone must NOT trigger Redis detection');
  });

  test('Case 7 (true positive): redis dependency → Redis detected', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { dependencies: { redis: '^4.0.0' } },
    }));
    assert.ok(find(result, 'Redis'), 'redis dependency must detect Redis');
  });

  test('Case 7b (true positive): ioredis dependency → Redis detected', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { dependencies: { ioredis: '^5.0.0' } },
    }));
    assert.ok(find(result, 'Redis'), 'ioredis dependency must detect Redis');
  });

  test('Case 19: redis-utils dep does NOT detect Redis', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { dependencies: { 'redis-utils': '^1.0.0' } },
    }));
    assert.equal(find(result, 'Redis'), undefined,
      'redis-utils dep must NOT detect Redis (not an exact match)');
  });

});

// ===========================================================================
// CASE 8 & 9: Docker — directory vs. Dockerfile
// ===========================================================================

describe('False positive: Docker', () => {

  test('Case 8: docker/ directory alone does NOT detect Docker', () => {
    const result = detectTechnologyStack(emptyCtx({
      flatFiles: ['docker/start.sh', 'docker/config.yml'],
    }));
    assert.equal(find(result, 'Docker'), undefined,
      'docker/ directory alone must NOT detect Docker');
  });

  test('Case 9 (true positive): Dockerfile at root → Docker detected', () => {
    const result = detectTechnologyStack(emptyCtx({
      flatFiles: ['Dockerfile', 'src/index.ts'],
    }));
    assert.ok(find(result, 'Docker'), 'Dockerfile must detect Docker');
  });

  test('Case 9b (true positive): docker-compose.yml → Docker Compose detected', () => {
    const result = detectTechnologyStack(emptyCtx({
      flatFiles: ['docker-compose.yml'],
    }));
    assert.ok(find(result, 'Docker Compose'), 'docker-compose.yml must detect Docker Compose');
  });

  test('compose.yml → Docker Compose detected', () => {
    const result = detectTechnologyStack(emptyCtx({
      flatFiles: ['compose.yml'],
    }));
    assert.ok(find(result, 'Docker Compose'), 'compose.yml must detect Docker Compose');
  });

});

// ===========================================================================
// CASE 10 & 11: Testing directories vs. framework deps
// ===========================================================================

describe('False positive: Testing tools', () => {

  test('Case 10: tests/ directory alone → NOT Jest', () => {
    const result = detectTechnologyStack(emptyCtx({
      flatFiles: ['tests/index.js', 'tests/utils.js'],
    }));
    assert.equal(find(result, 'Jest'), undefined,
      'tests/ directory alone must NOT detect Jest');
  });

  test('Case 10b: test/ directory alone → NOT Vitest', () => {
    const result = detectTechnologyStack(emptyCtx({
      flatFiles: ['test/index.js'],
    }));
    assert.equal(find(result, 'Vitest'), undefined,
      'test/ directory alone must NOT detect Vitest');
  });

  test('Case 10c: test/ directory alone → NOT Mocha', () => {
    const result = detectTechnologyStack(emptyCtx({
      flatFiles: ['test/index.js'],
    }));
    assert.equal(find(result, 'Mocha'), undefined,
      'test/ directory alone must NOT detect Mocha');
  });

  test('tests/ directory alone → no testing framework detected at all', () => {
    const result = detectTechnologyStack(emptyCtx({
      flatFiles: ['tests/app.test.js', 'tests/utils.test.js'],
    }));
    const testingTech = result.technologies.find(t => t.category === 'testing');
    assert.equal(testingTech, undefined,
      'tests/ directory alone must not detect any testing framework');
  });

  test('Case 11 (true positive): jest devDep → Jest detected', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { devDependencies: { jest: '^29.0.0' } },
    }));
    assert.ok(find(result, 'Jest'), 'jest devDependency must detect Jest');
  });

  test('Case 11b (true positive): vitest devDep → Vitest detected', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { devDependencies: { vitest: '^1.0.0' } },
    }));
    assert.ok(find(result, 'Vitest'), 'vitest devDependency must detect Vitest');
  });

  test('Case 11c (true positive): mocha devDep → Mocha detected', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { devDependencies: { mocha: '^10.0.0' } },
    }));
    assert.ok(find(result, 'Mocha'), 'mocha devDependency must detect Mocha');
  });

});

// ===========================================================================
// CASE 12 & 13: Prisma — directory vs. schema + dep
// ===========================================================================

describe('False positive: Prisma', () => {

  test('Case 12: prisma/ directory only → NOT Prisma', () => {
    // prisma/ directory does not match any Prisma detection rules
    // (rules only match prisma/schema.prisma and specific deps)
    const result = detectTechnologyStack(emptyCtx({
      flatFiles: ['prisma/migrations/001.sql', 'prisma/seed.ts'],
    }));
    assert.equal(find(result, 'Prisma'), undefined,
      'prisma/ directory without schema.prisma or deps must NOT detect Prisma');
  });

  test('Case 13 (true positive): @prisma/client dep → Prisma detected', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { dependencies: { '@prisma/client': '^5.0.0' } },
    }));
    assert.ok(find(result, 'Prisma'), '@prisma/client dep must detect Prisma');
  });

  test('Case 13b (true positive): prisma devDep → Prisma detected', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { devDependencies: { prisma: '^5.0.0' } },
    }));
    assert.ok(find(result, 'Prisma'), 'prisma devDependency must detect Prisma');
  });

  test('prisma/schema.prisma with @prisma/client dep → Prisma detected with file evidence', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { dependencies: { '@prisma/client': '^5.0.0' } },
      flatFiles: ['prisma/schema.prisma'],
    }));
    const tech = find(result, 'Prisma');
    assert.ok(tech, 'Prisma must be detected with dep + schema file');
    assert.ok(tech.evidence.some(e => e.type === 'dependency' && e.value === '@prisma/client'),
      'dependency evidence must be present');
    assert.ok(tech.evidence.some(e => e.type === 'file' && e.value === 'prisma/schema.prisma'),
      'file evidence must be present for schema.prisma');
  });

});

// ===========================================================================
// CASE 14 & 15: Tailwind CSS — CSS file vs. dependency
// ===========================================================================

describe('False positive: Tailwind CSS', () => {

  test('Case 14: tailwind-example.css file only → NOT Tailwind CSS', () => {
    const result = detectTechnologyStack(emptyCtx({
      flatFiles: ['styles/tailwind-example.css', 'styles/base.css'],
    }));
    assert.equal(find(result, 'Tailwind CSS'), undefined,
      'CSS files named tailwind-*.css must NOT detect Tailwind CSS');
  });

  test('styles.css with tailwind-related content → NOT Tailwind CSS', () => {
    // Content is never read — only file presence and deps matter
    const result = detectTechnologyStack(emptyCtx({
      flatFiles: ['src/styles.css'],
    }));
    assert.equal(find(result, 'Tailwind CSS'), undefined,
      'Generic CSS file alone must NOT detect Tailwind CSS');
  });

  test('Case 15 (true positive): tailwindcss dep → Tailwind CSS detected', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { dependencies: { tailwindcss: '^3.0.0' } },
    }));
    assert.ok(find(result, 'Tailwind CSS'), 'tailwindcss dep must detect Tailwind CSS');
  });

  test('Case 15b (true positive): tailwindcss devDep → Tailwind CSS detected', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { devDependencies: { tailwindcss: '^3.0.0' } },
    }));
    assert.ok(find(result, 'Tailwind CSS'), 'tailwindcss devDep must detect Tailwind CSS');
  });

  test('tailwind.config.ts alone → NOT Tailwind CSS (config=0.25 < threshold, no strong ev)', () => {
    const result = detectTechnologyStack(emptyCtx({
      configs: ['tailwind.config.ts'],
    }));
    assert.equal(find(result, 'Tailwind CSS'), undefined,
      'tailwind.config.ts alone must not detect Tailwind CSS (config < threshold + no strong evidence)');
  });

});

// ===========================================================================
// CASE 16 & 17: Vercel — README vs. vercel.json
// ===========================================================================

describe('False positive: Vercel', () => {

  test('Case 16: README mentions Vercel → NOT Vercel', () => {
    // README content is never parsed
    const result = detectTechnologyStack(emptyCtx({
      flatFiles: ['README.md'],
    }));
    assert.equal(find(result, 'Vercel'), undefined,
      'README mention alone must NOT detect Vercel');
  });

  test('Case 17 (true positive): vercel.json present → Vercel detected', () => {
    const result = detectTechnologyStack(emptyCtx({
      flatFiles: ['vercel.json'],
    }));
    assert.ok(find(result, 'Vercel'), 'vercel.json must detect Vercel');
  });

  test('Vercel detection is independent of Next.js', () => {
    // vercel.json alone (no Next.js dep) should detect Vercel
    const result = detectTechnologyStack(emptyCtx({
      flatFiles: ['vercel.json'],
    }));
    assert.ok(find(result, 'Vercel'), 'vercel.json alone must detect Vercel');
    assert.equal(find(result, 'Next.js'), undefined,
      'vercel.json alone must NOT detect Next.js');
  });

});

// ===========================================================================
// CASE 21 & 22: Nested fixture projects and minimal repos
// ===========================================================================

describe('False positive: Nested fixtures and minimal repos', () => {

  test('Case 21: fixtures/example-react/ → NOT React (noise directory filtering)', () => {
    // Files under fixtures/ should be deprioritised for file/directory evidence
    const result = detectTechnologyStack(emptyCtx({
      flatFiles: [
        'fixtures/example-react/src/App.tsx',
        'fixtures/example-react/src/index.tsx',
      ],
    }));
    assert.equal(find(result, 'React'), undefined,
      'fixtures/example-react/*.tsx must not detect React via noise filtering');
  });

  test('Case 21b: examples/ nested Vue project → NOT Vue (noise filtering)', () => {
    const result = detectTechnologyStack(emptyCtx({
      flatFiles: [
        'examples/vue-app/src/App.vue',
        'examples/vue-app/src/main.js',
      ],
    }));
    // .vue files under examples/ should be filtered by noise-dir logic
    assert.equal(find(result, 'Vue'), undefined,
      'examples/vue-app/ *.vue files must not detect Vue (noise directory)');
  });

  test('Case 21c: demo/ nested project → noise-filtered for file evidence', () => {
    const result = detectTechnologyStack(emptyCtx({
      flatFiles: ['demo/src/App.tsx', 'demo/package.json'],
    }));
    // demo/ is a noise directory for file evidence
    assert.equal(find(result, 'React'), undefined,
      'demo/src/App.tsx must not detect React (noise directory)');
  });

  test('Case 22: minimal repository → no invented technologies', () => {
    // Only basic files, no technology-identifying signals
    const result = detectTechnologyStack(emptyCtx({
      flatFiles: ['LICENSE', 'README.md', '.gitignore'],
    }));
    assert.equal(result.technologies.length, 0,
      'Minimal repository must not invent any technologies');
  });

  test('Root Next.js + nested examples/vue-app → Next.js detected, Vue not', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { dependencies: { next: '^14.0.0' } },
      flatFiles: [
        'app/page.tsx',
        'examples/vue-app/src/App.vue',
      ],
    }));
    assert.ok(find(result, 'Next.js'),
      'Next.js must be detected from root dependency');
    assert.equal(find(result, 'Vue'), undefined,
      'Vue must not be detected from nested examples/vue-app/');
  });

  test('Root React + nested examples/angular → React detected, Angular not', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { dependencies: { react: '^18.0.0' } },
      flatFiles: [
        'src/App.tsx',
        'examples/angular-demo/src/app/app.component.ts',
      ],
    }));
    assert.ok(find(result, 'React'),
      'React must be detected from root dependency');
    assert.equal(find(result, 'Angular'), undefined,
      'Angular must not be detected from nested examples/');
  });

  test('Root fixture package.json does not override root signals', () => {
    // Root package.json signals take priority — root dep always wins
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: {
        dependencies: { react: '^18.0.0', vue: '^3.0.0' },
      },
    }));
    // Both root deps are legitimate — both should be detected
    assert.ok(find(result, 'React'),  'React as root dep must be detected');
    assert.ok(find(result, 'Vue'),    'Vue as root dep must be detected');
  });

});

// ===========================================================================
// Additional false-positive cases
// ===========================================================================

describe('False positive: Additional edge cases', () => {

  test('tsconfig.json only (no dep) → NOT TypeScript (config=0.25, no strong ev)', () => {
    const result = detectTechnologyStack(emptyCtx({
      configs: ['tsconfig.json'],
    }));
    assert.equal(find(result, 'TypeScript'), undefined,
      'tsconfig.json alone must not detect TypeScript (config < threshold + no strong evidence)');
  });

  test('jsconfig.json only → NOT JavaScript', () => {
    const result = detectTechnologyStack(emptyCtx({
      configs: ['jsconfig.json'],
    }));
    assert.equal(find(result, 'JavaScript'), undefined,
      'jsconfig.json alone must not detect JavaScript');
  });

  test('*.ts files only (no dep) → NOT TypeScript (file=0.15 < threshold)', () => {
    const result = detectTechnologyStack(emptyCtx({
      flatFiles: ['src/index.ts', 'src/utils.ts', 'src/types.ts'],
    }));
    assert.equal(find(result, 'TypeScript'), undefined,
      '*.ts files alone (0.15) must not detect TypeScript');
  });

  test('alembic.ini only → NOT SQLAlchemy (config=0.25 < threshold, no strong ev)', () => {
    const result = detectTechnologyStack(emptyCtx({
      flatFiles: ['alembic.ini'],
    }));
    assert.equal(find(result, 'SQLAlchemy'), undefined,
      'alembic.ini alone must not detect SQLAlchemy (config < threshold + no strong evidence)');
  });

  test('package-lock.json only → NOT npm (file=0.15 < threshold)', () => {
    const result = detectTechnologyStack(emptyCtx({
      flatFiles: ['package-lock.json'],
    }));
    assert.equal(find(result, 'npm'), undefined,
      'package-lock.json alone (file=0.15) must not detect npm');
  });

  test('empty dependencies object → no technologies detected', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { dependencies: {}, devDependencies: {} },
    }));
    assert.equal(result.technologies.length, 0,
      'Empty dependency objects must produce no detected technologies');
  });

  test('null packageManifest → no package-manifest-based technologies', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: null,
    }));
    // No dependency-based tech should appear
    const depTechs = result.technologies.filter(t =>
      t.evidence.some(e => e.type === 'dependency' || e.type === 'devDependency')
    );
    assert.equal(depTechs.length, 0,
      'null packageManifest must not produce dependency-based technologies');
  });

  test('nest-cli.json alone → NOT NestJS (config=0.25 < threshold, no strong ev)', () => {
    // nest-cli.json is listed as 'config' evidence for NestJS
    const result = detectTechnologyStack(emptyCtx({
      flatFiles: ['nest-cli.json'],
    }));
    assert.equal(find(result, 'NestJS'), undefined,
      'nest-cli.json alone must not detect NestJS (no dep or strong evidence)');
  });

  test('angular.json alone → NOT Angular (config=0.25 < threshold, no strong ev)', () => {
    const result = detectTechnologyStack(emptyCtx({
      configs: ['angular.json'],
    }));
    assert.equal(find(result, 'Angular'), undefined,
      'angular.json alone must not detect Angular');
  });

  test('svelte.config.js alone → NOT SvelteKit (config=0.25 < threshold, no strong ev)', () => {
    const result = detectTechnologyStack(emptyCtx({
      configs: ['svelte.config.js'],
    }));
    assert.equal(find(result, 'SvelteKit'), undefined,
      'svelte.config.js alone must not detect SvelteKit');
  });

  test('biome.json alone → NOT Biome (manifest=0.60 threshold crossed, BUT no strong ev)...', () => {
    // biome.json uses manifest (0.60) evidenceType → it IS strong evidence
    // So biome.json alone should actually detect Biome (legitimate single-file signal)
    const result = detectTechnologyStack(emptyCtx({
      flatFiles: ['biome.json'],
    }));
    // biome.json is manifest evidence (0.60) → legitimate detection
    assert.ok(find(result, 'Biome'),
      'biome.json (manifest, 0.60) alone legitimately detects Biome — it is a strong signal');
  });

  test('Dockerfile in nested fixture does NOT detect Docker', () => {
    const result = detectTechnologyStack(emptyCtx({
      flatFiles: ['fixtures/docker-example/Dockerfile'],
    }));
    // fixtures/ is a noise directory — file evidence is filtered
    assert.equal(find(result, 'Docker'), undefined,
      'Dockerfile under fixtures/ must not detect Docker (noise directory)');
  });

});
