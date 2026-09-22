/**
 * @fileoverview Tests for detectRelationships() in stack-relationships module.
 *
 * Covers all contract requirements:
 *  1. Empty input → empty output
 *  2. Only one side of a relationship detected → no relationship emitted
 *  3. Both sides detected → correct relationship(s) emitted
 *  4. All relationship kinds work correctly
 *  5. Deduplication — no duplicate (from, relationship, to) triple in output
 *  6. Deterministic ordering — same input always produces same sorted output
 *  7. No mutation — input array is not modified
 *  8. Integration — detectTechnologyStack() result includes relationships field
 */

import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { detectRelationships } from '../dist/detectors/stack-relationships.js';
import { detectTechnologyStack } from '../dist/detectors/technology-stack-detector.js';
import { scan } from '../dist/scanner/scan.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal Technology object for use in tests. */
function tech(name, category = 'other') {
  return {
    name,
    category,
    confidence: 1.0,
    evidence: [{ type: 'dependency', value: name.toLowerCase() }],
  };
}

/** Minimal valid detector context. */
function emptyCtx(overrides = {}) {
  return {
    flatFiles: [],
    configs: [],
    scripts: [],
    packageManager: null,
    projectType: 'Unknown',
    packageManifest: null,
    ...overrides,
  };
}

/** Temp dir helper — writes files, returns the path. */
const tempDirs = [];
function makeDir(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'toren-rel-'));
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

// ---------------------------------------------------------------------------
// 1. Empty input
// ---------------------------------------------------------------------------

describe('detectRelationships — empty input', () => {

  test('empty technologies array → empty relationships array', () => {
    const result = detectRelationships([]);
    assert.ok(Array.isArray(result), 'result must be an array');
    assert.equal(result.length, 0, 'empty input must produce no relationships');
  });

  test('single technology that has no rules → empty array', () => {
    const result = detectRelationships([tech('ESLint', 'quality')]);
    assert.equal(result.length, 0);
  });

});

// ---------------------------------------------------------------------------
// 2. Only one side of a relationship present — NO relationship emitted
// ---------------------------------------------------------------------------

describe('detectRelationships — missing counterpart → no relationship', () => {

  test('Next.js without React → no built-with relationship', () => {
    const result = detectRelationships([tech('Next.js', 'frontend')]);
    assert.equal(result.length, 0,
      'Next.js alone must NOT produce a built-with relationship with React');
  });

  test('React without Next.js → no built-with relationship', () => {
    const result = detectRelationships([tech('React', 'frontend')]);
    const builtWith = result.filter(r => r.relationship === 'built-with');
    assert.equal(builtWith.length, 0);
  });

  test('Prisma without any database → no stores-data-in relationship', () => {
    const result = detectRelationships([tech('Prisma', 'orm')]);
    assert.equal(result.length, 0,
      'Prisma alone must NOT produce a stores-data-in relationship');
  });

  test('PostgreSQL without any ORM → no relationship emitted', () => {
    const result = detectRelationships([tech('PostgreSQL', 'database')]);
    assert.equal(result.length, 0);
  });

  test('Docker Compose without Docker → no uses relationship', () => {
    const result = detectRelationships([tech('Docker Compose', 'container')]);
    assert.equal(result.length, 0,
      'Docker Compose alone must NOT produce a uses relationship with Docker');
  });

  test('Nuxt without Vue → no built-with relationship', () => {
    const result = detectRelationships([tech('Nuxt', 'frontend')]);
    assert.equal(result.length, 0);
  });

  test('SvelteKit without Svelte → no built-with relationship', () => {
    const result = detectRelationships([tech('SvelteKit', 'frontend')]);
    assert.equal(result.length, 0);
  });

  test('Remix without React → no built-with relationship', () => {
    const result = detectRelationships([tech('Remix', 'frontend')]);
    assert.equal(result.length, 0);
  });

  test('Jest without Testing Library → no tested-with relationship', () => {
    const result = detectRelationships([tech('Jest', 'testing')]);
    assert.equal(result.length, 0);
  });

  test('Vitest without Testing Library → no tested-with relationship', () => {
    const result = detectRelationships([tech('Vitest', 'testing')]);
    assert.equal(result.length, 0);
  });

  test('Next.js without Vercel → no deployed-with relationship', () => {
    const result = detectRelationships([tech('Next.js', 'frontend')]);
    const deployed = result.filter(r => r.relationship === 'deployed-with');
    assert.equal(deployed.length, 0);
  });

});

// ---------------------------------------------------------------------------
// 3. Both sides detected → correct relationship emitted
// ---------------------------------------------------------------------------

describe('detectRelationships — both sides present → relationship emitted', () => {

  // built-with
  test('Next.js + React → built-with relationship', () => {
    const result = detectRelationships([
      tech('Next.js', 'frontend'),
      tech('React',   'frontend'),
    ]);
    const rel = result.find(r => r.from === 'Next.js' && r.to === 'React');
    assert.ok(rel, 'Next.js + React must produce a relationship');
    assert.equal(rel.relationship, 'built-with');
  });

  test('Nuxt + Vue → built-with relationship', () => {
    const result = detectRelationships([
      tech('Nuxt', 'frontend'),
      tech('Vue',  'frontend'),
    ]);
    const rel = result.find(r => r.from === 'Nuxt' && r.to === 'Vue');
    assert.ok(rel);
    assert.equal(rel.relationship, 'built-with');
  });

  test('SvelteKit + Svelte → built-with relationship', () => {
    const result = detectRelationships([
      tech('SvelteKit', 'frontend'),
      tech('Svelte',    'frontend'),
    ]);
    const rel = result.find(r => r.from === 'SvelteKit' && r.to === 'Svelte');
    assert.ok(rel);
    assert.equal(rel.relationship, 'built-with');
  });

  test('Remix + React → built-with relationship', () => {
    const result = detectRelationships([
      tech('Remix', 'frontend'),
      tech('React', 'frontend'),
    ]);
    const rel = result.find(r => r.from === 'Remix' && r.to === 'React');
    assert.ok(rel);
    assert.equal(rel.relationship, 'built-with');
  });

  // stores-data-in
  test('Prisma + PostgreSQL → stores-data-in relationship', () => {
    const result = detectRelationships([
      tech('Prisma',     'orm'),
      tech('PostgreSQL', 'database'),
    ]);
    const rel = result.find(r => r.from === 'Prisma' && r.to === 'PostgreSQL');
    assert.ok(rel, 'Prisma + PostgreSQL must produce a relationship');
    assert.equal(rel.relationship, 'stores-data-in');
  });

  test('Prisma + MySQL → stores-data-in relationship', () => {
    const result = detectRelationships([
      tech('Prisma', 'orm'),
      tech('MySQL',  'database'),
    ]);
    const rel = result.find(r => r.from === 'Prisma' && r.to === 'MySQL');
    assert.ok(rel);
    assert.equal(rel.relationship, 'stores-data-in');
  });

  test('Prisma + SQLite → stores-data-in relationship', () => {
    const result = detectRelationships([
      tech('Prisma', 'orm'),
      tech('SQLite', 'database'),
    ]);
    const rel = result.find(r => r.from === 'Prisma' && r.to === 'SQLite');
    assert.ok(rel);
    assert.equal(rel.relationship, 'stores-data-in');
  });

  test('Prisma + MongoDB → stores-data-in relationship', () => {
    const result = detectRelationships([
      tech('Prisma',  'orm'),
      tech('MongoDB', 'database'),
    ]);
    const rel = result.find(r => r.from === 'Prisma' && r.to === 'MongoDB');
    assert.ok(rel);
    assert.equal(rel.relationship, 'stores-data-in');
  });

  test('Drizzle + PostgreSQL → stores-data-in relationship', () => {
    const result = detectRelationships([
      tech('Drizzle',    'orm'),
      tech('PostgreSQL', 'database'),
    ]);
    const rel = result.find(r => r.from === 'Drizzle' && r.to === 'PostgreSQL');
    assert.ok(rel);
    assert.equal(rel.relationship, 'stores-data-in');
  });

  test('TypeORM + PostgreSQL → stores-data-in relationship', () => {
    const result = detectRelationships([
      tech('TypeORM',    'orm'),
      tech('PostgreSQL', 'database'),
    ]);
    const rel = result.find(r => r.from === 'TypeORM' && r.to === 'PostgreSQL');
    assert.ok(rel);
    assert.equal(rel.relationship, 'stores-data-in');
  });

  test('Sequelize + MySQL → stores-data-in relationship', () => {
    const result = detectRelationships([
      tech('Sequelize', 'orm'),
      tech('MySQL',     'database'),
    ]);
    const rel = result.find(r => r.from === 'Sequelize' && r.to === 'MySQL');
    assert.ok(rel);
    assert.equal(rel.relationship, 'stores-data-in');
  });

  // uses
  test('Mongoose + MongoDB → uses relationship', () => {
    const result = detectRelationships([
      tech('Mongoose', 'orm'),
      tech('MongoDB',  'database'),
    ]);
    const rel = result.find(r => r.from === 'Mongoose' && r.to === 'MongoDB');
    assert.ok(rel);
    assert.equal(rel.relationship, 'uses');
  });

  test('Docker Compose + Docker → uses relationship', () => {
    const result = detectRelationships([
      tech('Docker Compose', 'container'),
      tech('Docker',         'container'),
    ]);
    const rel = result.find(r => r.from === 'Docker Compose' && r.to === 'Docker');
    assert.ok(rel);
    assert.equal(rel.relationship, 'uses');
  });

  test('Django ORM + Django → uses relationship', () => {
    const result = detectRelationships([
      tech('Django ORM', 'orm'),
      tech('Django',     'backend'),
    ]);
    const rel = result.find(r => r.from === 'Django ORM' && r.to === 'Django');
    assert.ok(rel);
    assert.equal(rel.relationship, 'uses');
  });

  test('Eloquent + Laravel → uses relationship', () => {
    const result = detectRelationships([
      tech('Eloquent', 'orm'),
      tech('Laravel',  'backend'),
    ]);
    const rel = result.find(r => r.from === 'Eloquent' && r.to === 'Laravel');
    assert.ok(rel);
    assert.equal(rel.relationship, 'uses');
  });

  test('Active Record + Rails → uses relationship', () => {
    const result = detectRelationships([
      tech('Active Record', 'orm'),
      tech('Rails',         'backend'),
    ]);
    const rel = result.find(r => r.from === 'Active Record' && r.to === 'Rails');
    assert.ok(rel);
    assert.equal(rel.relationship, 'uses');
  });

  // styled-with
  test('Next.js + Tailwind CSS → styled-with relationship', () => {
    const result = detectRelationships([
      tech('Next.js',     'frontend'),
      tech('Tailwind CSS', 'styling'),
    ]);
    const rel = result.find(r => r.from === 'Next.js' && r.to === 'Tailwind CSS');
    assert.ok(rel);
    assert.equal(rel.relationship, 'styled-with');
  });

  test('React + Styled Components → styled-with relationship', () => {
    const result = detectRelationships([
      tech('React',             'frontend'),
      tech('Styled Components', 'styling'),
    ]);
    const rel = result.find(r => r.from === 'React' && r.to === 'Styled Components');
    assert.ok(rel);
    assert.equal(rel.relationship, 'styled-with');
  });

  test('React + Emotion → styled-with relationship', () => {
    const result = detectRelationships([
      tech('React',   'frontend'),
      tech('Emotion', 'styling'),
    ]);
    const rel = result.find(r => r.from === 'React' && r.to === 'Emotion');
    assert.ok(rel);
    assert.equal(rel.relationship, 'styled-with');
  });

  // tested-with
  test('Vitest + Testing Library → tested-with relationship', () => {
    const result = detectRelationships([
      tech('Vitest',          'testing'),
      tech('Testing Library', 'testing'),
    ]);
    const rel = result.find(r => r.from === 'Vitest' && r.to === 'Testing Library');
    assert.ok(rel);
    assert.equal(rel.relationship, 'tested-with');
  });

  test('Jest + Testing Library → tested-with relationship', () => {
    const result = detectRelationships([
      tech('Jest',            'testing'),
      tech('Testing Library', 'testing'),
    ]);
    const rel = result.find(r => r.from === 'Jest' && r.to === 'Testing Library');
    assert.ok(rel);
    assert.equal(rel.relationship, 'tested-with');
  });

  // deployed-with
  test('Next.js + Vercel → deployed-with relationship', () => {
    const result = detectRelationships([
      tech('Next.js', 'frontend'),
      tech('Vercel',  'deployment'),
    ]);
    const rel = result.find(r => r.from === 'Next.js' && r.to === 'Vercel');
    assert.ok(rel);
    assert.equal(rel.relationship, 'deployed-with');
  });

  test('Next.js + Netlify → deployed-with relationship', () => {
    const result = detectRelationships([
      tech('Next.js', 'frontend'),
      tech('Netlify', 'deployment'),
    ]);
    const rel = result.find(r => r.from === 'Next.js' && r.to === 'Netlify');
    assert.ok(rel);
    assert.equal(rel.relationship, 'deployed-with');
  });

});

// ---------------------------------------------------------------------------
// 4. Relationship structure
// ---------------------------------------------------------------------------

describe('detectRelationships — relationship object shape', () => {

  test('each relationship has from, to, and relationship fields', () => {
    const result = detectRelationships([
      tech('Next.js', 'frontend'),
      tech('React',   'frontend'),
    ]);
    assert.equal(result.length, 1);
    const [rel] = result;
    assert.ok('from'         in rel, 'must have from field');
    assert.ok('to'           in rel, 'must have to field');
    assert.ok('relationship' in rel, 'must have relationship field');
    assert.equal(typeof rel.from,         'string');
    assert.equal(typeof rel.to,           'string');
    assert.equal(typeof rel.relationship, 'string');
  });

  test('relationship kind is one of the known values', () => {
    const KNOWN_KINDS = new Set([
      'built-with', 'runs-on', 'uses', 'styled-with',
      'stores-data-in', 'tested-with', 'deployed-with',
    ]);
    const result = detectRelationships([
      tech('Next.js',     'frontend'),
      tech('React',       'frontend'),
      tech('Tailwind CSS', 'styling'),
      tech('Prisma',      'orm'),
      tech('PostgreSQL',  'database'),
      tech('Vitest',      'testing'),
      tech('Testing Library', 'testing'),
      tech('Vercel',      'deployment'),
      tech('Docker Compose', 'container'),
      tech('Docker',      'container'),
    ]);
    for (const rel of result) {
      assert.ok(KNOWN_KINDS.has(rel.relationship),
        `unknown relationship kind: "${rel.relationship}"`);
    }
  });

});

// ---------------------------------------------------------------------------
// 5. Deduplication
// ---------------------------------------------------------------------------

describe('detectRelationships — no duplicate relationships', () => {

  test('no (from, relationship, to) triple appears more than once', () => {
    // Use a rich stack that fires many rules
    const technologies = [
      tech('Next.js',        'frontend'),
      tech('React',          'frontend'),
      tech('Tailwind CSS',   'styling'),
      tech('Prisma',         'orm'),
      tech('PostgreSQL',     'database'),
      tech('MySQL',          'database'),
      tech('Vitest',         'testing'),
      tech('Testing Library','testing'),
      tech('Vercel',         'deployment'),
      tech('Docker',         'container'),
      tech('Docker Compose', 'container'),
    ];
    const result = detectRelationships(technologies);
    const seen = new Set();
    for (const rel of result) {
      const key = `${rel.from}|${rel.relationship}|${rel.to}`;
      assert.ok(!seen.has(key), `duplicate relationship: ${key}`);
      seen.add(key);
    }
  });

});

// ---------------------------------------------------------------------------
// 6. Deterministic ordering
// ---------------------------------------------------------------------------

describe('detectRelationships — deterministic ordering', () => {

  test('same input always produces same output in same order', () => {
    const technologies = [
      tech('Next.js',       'frontend'),
      tech('React',         'frontend'),
      tech('Prisma',        'orm'),
      tech('PostgreSQL',    'database'),
      tech('Vitest',        'testing'),
      tech('Testing Library','testing'),
    ];
    const result1 = detectRelationships([...technologies]);
    const result2 = detectRelationships([...technologies].reverse());
    assert.deepEqual(result1, result2,
      'result must be identical regardless of input order');
  });

  test('output is sorted: from asc → relationship asc → to asc', () => {
    const result = detectRelationships([
      tech('Prisma',     'orm'),
      tech('PostgreSQL', 'database'),
      tech('MySQL',      'database'),
      tech('SQLite',     'database'),
    ]);
    for (let i = 0; i < result.length - 1; i++) {
      const a = result[i];
      const b = result[i + 1];
      const fromCmp = a.from.localeCompare(b.from);
      if (fromCmp !== 0) {
        assert.ok(fromCmp < 0, `from order violation at [${i}]: "${a.from}" > "${b.from}"`);
      } else {
        const relCmp = a.relationship.localeCompare(b.relationship);
        if (relCmp !== 0) {
          assert.ok(relCmp < 0, `relationship order violation at [${i}]`);
        } else {
          assert.ok(a.to.localeCompare(b.to) <= 0, `to order violation at [${i}]`);
        }
      }
    }
  });

});

// ---------------------------------------------------------------------------
// 7. No mutation
// ---------------------------------------------------------------------------

describe('detectRelationships — input is not mutated', () => {

  test('input technologies array is not modified', () => {
    const technologies = [
      tech('Next.js', 'frontend'),
      tech('React',   'frontend'),
    ];
    const originalLength = technologies.length;
    const origNames = technologies.map(t => t.name);
    detectRelationships(technologies);
    assert.equal(technologies.length, originalLength);
    assert.deepEqual(technologies.map(t => t.name), origNames);
  });

});

// ---------------------------------------------------------------------------
// 8. Multi-relationship stacks
// ---------------------------------------------------------------------------

describe('detectRelationships — multi-relationship stacks', () => {

  test('Next.js + React + Tailwind CSS + Prisma + PostgreSQL produces multiple relationships', () => {
    const technologies = [
      tech('Next.js',     'frontend'),
      tech('React',       'frontend'),
      tech('Tailwind CSS', 'styling'),
      tech('Prisma',      'orm'),
      tech('PostgreSQL',  'database'),
    ];
    const result = detectRelationships(technologies);
    assert.ok(result.length >= 3, `expected at least 3 relationships, got ${result.length}`);

    const builtWith = result.find(r => r.from === 'Next.js' && r.to === 'React' && r.relationship === 'built-with');
    assert.ok(builtWith, 'Next.js built-with React must be present');

    const styledWith = result.find(r => r.from === 'Next.js' && r.to === 'Tailwind CSS' && r.relationship === 'styled-with');
    assert.ok(styledWith, 'Next.js styled-with Tailwind CSS must be present');

    const storesData = result.find(r => r.from === 'Prisma' && r.to === 'PostgreSQL' && r.relationship === 'stores-data-in');
    assert.ok(storesData, 'Prisma stores-data-in PostgreSQL must be present');
  });

  test('Prisma with multiple databases produces a relationship for each co-detected database', () => {
    const result = detectRelationships([
      tech('Prisma',     'orm'),
      tech('PostgreSQL', 'database'),
      tech('MySQL',      'database'),
    ]);
    const pg    = result.find(r => r.from === 'Prisma' && r.to === 'PostgreSQL');
    const mysql = result.find(r => r.from === 'Prisma' && r.to === 'MySQL');
    assert.ok(pg,    'Prisma + PostgreSQL must be present');
    assert.ok(mysql, 'Prisma + MySQL must be present');
  });

});

// ---------------------------------------------------------------------------
// 9. Integration with detectTechnologyStack()
// ---------------------------------------------------------------------------

describe('detectRelationships — detectTechnologyStack() integration', () => {

  test('detectTechnologyStack result always has a relationships field', () => {
    const result = detectTechnologyStack(emptyCtx());
    assert.ok('relationships' in result, 'relationships must be present on TechnologyStack');
    assert.ok(Array.isArray(result.relationships), 'relationships must be an array');
  });

  test('empty project → relationships is empty array', () => {
    const result = detectTechnologyStack(emptyCtx());
    assert.equal(result.relationships.length, 0);
  });

  test('Next.js + React project → built-with relationship in detectTechnologyStack result', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: {
        dependencies: { next: '^14.0.0', react: '^18.0.0', 'react-dom': '^18.0.0' },
        devDependencies: { typescript: '^5.0.0' },
      },
    }));
    const rel = result.relationships.find(
      r => r.from === 'Next.js' && r.to === 'React' && r.relationship === 'built-with',
    );
    assert.ok(rel, 'Next.js + React must produce built-with in detectTechnologyStack output');
  });

  test('Prisma + PostgreSQL → stores-data-in in detectTechnologyStack result', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: {
        dependencies: { '@prisma/client': '^5.0.0', pg: '^8.0.0' },
        devDependencies: { prisma: '^5.0.0' },
      },
    }));
    const rel = result.relationships.find(
      r => r.from === 'Prisma' && r.to === 'PostgreSQL' && r.relationship === 'stores-data-in',
    );
    assert.ok(rel, 'Prisma + PostgreSQL must produce stores-data-in in detectTechnologyStack output');
  });

  test('scan() result technologyStack always has relationships field', async () => {
    const dir = makeDir({
      'package.json': JSON.stringify({ name: 'test', version: '1.0.0' }),
    });
    const result = await scan(dir);
    assert.ok('relationships' in result.technologyStack);
    assert.ok(Array.isArray(result.technologyStack.relationships));
  });

  test('scan() of a Next.js + React project → built-with relationship present', async () => {
    const dir = makeDir({
      'package.json': JSON.stringify({
        name: 'test-next',
        version: '1.0.0',
        dependencies: { next: '^14.0.0', react: '^18.0.0', 'react-dom': '^18.0.0' },
        devDependencies: { typescript: '^5.0.0' },
      }),
      'tsconfig.json': '{}',
    });
    const result = await scan(dir);
    const rel = result.technologyStack.relationships.find(
      r => r.from === 'Next.js' && r.to === 'React' && r.relationship === 'built-with',
    );
    assert.ok(rel, 'scan() must surface Next.js built-with React relationship');
  });

});
