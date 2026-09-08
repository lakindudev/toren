/**
 * @fileoverview Toren v1.1.0 — Step 4: Frontend + Styling Intelligence Tests
 *
 * Tests all frontend framework and styling library detection rules.
 *
 * Frontend frameworks:
 *   React, Next.js, Vue, Nuxt, Angular, Svelte, SvelteKit, Astro, Remix
 *
 * Styling libraries:
 *   Tailwind CSS, Sass, Less, Styled Components, Emotion, Bootstrap,
 *   Material UI, Chakra UI
 *
 * False-positive guards:
 *   - directory named react/ alone must NOT detect React
 *   - directory named next/ alone must NOT detect Next.js
 *   - README mentioning Next.js must NOT detect Next.js
 *   - plain CSS files must NOT produce any styling technology entry
 */

import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { detectTechnologyStack } from '../dist/detectors/technology-stack-detector.js';
import { scan }                  from '../dist/scanner/scan.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal valid empty context. */
function emptyCtx(overrides = {}) {
  return {
    flatFiles:      [],
    configs:        [],
    scripts:        [],
    packageManager: null,
    projectType:    'Unknown',
    packageManifest: null,
    ...overrides,
  };
}

/** Make a temp dir with the given files, returning its path. */
function makeDir(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'toren-fe-'));
  for (const [name, content] of Object.entries(files)) {
    const fullPath = path.join(dir, name);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content);
  }
  return dir;
}

/** Find a tech by name in the result. */
function findTech(result, name) {
  return result.technologies.find(t => t.name === name);
}

// ---------------------------------------------------------------------------
// ── REACT ────────────────────────────────────────────────────────────────────
// ---------------------------------------------------------------------------

describe('Frontend: React', () => {

  test('react in dependencies → detected at ≥ 0.60', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { dependencies: { react: '^18.0.0' } },
    }));
    const tech = findTech(result, 'React');
    assert.ok(tech, 'React must be detected from dependency');
    assert.equal(tech.category, 'frontend');
    assert.ok(tech.confidence >= 0.60);
  });

  test('react in devDependencies → detected', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { devDependencies: { react: '^18.0.0' } },
    }));
    assert.ok(findTech(result, 'React'), 'React must be detected from devDependency');
  });

  test('dependency + *.tsx files → confidence boosted', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { dependencies: { react: '^18.0.0' } },
      flatFiles: ['src/App.tsx', 'src/Button.tsx'],
    }));
    const tech = findTech(result, 'React');
    assert.ok(tech, 'React must be detected');
    // dep(0.60) + file(0.15) = 0.75
    assert.ok(tech.confidence >= 0.75,
      `React with dep+files should have confidence ≥ 0.75, got ${tech.confidence}`);
    const evidenceTypes = tech.evidence.map(e => e.type);
    assert.ok(evidenceTypes.includes('dependency'), 'must have dependency evidence');
    assert.ok(evidenceTypes.includes('file'), 'must have file evidence');
  });

  // ── FALSE POSITIVE: directory named react/ alone must NOT detect React ──

  test('[FALSE-POSITIVE GUARD] directory named react/ alone must NOT detect React', () => {
    // The only signal is a directory name — no dep, no jsx/tsx files.
    const result = detectTechnologyStack(emptyCtx({
      flatFiles: ['react/index.html', 'react/app.html'],
    }));
    // These files are .html, not .jsx/.tsx, so the file rule won't fire either.
    // No package manifest → dependency rule won't fire.
    const tech = findTech(result, 'React');
    assert.equal(tech, undefined,
      'A directory named react/ must NOT trigger React detection (no dep, no jsx/tsx files)');
  });

  test('[FALSE-POSITIVE GUARD] jsx/tsx files alone (no dependency) are suppressed', () => {
    // file evidence alone = 0.15 < 0.60 threshold
    const result = detectTechnologyStack(emptyCtx({
      flatFiles: ['src/App.jsx', 'src/Button.tsx'],
    }));
    const tech = findTech(result, 'React');
    assert.equal(tech, undefined,
      'React from file evidence alone (0.15) must be below threshold and suppressed');
  });

});

// ---------------------------------------------------------------------------
// ── NEXT.JS ──────────────────────────────────────────────────────────────────
// ---------------------------------------------------------------------------

describe('Frontend: Next.js', () => {

  test('next in dependencies → detected', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { dependencies: { next: '^14.0.0' } },
    }));
    const tech = findTech(result, 'Next.js');
    assert.ok(tech, 'Next.js must be detected');
    assert.equal(tech.category, 'frontend');
  });

  test('next.config.js config file detected', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { dependencies: { next: '^14.0.0' } },
      configs: ['next.config.js'],
    }));
    const tech = findTech(result, 'Next.js');
    assert.ok(tech, 'Next.js must be detected with dep + config');
    const configEvidence = tech.evidence.find(e => e.type === 'config');
    assert.ok(configEvidence, 'config evidence must be present');
    assert.equal(configEvidence.value, 'next.config.js');
  });

  test('next.config.ts config file detected', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { dependencies: { next: '^14.0.0' } },
      configs: ['next.config.ts'],
    }));
    const configEvidence = findTech(result, 'Next.js')?.evidence.find(e => e.type === 'config');
    assert.ok(configEvidence, 'next.config.ts must be detected as config evidence');
    assert.equal(configEvidence.value, 'next.config.ts');
  });

  test('next.config.mjs config file detected', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { dependencies: { next: '^14.0.0' } },
      configs: ['next.config.mjs'],
    }));
    const tech = findTech(result, 'Next.js');
    assert.ok(tech?.evidence.some(e => e.type === 'config' && e.value === 'next.config.mjs'));
  });

  test('app/ directory adds directory evidence', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { dependencies: { next: '^14.0.0' } },
      flatFiles: ['app/page.tsx', 'app/layout.tsx'],
    }));
    const tech = findTech(result, 'Next.js');
    assert.ok(tech?.evidence.some(e => e.type === 'directory'),
      'app/ directory must contribute directory evidence');
  });

  test('pages/ directory adds directory evidence', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { dependencies: { next: '^14.0.0' } },
      flatFiles: ['pages/index.tsx', 'pages/_app.tsx'],
    }));
    const tech = findTech(result, 'Next.js');
    assert.ok(tech?.evidence.some(e => e.type === 'directory'),
      'pages/ directory must contribute directory evidence');
  });

  test('dep + config + app/ → confidence 1.0 (capped)', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { dependencies: { next: '^14.0.0' } },
      configs: ['next.config.ts'],
      flatFiles: ['app/page.tsx'],
    }));
    const tech = findTech(result, 'Next.js');
    assert.ok(tech, 'Next.js must be detected');
    // dep(0.60) + config(0.25) + directory(0.15) = 1.0
    assert.equal(tech.confidence, 1.0,
      `dep+config+directory should be capped at 1.0, got ${tech.confidence}`);
  });

  // ── FALSE POSITIVES ─────────────────────────────────────────────────────

  test('[FALSE-POSITIVE GUARD] directory named next/ alone must NOT detect Next.js', () => {
    const result = detectTechnologyStack(emptyCtx({
      // next/ dir files but no next dependency, no next.config.*
      flatFiles: ['next/dist/index.js'],
      // No configs matching next.config.*
    }));
    // The directory rule checks for files starting with "app/" or "pages/", not "next/"
    // so this correctly should not fire. Plus no dep.
    const tech = findTech(result, 'Next.js');
    assert.equal(tech, undefined,
      'A directory named next/ alone must NOT trigger Next.js detection');
  });

  test('[FALSE-POSITIVE GUARD] README mentioning Next.js must NOT detect Next.js', () => {
    // No text scanning — README content is never used as evidence.
    const result = detectTechnologyStack(emptyCtx({
      flatFiles: ['README.md'],
      // README content is not scanned, no text-based rules exist
    }));
    const tech = findTech(result, 'Next.js');
    assert.equal(tech, undefined,
      'A README mentioning Next.js must NOT trigger detection (no text-scanning rules)');
  });

  test('[FALSE-POSITIVE GUARD] app/ directory alone (no dep) must NOT detect Next.js', () => {
    // directory evidence alone = 0.15 < 0.60 threshold
    const result = detectTechnologyStack(emptyCtx({
      flatFiles: ['app/page.tsx', 'app/layout.tsx'],
    }));
    const tech = findTech(result, 'Next.js');
    assert.equal(tech, undefined,
      'app/ directory alone (0.15) must be below threshold — Next.js needs dep or config');
  });

  test('[FALSE-POSITIVE GUARD] pages/ directory alone (no dep) must NOT detect Next.js', () => {
    const result = detectTechnologyStack(emptyCtx({
      flatFiles: ['pages/index.tsx'],
    }));
    const tech = findTech(result, 'Next.js');
    assert.equal(tech, undefined,
      'pages/ directory alone (0.15) must be below threshold');
  });

  test('[FALSE-POSITIVE GUARD] next.config.* alone (no dep) must NOT detect Next.js', () => {
    // config evidence alone = 0.25 < 0.60 threshold
    const result = detectTechnologyStack(emptyCtx({
      configs: ['next.config.js'],
    }));
    const tech = findTech(result, 'Next.js');
    assert.equal(tech, undefined,
      'next.config.* alone (0.25) must be below threshold — needs dep as well');
  });

});

// ---------------------------------------------------------------------------
// ── VUE ──────────────────────────────────────────────────────────────────────
// ---------------------------------------------------------------------------

describe('Frontend: Vue', () => {

  test('vue in dependencies → detected at ≥ 0.60', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { dependencies: { vue: '^3.4.0' } },
    }));
    const tech = findTech(result, 'Vue');
    assert.ok(tech, 'Vue must be detected from dependency');
    assert.equal(tech.category, 'frontend');
    assert.ok(tech.confidence >= 0.60);
  });

  test('vue in devDependencies → detected', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { devDependencies: { vue: '^3.4.0' } },
    }));
    assert.ok(findTech(result, 'Vue'), 'Vue must be detected from devDependency');
  });

  test('*.vue files provide supporting evidence', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { dependencies: { vue: '^3.4.0' } },
      flatFiles: ['src/App.vue', 'src/components/Header.vue'],
    }));
    const tech = findTech(result, 'Vue');
    assert.ok(tech, 'Vue must be detected');
    assert.ok(tech.evidence.some(e => e.type === 'file' && e.value.includes('.vue')),
      '*.vue files must appear in evidence');
  });

  test('*.vue files alone (no dep) are suppressed', () => {
    // 0.15 < 0.60 threshold
    const result = detectTechnologyStack(emptyCtx({
      flatFiles: ['src/App.vue'],
    }));
    const tech = findTech(result, 'Vue');
    assert.equal(tech, undefined,
      'Vue from *.vue files alone (0.15) must be below threshold and suppressed');
  });

});

// ---------------------------------------------------------------------------
// ── NUXT ─────────────────────────────────────────────────────────────────────
// ---------------------------------------------------------------------------

describe('Frontend: Nuxt', () => {

  test('nuxt in dependencies → detected', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { dependencies: { nuxt: '^3.0.0' } },
    }));
    const tech = findTech(result, 'Nuxt');
    assert.ok(tech, 'Nuxt must be detected from dependency');
    assert.equal(tech.category, 'frontend');
  });

  test('nuxt in devDependencies → detected', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { devDependencies: { nuxt: '^3.0.0' } },
    }));
    assert.ok(findTech(result, 'Nuxt'), 'Nuxt must be detected from devDependency');
  });

  test('nuxt.config.ts detected as config evidence', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { devDependencies: { nuxt: '^3.0.0' } },
      configs: ['nuxt.config.ts'],
    }));
    const tech = findTech(result, 'Nuxt');
    assert.ok(tech, 'Nuxt must be detected');
    const configEvidence = tech.evidence.find(e => e.type === 'config');
    assert.ok(configEvidence, 'nuxt.config.ts must produce config evidence');
    assert.equal(configEvidence.value, 'nuxt.config.ts');
  });

  test('nuxt.config.js detected as config evidence', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { devDependencies: { nuxt: '^3.0.0' } },
      configs: ['nuxt.config.js'],
    }));
    assert.ok(
      findTech(result, 'Nuxt')?.evidence.some(e => e.type === 'config' && e.value === 'nuxt.config.js'),
      'nuxt.config.js must produce config evidence',
    );
  });

  test('dep + nuxt.config.* → confidence 0.85', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { devDependencies: { nuxt: '^3.0.0' } },
      configs: ['nuxt.config.ts'],
    }));
    const tech = findTech(result, 'Nuxt');
    // dep(0.60) + config(0.25) = 0.85
    assert.equal(tech.confidence, 0.85,
      `dep+config should be 0.85, got ${tech.confidence}`);
  });

});

// ---------------------------------------------------------------------------
// ── ANGULAR ───────────────────────────────────────────────────────────────────
// ---------------------------------------------------------------------------

describe('Frontend: Angular', () => {

  test('@angular/core in dependencies → detected', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { dependencies: { '@angular/core': '^17.0.0' } },
    }));
    const tech = findTech(result, 'Angular');
    assert.ok(tech, 'Angular must be detected from @angular/core dependency');
    assert.equal(tech.category, 'frontend');
    assert.ok(tech.confidence >= 0.60);
  });

  test('@angular/core in devDependencies → detected', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { devDependencies: { '@angular/core': '^17.0.0' } },
    }));
    assert.ok(findTech(result, 'Angular'), 'Angular must be detected from devDependency');
  });

  test('angular.json config file detected', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { dependencies: { '@angular/core': '^17.0.0' } },
      configs: ['angular.json'],
    }));
    const tech = findTech(result, 'Angular');
    assert.ok(tech, 'Angular must be detected');
    assert.ok(tech.evidence.some(e => e.type === 'config' && e.value === 'angular.json'),
      'angular.json must appear as config evidence');
  });

  test('@angular/core dep + angular.json → confidence 0.85', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { dependencies: { '@angular/core': '^17.0.0' } },
      configs: ['angular.json'],
    }));
    const tech = findTech(result, 'Angular');
    // dep(0.60) + config(0.25) = 0.85
    assert.equal(tech.confidence, 0.85);
  });

  test('angular.json alone (no dep) is suppressed', () => {
    // 0.25 < 0.60 threshold
    const result = detectTechnologyStack(emptyCtx({
      configs: ['angular.json'],
    }));
    const tech = findTech(result, 'Angular');
    assert.equal(tech, undefined,
      'angular.json alone (0.25) must be below threshold and suppressed');
  });

});

// ---------------------------------------------------------------------------
// ── SVELTE ────────────────────────────────────────────────────────────────────
// ---------------------------------------------------------------------------

describe('Frontend: Svelte', () => {

  test('svelte in dependencies → detected', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { dependencies: { svelte: '^4.0.0' } },
    }));
    const tech = findTech(result, 'Svelte');
    assert.ok(tech, 'Svelte must be detected from dependency');
    assert.equal(tech.category, 'frontend');
  });

  test('svelte in devDependencies → detected', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { devDependencies: { svelte: '^4.0.0' } },
    }));
    assert.ok(findTech(result, 'Svelte'), 'Svelte must be detected from devDependency');
  });

  test('*.svelte files provide supporting evidence', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { devDependencies: { svelte: '^4.0.0' } },
      flatFiles: ['src/App.svelte', 'src/Counter.svelte'],
    }));
    const tech = findTech(result, 'Svelte');
    assert.ok(tech, 'Svelte must be detected');
    assert.ok(tech.evidence.some(e => e.type === 'file' && e.value.includes('.svelte')),
      '*.svelte files must appear in evidence');
  });

  test('*.svelte files alone (no dep) are suppressed', () => {
    const result = detectTechnologyStack(emptyCtx({
      flatFiles: ['src/App.svelte'],
    }));
    const tech = findTech(result, 'Svelte');
    assert.equal(tech, undefined,
      'Svelte from *.svelte files alone (0.15) must be below threshold');
  });

});

// ---------------------------------------------------------------------------
// ── SVELTEKIT ────────────────────────────────────────────────────────────────
// ---------------------------------------------------------------------------

describe('Frontend: SvelteKit', () => {

  test('@sveltejs/kit in devDependencies → SvelteKit detected', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { devDependencies: { '@sveltejs/kit': '^2.0.0', svelte: '^4.0.0' } },
    }));
    const tech = findTech(result, 'SvelteKit');
    assert.ok(tech, 'SvelteKit must be detected from @sveltejs/kit devDependency');
    assert.equal(tech.category, 'frontend');
  });

  test('@sveltejs/kit in dependencies → SvelteKit detected', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { dependencies: { '@sveltejs/kit': '^2.0.0' } },
    }));
    assert.ok(findTech(result, 'SvelteKit'), 'SvelteKit must be detected from dependency');
  });

  test('svelte.config.js detected as config evidence', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { devDependencies: { '@sveltejs/kit': '^2.0.0' } },
      configs: ['svelte.config.js'],
    }));
    const tech = findTech(result, 'SvelteKit');
    assert.ok(tech, 'SvelteKit must be detected');
    assert.ok(tech.evidence.some(e => e.type === 'config' && e.value === 'svelte.config.js'),
      'svelte.config.js must appear as config evidence');
  });

  test('svelte.config.ts detected as config evidence', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { devDependencies: { '@sveltejs/kit': '^2.0.0' } },
      configs: ['svelte.config.ts'],
    }));
    const tech = findTech(result, 'SvelteKit');
    assert.ok(tech?.evidence.some(e => e.type === 'config' && e.value === 'svelte.config.ts'));
  });

  test('@sveltejs/kit dep + svelte.config → confidence 0.85', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { devDependencies: { '@sveltejs/kit': '^2.0.0' } },
      configs: ['svelte.config.js'],
    }));
    const tech = findTech(result, 'SvelteKit');
    // dep(0.60) + config(0.25) = 0.85
    assert.equal(tech.confidence, 0.85);
  });

  test('SvelteKit and Svelte can coexist in same project', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: {
        devDependencies: {
          '@sveltejs/kit': '^2.0.0',
          svelte: '^4.0.0',
        },
      },
      configs: ['svelte.config.js'],
    }));
    assert.ok(findTech(result, 'SvelteKit'), 'SvelteKit must be detected');
    assert.ok(findTech(result, 'Svelte'), 'Svelte must also be detected (coexistence)');
  });

});

// ---------------------------------------------------------------------------
// ── ASTRO ─────────────────────────────────────────────────────────────────────
// ---------------------------------------------------------------------------

describe('Frontend: Astro', () => {

  test('astro in dependencies → detected', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { dependencies: { astro: '^4.0.0' } },
    }));
    const tech = findTech(result, 'Astro');
    assert.ok(tech, 'Astro must be detected from dependency');
    assert.equal(tech.category, 'frontend');
  });

  test('astro in devDependencies → detected', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { devDependencies: { astro: '^4.0.0' } },
    }));
    assert.ok(findTech(result, 'Astro'), 'Astro must be detected from devDependency');
  });

  test('astro.config.mjs detected as config evidence', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { devDependencies: { astro: '^4.0.0' } },
      configs: ['astro.config.mjs'],
    }));
    const tech = findTech(result, 'Astro');
    assert.ok(tech, 'Astro must be detected');
    assert.ok(tech.evidence.some(e => e.type === 'config' && e.value === 'astro.config.mjs'),
      'astro.config.mjs must appear as config evidence');
  });

  test('astro.config.ts detected as config evidence', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { devDependencies: { astro: '^4.0.0' } },
      configs: ['astro.config.ts'],
    }));
    const tech = findTech(result, 'Astro');
    assert.ok(tech?.evidence.some(e => e.type === 'config' && e.value === 'astro.config.ts'));
  });

  test('dep + astro.config.* → confidence 0.85', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { devDependencies: { astro: '^4.0.0' } },
      configs: ['astro.config.mjs'],
    }));
    const tech = findTech(result, 'Astro');
    assert.equal(tech.confidence, 0.85);
  });

});

// ---------------------------------------------------------------------------
// ── REMIX ─────────────────────────────────────────────────────────────────────
// ---------------------------------------------------------------------------

describe('Frontend: Remix', () => {

  test('@remix-run/react in dependencies → Remix detected', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { dependencies: { '@remix-run/react': '^2.0.0' } },
    }));
    const tech = findTech(result, 'Remix');
    assert.ok(tech, 'Remix must be detected from @remix-run/react dependency');
    assert.equal(tech.category, 'frontend');
    assert.ok(tech.confidence >= 0.60);
  });

  test('@remix-run/node in dependencies also contributes evidence', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: {
        dependencies: {
          '@remix-run/react': '^2.0.0',
          '@remix-run/node': '^2.0.0',
        },
      },
    }));
    const tech = findTech(result, 'Remix');
    assert.ok(tech, 'Remix must be detected');
    // Both @remix-run/react and @remix-run/node fire dep rules → merged
    // dep(0.60) + dep(0.60) = 1.0 (capped)
    assert.equal(tech.confidence, 1.0,
      'Two separate dep evidences should be capped at 1.0');
  });

  test('@remix-run/react in devDependencies → Remix detected', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { devDependencies: { '@remix-run/react': '^2.0.0' } },
    }));
    assert.ok(findTech(result, 'Remix'), 'Remix must be detected from devDependency');
  });

  test('Remix detected only once (deduplication)', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: {
        dependencies: {
          '@remix-run/react': '^2.0.0',
          '@remix-run/node': '^2.0.0',
        },
      },
    }));
    const remixEntries = result.technologies.filter(t => t.name === 'Remix');
    assert.equal(remixEntries.length, 1, 'Remix must appear exactly once after deduplication');
  });

});

// ---------------------------------------------------------------------------
// ── TAILWIND CSS ──────────────────────────────────────────────────────────────
// ---------------------------------------------------------------------------

describe('Styling: Tailwind CSS', () => {

  test('tailwindcss in devDependencies → detected', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { devDependencies: { tailwindcss: '^3.4.0' } },
    }));
    const tech = findTech(result, 'Tailwind CSS');
    assert.ok(tech, 'Tailwind CSS must be detected from devDependency');
    assert.equal(tech.category, 'styling');
    assert.ok(tech.confidence >= 0.60);
  });

  test('tailwindcss in dependencies → detected', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { dependencies: { tailwindcss: '^3.4.0' } },
    }));
    assert.ok(findTech(result, 'Tailwind CSS'), 'Tailwind CSS must be detected from dependency');
  });

  test('tailwind.config.js detected as config evidence', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { devDependencies: { tailwindcss: '^3.4.0' } },
      configs: ['tailwind.config.js'],
    }));
    const tech = findTech(result, 'Tailwind CSS');
    assert.ok(tech, 'Tailwind CSS must be detected');
    assert.ok(tech.evidence.some(e => e.type === 'config' && e.value === 'tailwind.config.js'),
      'tailwind.config.js must appear as config evidence');
  });

  test('tailwind.config.ts detected as config evidence', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { devDependencies: { tailwindcss: '^3.4.0' } },
      configs: ['tailwind.config.ts'],
    }));
    const tech = findTech(result, 'Tailwind CSS');
    assert.ok(tech?.evidence.some(e => e.type === 'config' && e.value === 'tailwind.config.ts'));
  });

  test('dep + tailwind.config.* → confidence 0.85', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { devDependencies: { tailwindcss: '^3.4.0' } },
      configs: ['tailwind.config.ts'],
    }));
    const tech = findTech(result, 'Tailwind CSS');
    // dep(0.60) + config(0.25) = 0.85
    assert.equal(tech.confidence, 0.85,
      `dep+config should be 0.85, got ${tech.confidence}`);
  });

  test('tailwind.config.* alone (no dep) is suppressed', () => {
    const result = detectTechnologyStack(emptyCtx({
      configs: ['tailwind.config.js'],
    }));
    const tech = findTech(result, 'Tailwind CSS');
    assert.equal(tech, undefined,
      'tailwind.config.* alone (0.25) must be below threshold');
  });

});

// ---------------------------------------------------------------------------
// ── SASS ──────────────────────────────────────────────────────────────────────
// ---------------------------------------------------------------------------

describe('Styling: Sass', () => {

  test('sass in devDependencies → detected', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { devDependencies: { sass: '^1.70.0' } },
    }));
    const tech = findTech(result, 'Sass');
    assert.ok(tech, 'Sass must be detected from devDependency');
    assert.equal(tech.category, 'styling');
    assert.ok(tech.confidence >= 0.60);
  });

  test('sass in dependencies → detected', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { dependencies: { sass: '^1.70.0' } },
    }));
    assert.ok(findTech(result, 'Sass'), 'Sass must be detected from dependency');
  });

  test('*.scss files provide supporting evidence', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { devDependencies: { sass: '^1.70.0' } },
      flatFiles: ['src/styles/main.scss', 'src/components/button.scss'],
    }));
    const tech = findTech(result, 'Sass');
    assert.ok(tech, 'Sass must be detected');
    assert.ok(tech.evidence.some(e => e.type === 'file' && e.value.includes('.scss')),
      '*.scss files must appear in evidence');
    // dep(0.60) + file(0.15) = 0.75
    assert.ok(tech.confidence >= 0.75, `confidence should be ≥ 0.75, got ${tech.confidence}`);
  });

  test('*.scss files alone (no dep) are suppressed', () => {
    const result = detectTechnologyStack(emptyCtx({
      flatFiles: ['styles/main.scss'],
    }));
    const tech = findTech(result, 'Sass');
    assert.equal(tech, undefined,
      'Sass from *.scss files alone (0.15) must be below threshold');
  });

});

// ---------------------------------------------------------------------------
// ── LESS ──────────────────────────────────────────────────────────────────────
// ---------------------------------------------------------------------------

describe('Styling: Less', () => {

  test('less in dependencies → detected', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { dependencies: { less: '^4.0.0' } },
    }));
    const tech = findTech(result, 'Less');
    assert.ok(tech, 'Less must be detected from dependency');
    assert.equal(tech.category, 'styling');
  });

  test('less in devDependencies → detected', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { devDependencies: { less: '^4.0.0' } },
    }));
    assert.ok(findTech(result, 'Less'), 'Less must be detected from devDependency');
  });

  test('*.less files provide supporting evidence', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { dependencies: { less: '^4.0.0' } },
      flatFiles: ['src/styles.less'],
    }));
    const tech = findTech(result, 'Less');
    assert.ok(tech?.evidence.some(e => e.type === 'file' && e.value.includes('.less')),
      '*.less files must appear in evidence');
  });

  test('*.less files alone (no dep) are suppressed', () => {
    const result = detectTechnologyStack(emptyCtx({
      flatFiles: ['styles/theme.less'],
    }));
    assert.equal(findTech(result, 'Less'), undefined,
      'Less from *.less files alone must be below threshold');
  });

});

// ---------------------------------------------------------------------------
// ── STYLED COMPONENTS ────────────────────────────────────────────────────────
// ---------------------------------------------------------------------------

describe('Styling: Styled Components', () => {

  test('styled-components in dependencies → detected', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { dependencies: { 'styled-components': '^6.0.0' } },
    }));
    const tech = findTech(result, 'Styled Components');
    assert.ok(tech, 'Styled Components must be detected');
    assert.equal(tech.category, 'styling');
    assert.ok(tech.confidence >= 0.60);
  });

  test('styled-components in devDependencies → detected', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { devDependencies: { 'styled-components': '^6.0.0' } },
    }));
    assert.ok(findTech(result, 'Styled Components'),
      'Styled Components must be detected from devDependency');
  });

});

// ---------------------------------------------------------------------------
// ── EMOTION ───────────────────────────────────────────────────────────────────
// ---------------------------------------------------------------------------

describe('Styling: Emotion', () => {

  test('@emotion/react in dependencies → Emotion detected', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { dependencies: { '@emotion/react': '^11.0.0' } },
    }));
    const tech = findTech(result, 'Emotion');
    assert.ok(tech, 'Emotion must be detected from @emotion/react dependency');
    assert.equal(tech.category, 'styling');
    assert.ok(tech.confidence >= 0.60);
    assert.ok(tech.evidence.some(e => e.value === '@emotion/react'),
      'evidence must reference @emotion/react');
  });

  test('@emotion/react in devDependencies → Emotion detected', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { devDependencies: { '@emotion/react': '^11.0.0' } },
    }));
    assert.ok(findTech(result, 'Emotion'),
      'Emotion must be detected from devDependency');
  });

});

// ---------------------------------------------------------------------------
// ── BOOTSTRAP ─────────────────────────────────────────────────────────────────
// ---------------------------------------------------------------------------

describe('Styling: Bootstrap', () => {

  test('bootstrap in dependencies → detected', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { dependencies: { bootstrap: '^5.3.0' } },
    }));
    const tech = findTech(result, 'Bootstrap');
    assert.ok(tech, 'Bootstrap must be detected from dependency');
    assert.equal(tech.category, 'styling');
    assert.ok(tech.confidence >= 0.60);
  });

  test('bootstrap in devDependencies → detected', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { devDependencies: { bootstrap: '^5.3.0' } },
    }));
    assert.ok(findTech(result, 'Bootstrap'), 'Bootstrap must be detected from devDependency');
  });

});

// ---------------------------------------------------------------------------
// ── MATERIAL UI ───────────────────────────────────────────────────────────────
// ---------------------------------------------------------------------------

describe('Styling: Material UI', () => {

  test('@mui/material in dependencies → Material UI detected', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { dependencies: { '@mui/material': '^5.0.0' } },
    }));
    const tech = findTech(result, 'Material UI');
    assert.ok(tech, 'Material UI must be detected from @mui/material dependency');
    assert.equal(tech.category, 'styling');
    assert.ok(tech.confidence >= 0.60);
    assert.ok(tech.evidence.some(e => e.value === '@mui/material'));
  });

  test('@mui/material in devDependencies → detected', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { devDependencies: { '@mui/material': '^5.0.0' } },
    }));
    assert.ok(findTech(result, 'Material UI'), 'Material UI must be detected from devDependency');
  });

});

// ---------------------------------------------------------------------------
// ── CHAKRA UI ─────────────────────────────────────────────────────────────────
// ---------------------------------------------------------------------------

describe('Styling: Chakra UI', () => {

  test('@chakra-ui/react in dependencies → Chakra UI detected', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { dependencies: { '@chakra-ui/react': '^2.0.0' } },
    }));
    const tech = findTech(result, 'Chakra UI');
    assert.ok(tech, 'Chakra UI must be detected from @chakra-ui/react dependency');
    assert.equal(tech.category, 'styling');
    assert.ok(tech.confidence >= 0.60);
    assert.ok(tech.evidence.some(e => e.value === '@chakra-ui/react'));
  });

  test('@chakra-ui/react in devDependencies → detected', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { devDependencies: { '@chakra-ui/react': '^2.0.0' } },
    }));
    assert.ok(findTech(result, 'Chakra UI'), 'Chakra UI must be detected from devDependency');
  });

});

// ---------------------------------------------------------------------------
// ── ADDITIONAL FALSE-POSITIVE TESTS ──────────────────────────────────────────
// ---------------------------------------------------------------------------

describe('False-positive guards — general', () => {

  test('plain .css files do NOT produce any styling technology entry', () => {
    const result = detectTechnologyStack(emptyCtx({
      flatFiles: ['src/styles.css', 'src/reset.css', 'public/main.css'],
    }));
    const stylingTechs = result.technologies.filter(t => t.category === 'styling');
    assert.equal(stylingTechs.length, 0,
      'Plain .css files must not produce any styling technology detection');
  });

  test('vue/ directory alone does NOT detect Vue', () => {
    const result = detectTechnologyStack(emptyCtx({
      flatFiles: ['vue/config.js'],
    }));
    assert.equal(findTech(result, 'Vue'), undefined,
      'A directory named vue/ alone must not trigger Vue detection');
  });

  test('angular/ directory alone does NOT detect Angular', () => {
    const result = detectTechnologyStack(emptyCtx({
      flatFiles: ['angular/core.ts'],
    }));
    assert.equal(findTech(result, 'Angular'), undefined,
      'A directory named angular/ must not trigger Angular detection');
  });

  test('empty flatFiles and no packageManifest → no technologies detected', () => {
    const result = detectTechnologyStack(emptyCtx());
    assert.equal(result.technologies.length, 0,
      'Empty project must produce no detected technologies');
  });

  test('all returned technologies in a mixed project have confidence ≥ 0.60', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: {
        dependencies: {
          react: '^18.0.0',
          next: '^14.0.0',
          tailwindcss: '^3.4.0',
        },
        devDependencies: {
          typescript: '^5.0.0',
          sass: '^1.70.0',
        },
      },
      configs: ['next.config.ts', 'tailwind.config.ts', 'tsconfig.json'],
      flatFiles: ['app/page.tsx', 'src/App.tsx', 'src/styles/main.scss'],
    }));

    for (const tech of result.technologies) {
      assert.ok(tech.confidence >= 0.60,
        `${tech.name} has confidence ${tech.confidence} below 0.60 threshold`);
    }
  });

});

// ---------------------------------------------------------------------------
// ── SCAN() INTEGRATION FIXTURES ──────────────────────────────────────────────
// ---------------------------------------------------------------------------

describe('scan() integration — frontend fixtures', () => {

  // ── Next.js fixture ──────────────────────────────────────────────────────

  test('Next.js project fixture → Next.js + React + TypeScript detected', () => {
    const dir = makeDir({
      'package.json': JSON.stringify({
        name: 'my-nextjs-app',
        dependencies: {
          next: '^14.0.0',
          react: '^18.0.0',
          'react-dom': '^18.0.0',
        },
        devDependencies: { typescript: '^5.0.0' },
      }),
      'package-lock.json': '{}',
      'next.config.ts': 'export default {};',
      'tsconfig.json': '{"compilerOptions":{}}',
      'app/page.tsx': 'export default function Page() { return null; }',
      'app/layout.tsx': 'export default function Layout({ children }: any) { return children; }',
    });
    after(() => fs.rmSync(dir, { recursive: true, force: true }));

    const result = scan(dir);
    assert.ok(findTech(result.technologyStack, 'Next.js'), 'Next.js must be detected');
    assert.ok(findTech(result.technologyStack, 'React'),   'React must be detected');
    assert.ok(findTech(result.technologyStack, 'TypeScript'), 'TypeScript must be detected');
  });

  // ── React/Vite fixture ──────────────────────────────────────────────────

  test('React + Vite project fixture → React detected, Next.js NOT detected', () => {
    const dir = makeDir({
      'package.json': JSON.stringify({
        name: 'my-vite-app',
        dependencies: { react: '^18.0.0', 'react-dom': '^18.0.0' },
        devDependencies: { vite: '^5.0.0', typescript: '^5.0.0' },
      }),
      'package-lock.json': '{}',
      'tsconfig.json': '{"compilerOptions":{}}',
      'vite.config.ts': 'export default {};',
      'src/App.tsx': 'export default function App() { return null; }',
      'src/main.tsx': 'import React from "react";',
    });
    after(() => fs.rmSync(dir, { recursive: true, force: true }));

    const result = scan(dir);
    assert.ok(findTech(result.technologyStack, 'React'), 'React must be detected');
    assert.equal(findTech(result.technologyStack, 'Next.js'), undefined,
      'Next.js must NOT be detected in a plain Vite+React project');
  });

  // ── Vue fixture ──────────────────────────────────────────────────────────

  test('Vue project fixture → Vue detected', () => {
    const dir = makeDir({
      'package.json': JSON.stringify({
        name: 'my-vue-app',
        dependencies: { vue: '^3.4.0' },
        devDependencies: { vite: '^5.0.0' },
      }),
      'package-lock.json': '{}',
      'src/App.vue': '<template><div>Hello</div></template>',
      'src/main.js': 'import { createApp } from "vue";',
    });
    after(() => fs.rmSync(dir, { recursive: true, force: true }));

    const result = scan(dir);
    assert.ok(findTech(result.technologyStack, 'Vue'), 'Vue must be detected in scan result');
    assert.equal(findTech(result.technologyStack, 'Next.js'), undefined,
      'Next.js must NOT be detected in a Vue project');
  });

  // ── Nuxt fixture ─────────────────────────────────────────────────────────

  test('Nuxt project fixture → Nuxt detected', () => {
    const dir = makeDir({
      'package.json': JSON.stringify({
        name: 'my-nuxt-app',
        devDependencies: { nuxt: '^3.0.0' },
      }),
      'package-lock.json': '{}',
      'nuxt.config.ts': 'export default defineNuxtConfig({});',
      'app.vue': '<template><NuxtPage /></template>',
    });
    after(() => fs.rmSync(dir, { recursive: true, force: true }));

    const result = scan(dir);
    assert.ok(findTech(result.technologyStack, 'Nuxt'), 'Nuxt must be detected in scan result');
  });

  // ── Angular fixture ──────────────────────────────────────────────────────

  test('Angular project fixture → Angular detected', () => {
    const dir = makeDir({
      'package.json': JSON.stringify({
        name: 'my-angular-app',
        dependencies: {
          '@angular/core': '^17.0.0',
          '@angular/common': '^17.0.0',
        },
        devDependencies: { typescript: '^5.0.0' },
      }),
      'package-lock.json': '{}',
      'angular.json': '{"version":1}',
      'tsconfig.json': '{"compilerOptions":{}}',
      'src/app/app.component.ts': 'import { Component } from "@angular/core";',
    });
    after(() => fs.rmSync(dir, { recursive: true, force: true }));

    const result = scan(dir);
    assert.ok(findTech(result.technologyStack, 'Angular'), 'Angular must be detected in scan result');
    assert.equal(findTech(result.technologyStack, 'Angular')?.category, 'frontend');
  });

  // ── Svelte fixture ───────────────────────────────────────────────────────

  test('Svelte project fixture → Svelte detected', () => {
    const dir = makeDir({
      'package.json': JSON.stringify({
        name: 'my-svelte-app',
        devDependencies: { svelte: '^4.0.0', vite: '^5.0.0' },
      }),
      'package-lock.json': '{}',
      'src/App.svelte': '<script>let count = 0;</script><p>{count}</p>',
      'src/main.js': 'import App from "./App.svelte";',
    });
    after(() => fs.rmSync(dir, { recursive: true, force: true }));

    const result = scan(dir);
    assert.ok(findTech(result.technologyStack, 'Svelte'), 'Svelte must be detected in scan result');
  });

  // ── Astro fixture ────────────────────────────────────────────────────────

  test('Astro project fixture → Astro detected', () => {
    const dir = makeDir({
      'package.json': JSON.stringify({
        name: 'my-astro-site',
        devDependencies: { astro: '^4.0.0' },
      }),
      'package-lock.json': '{}',
      'astro.config.mjs': 'export default {};',
      'src/pages/index.astro': '---\n---\n<html><body>Hello</body></html>',
    });
    after(() => fs.rmSync(dir, { recursive: true, force: true }));

    const result = scan(dir);
    assert.ok(findTech(result.technologyStack, 'Astro'), 'Astro must be detected in scan result');
  });

  // ── Tailwind fixture ──────────────────────────────────────────────────────

  test('Tailwind CSS fixture → Tailwind detected', () => {
    const dir = makeDir({
      'package.json': JSON.stringify({
        name: 'my-tailwind-app',
        dependencies: { react: '^18.0.0' },
        devDependencies: { tailwindcss: '^3.4.0', typescript: '^5.0.0' },
      }),
      'package-lock.json': '{}',
      'tailwind.config.ts': 'export default { content: ["./src/**/*.tsx"] };',
      'tsconfig.json': '{}',
      'src/App.tsx': 'export default function App() { return <div className="p-4">Hi</div>; }',
    });
    after(() => fs.rmSync(dir, { recursive: true, force: true }));

    const result = scan(dir);
    assert.ok(findTech(result.technologyStack, 'Tailwind CSS'),
      'Tailwind CSS must be detected in scan result');
    assert.equal(findTech(result.technologyStack, 'Tailwind CSS')?.category, 'styling');
  });

});

// ---------------------------------------------------------------------------
// ── SCAN() INTEGRATION — FALSE-POSITIVE FIXTURES ─────────────────────────────
// ---------------------------------------------------------------------------

describe('scan() integration — false-positive fixtures', () => {

  test('project with directory named react/ but no react dep → React NOT detected', () => {
    const dir = makeDir({
      'package.json': JSON.stringify({
        name: 'no-react-here',
        dependencies: { lodash: '^4.17.21' },
      }),
      'package-lock.json': '{}',
      // a directory literally named "react" with non-jsx files
      'react/README.md': '# Some unrelated module named react',
      'react/index.html': '<html></html>',
    });
    after(() => fs.rmSync(dir, { recursive: true, force: true }));

    const result = scan(dir);
    assert.equal(findTech(result.technologyStack, 'React'), undefined,
      'React must NOT be detected when only a react/ directory exists (no dep, no jsx/tsx files)');
  });

  test('project with directory named next/ but no next dep → Next.js NOT detected', () => {
    const dir = makeDir({
      'package.json': JSON.stringify({
        name: 'not-nextjs',
        dependencies: { express: '^4.18.0' },
      }),
      'package-lock.json': '{}',
      'next/server.js': 'module.exports = {};',
      'next/README.md': '# next module',
    });
    after(() => fs.rmSync(dir, { recursive: true, force: true }));

    const result = scan(dir);
    assert.equal(findTech(result.technologyStack, 'Next.js'), undefined,
      'Next.js must NOT be detected when only a next/ directory exists');
  });

  test('README mentioning Next.js but no next dep → Next.js NOT detected', () => {
    const dir = makeDir({
      'package.json': JSON.stringify({
        name: 'my-express-app',
        dependencies: { express: '^4.18.0' },
      }),
      'package-lock.json': '{}',
      'README.md': '# My App\n\nThis is NOT a Next.js app, but this README mentions Next.js.',
    });
    after(() => fs.rmSync(dir, { recursive: true, force: true }));

    const result = scan(dir);
    assert.equal(findTech(result.technologyStack, 'Next.js'), undefined,
      'Next.js must NOT be detected from README content alone');
  });

  test('project with only plain .css files → no styling technology detected', () => {
    const dir = makeDir({
      'package.json': JSON.stringify({ name: 'plain-css-app' }),
      'package-lock.json': '{}',
      'src/styles.css': 'body { margin: 0; }',
      'src/reset.css': '* { box-sizing: border-box; }',
      'public/main.css': 'h1 { color: red; }',
    });
    after(() => fs.rmSync(dir, { recursive: true, force: true }));

    const result = scan(dir);
    const stylingTechs = result.technologyStack.technologies.filter(t => t.category === 'styling');
    assert.equal(stylingTechs.length, 0,
      'Plain CSS files alone must not produce any styling technology detection');
  });

});

// ---------------------------------------------------------------------------
// ── ORDERING: FRONTEND BEFORE STYLING ────────────────────────────────────────
// ---------------------------------------------------------------------------

describe('Category ordering: frontend before styling', () => {

  test('frontend technologies appear before styling technologies in output', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: {
        dependencies: {
          react: '^18.0.0',
          tailwindcss: '^3.4.0',
        },
      },
    }));

    const names = result.technologies.map(t => t.name);
    const reactIdx    = names.indexOf('React');
    const tailwindIdx = names.indexOf('Tailwind CSS');

    assert.ok(reactIdx !== -1,    'React must be detected');
    assert.ok(tailwindIdx !== -1, 'Tailwind CSS must be detected');
    assert.ok(reactIdx < tailwindIdx,
      `React (frontend) must come before Tailwind CSS (styling). Got: ${names}`);
  });

  test('all categories are properly ordered: language → frontend → styling', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: {
        dependencies: {
          react: '^18.0.0',
          tailwindcss: '^3.4.0',
        },
        devDependencies: {
          typescript: '^5.0.0',
        },
      },
      configs: ['tsconfig.json'],
    }));

    const categories = result.technologies.map(t => t.category);
    const langPositions    = categories.map((c, i) => c === 'language' ? i : -1).filter(i => i >= 0);
    const frontendPositions = categories.map((c, i) => c === 'frontend' ? i : -1).filter(i => i >= 0);
    const stylingPositions  = categories.map((c, i) => c === 'styling'  ? i : -1).filter(i => i >= 0);

    if (langPositions.length > 0 && frontendPositions.length > 0) {
      assert.ok(Math.max(...langPositions) < Math.min(...frontendPositions),
        'All language entries must come before all frontend entries');
    }
    if (frontendPositions.length > 0 && stylingPositions.length > 0) {
      assert.ok(Math.max(...frontendPositions) < Math.min(...stylingPositions),
        'All frontend entries must come before all styling entries');
    }
  });

});
