/**
 * @fileoverview Toren — Technology Stack Relationships (v1.1.2)
 *
 * Provides a static, curated rule table that describes how detected
 * technologies relate to one another, and a pure function that applies
 * those rules to an already-detected technology list.
 *
 * Design contract:
 *  - PURELY DATA-DRIVEN: every relationship entry is a hand-curated,
 *    high-confidence mapping stored as a plain object in RELATIONSHIP_RULES.
 *  - NO INFERENCE: a relationship is only emitted when BOTH the `from`
 *    and `to` technologies are present in the detected list. Finding
 *    "Next.js" will never auto-add "React" to the detected set.
 *  - DETERMINISTIC: given the same `technologies` array, detectRelationships()
 *    always returns the same array in the same order.
 *  - ADDITIVE: this module adds context; it never mutates Technology objects.
 *  - ZERO RUNTIME DEPENDENCIES: only imports from the local types module.
 *  - SMALL INITIAL SET: covers only relationships with very high confidence.
 *    Do not model the full ecosystem here — add rules conservatively.
 *
 * Relationship kinds (see TechnologyRelationshipKind in types/index.ts):
 *   built-with    — meta-framework built on top of a base framework
 *   runs-on       — technology requires a specific runtime
 *   uses          — direct conceptual dependency (ORM→DB driver, Compose→Docker)
 *   styled-with   — UI framework styled using a CSS tool
 *   stores-data-in— ORM / data layer targets a specific database engine
 *   tested-with   — test runner commonly combined with a testing utility
 *   deployed-with — project is configured to deploy to a specific platform
 *
 * Adding new rules:
 *   1. Append an entry to RELATIONSHIP_RULES below.
 *   2. Add at least one unit test in test/stack-relationships.test.js.
 *   3. Keep the rule small and high-confidence; avoid speculative associations.
 *
 * @module detectors/stack-relationships
 */

import type {
  Technology,
  TechnologyRelationship,
  TechnologyRelationshipKind,
} from '../types/index.js';

// ---------------------------------------------------------------------------
// Internal rule shape
// ---------------------------------------------------------------------------

interface RelationshipRule {
  /** Source technology — must exactly match Technology.name. */
  from: string;
  /** Target technology — must exactly match Technology.name. */
  to: string;
  /** Nature of the association. */
  relationship: TechnologyRelationshipKind;
}

// ---------------------------------------------------------------------------
// Static rule table
// ---------------------------------------------------------------------------

/**
 * Hand-curated, high-confidence relationship rules.
 *
 * Rules are evaluated in order; the engine deduplicates automatically,
 * so the order only affects which duplicate is retained (always the first).
 *
 * Keep this list small. Prefer removing an uncertain rule over adding
 * a speculative one — false relationships are worse than missing ones.
 */
const RELATIONSHIP_RULES: readonly RelationshipRule[] = [

  // ── Meta-frameworks (built-with) ──────────────────────────────────────────
  // A meta-framework is built on top of a base UI framework.
  // These are architectural facts, not suggestions.

  { from: 'Next.js',   to: 'React',   relationship: 'built-with' },
  { from: 'Nuxt',      to: 'Vue',     relationship: 'built-with' },
  { from: 'SvelteKit', to: 'Svelte',  relationship: 'built-with' },
  { from: 'Remix',     to: 'React',   relationship: 'built-with' },

  // ── Runtime environments (runs-on) ────────────────────────────────────────
  // Technologies that require a specific runtime to operate.

  { from: 'Next.js',     to: 'Node.js', relationship: 'runs-on' },
  { from: 'NestJS',      to: 'Node.js', relationship: 'runs-on' },
  { from: 'Express',     to: 'Node.js', relationship: 'runs-on' },
  { from: 'Fastify',     to: 'Node.js', relationship: 'runs-on' },
  { from: 'Spring Boot', to: 'Java',    relationship: 'runs-on' },
  { from: 'Django',      to: 'Python',  relationship: 'runs-on' },
  { from: 'Flask',       to: 'Python',  relationship: 'runs-on' },
  { from: 'FastAPI',     to: 'Python',  relationship: 'runs-on' },

  // ── Typing / Language pairings (uses) ─────────────────────────────────────
  // Frameworks paired with modern TypeScript tooling.

  { from: 'Next.js',   to: 'TypeScript', relationship: 'uses' },
  { from: 'NestJS',    to: 'TypeScript', relationship: 'uses' },
  { from: 'Nuxt',      to: 'TypeScript', relationship: 'uses' },
  { from: 'SvelteKit', to: 'TypeScript', relationship: 'uses' },

  // ── ORM → database engine (uses) ──────────────────────────────────────────
  // ORM libraries that are tightly coupled to a single database driver.
  // Mongoose is the canonical MongoDB ODM; Django ORM requires Django's DB
  // layer; Eloquent and Active Record are inseparable from their frameworks.

  { from: 'Mongoose',      to: 'MongoDB', relationship: 'uses' },
  { from: 'Django ORM',    to: 'Django',  relationship: 'uses' },
  { from: 'Eloquent',      to: 'Laravel', relationship: 'uses' },
  { from: 'Active Record', to: 'Rails',   relationship: 'uses' },

  // ── Container orchestration (uses) ────────────────────────────────────────
  // Docker Compose manages Docker containers — it cannot run without Docker.

  { from: 'Docker Compose', to: 'Docker', relationship: 'uses' },

  // ── ORM → database (stores-data-in) ──────────────────────────────────────
  // Multi-database ORMs. Emitted only when the database is also detected
  // (e.g. Prisma + PostgreSQL both appear in the stack).

  // Prisma
  { from: 'Prisma',    to: 'PostgreSQL', relationship: 'stores-data-in' },
  { from: 'Prisma',    to: 'MySQL',      relationship: 'stores-data-in' },
  { from: 'Prisma',    to: 'SQLite',     relationship: 'stores-data-in' },
  { from: 'Prisma',    to: 'MongoDB',    relationship: 'stores-data-in' },
  { from: 'Prisma',    to: 'MariaDB',    relationship: 'stores-data-in' },

  // Drizzle
  { from: 'Drizzle',   to: 'PostgreSQL', relationship: 'stores-data-in' },
  { from: 'Drizzle',   to: 'MySQL',      relationship: 'stores-data-in' },
  { from: 'Drizzle',   to: 'SQLite',     relationship: 'stores-data-in' },

  // TypeORM
  { from: 'TypeORM',   to: 'PostgreSQL', relationship: 'stores-data-in' },
  { from: 'TypeORM',   to: 'MySQL',      relationship: 'stores-data-in' },
  { from: 'TypeORM',   to: 'SQLite',     relationship: 'stores-data-in' },
  { from: 'TypeORM',   to: 'MongoDB',    relationship: 'stores-data-in' },

  // Sequelize
  { from: 'Sequelize', to: 'PostgreSQL', relationship: 'stores-data-in' },
  { from: 'Sequelize', to: 'MySQL',      relationship: 'stores-data-in' },
  { from: 'Sequelize', to: 'SQLite',     relationship: 'stores-data-in' },
  { from: 'Sequelize', to: 'MariaDB',    relationship: 'stores-data-in' },

  // Knex
  { from: 'Knex',      to: 'PostgreSQL', relationship: 'stores-data-in' },
  { from: 'Knex',      to: 'MySQL',      relationship: 'stores-data-in' },
  { from: 'Knex',      to: 'SQLite',     relationship: 'stores-data-in' },

  // ── Styling (styled-with) ─────────────────────────────────────────────────
  // Emitted when a UI framework and a CSS tool are co-detected.
  // Only high-confidence pairings are listed.

  { from: 'Next.js',   to: 'Tailwind CSS',      relationship: 'styled-with' },
  { from: 'Next.js',   to: 'Sass',              relationship: 'styled-with' },
  { from: 'React',     to: 'Tailwind CSS',      relationship: 'styled-with' },
  { from: 'React',     to: 'Styled Components', relationship: 'styled-with' },
  { from: 'React',     to: 'Emotion',           relationship: 'styled-with' },
  { from: 'React',     to: 'Sass',              relationship: 'styled-with' },
  { from: 'Vue',       to: 'Tailwind CSS',      relationship: 'styled-with' },
  { from: 'Vue',       to: 'Sass',              relationship: 'styled-with' },
  { from: 'Nuxt',      to: 'Tailwind CSS',      relationship: 'styled-with' },
  { from: 'SvelteKit', to: 'Tailwind CSS',      relationship: 'styled-with' },
  { from: 'Angular',   to: 'Sass',              relationship: 'styled-with' },
  { from: 'Astro',     to: 'Tailwind CSS',      relationship: 'styled-with' },

  // ── Testing (tested-with) ─────────────────────────────────────────────────
  // Test runners commonly paired with Testing Library utilities.

  { from: 'Vitest', to: 'Testing Library', relationship: 'tested-with' },
  { from: 'Jest',   to: 'Testing Library', relationship: 'tested-with' },

  // Playwright and Cypress are e2e runners that work alongside unit runners.
  { from: 'Playwright', to: 'Vitest', relationship: 'tested-with' },
  { from: 'Playwright', to: 'Jest',   relationship: 'tested-with' },
  { from: 'Cypress',    to: 'Vitest', relationship: 'tested-with' },
  { from: 'Cypress',    to: 'Jest',   relationship: 'tested-with' },

  // ── Deployment (deployed-with) ────────────────────────────────────────────
  // Only emitted when an explicit deployment config file is detected
  // (e.g. vercel.json, netlify.toml, fly.toml) alongside the framework.

  { from: 'Next.js',   to: 'Vercel',  relationship: 'deployed-with' },
  { from: 'Next.js',   to: 'Netlify', relationship: 'deployed-with' },
  { from: 'Nuxt',      to: 'Vercel',  relationship: 'deployed-with' },
  { from: 'SvelteKit', to: 'Vercel',  relationship: 'deployed-with' },
  { from: 'Astro',     to: 'Vercel',  relationship: 'deployed-with' },
  { from: 'Remix',     to: 'Vercel',  relationship: 'deployed-with' },
  { from: 'React',     to: 'Vercel',  relationship: 'deployed-with' },
  { from: 'React',     to: 'Netlify', relationship: 'deployed-with' },

] as const;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Derive relationships between co-detected technologies.
 *
 * For each rule in RELATIONSHIP_RULES, a TechnologyRelationship is emitted
 * ONLY when BOTH `rule.from` and `rule.to` appear in `technologies`.
 * This function never adds technologies to the stack or modifies existing ones.
 *
 * Output is sorted deterministically:
 *   1. `from` ascending (locale)
 *   2. `relationship` ascending (locale)
 *   3. `to` ascending (locale)
 *
 * @param technologies - The already-detected, deduplicated technologies array.
 *                       This is the `TechnologyStack.technologies` produced by
 *                       detectTechnologyStack().
 * @returns A deduplicated, deterministically-sorted array of relationships.
 *          Returns an empty array when no known relationships apply.
 *
 * @example
 * // Next.js and React both detected → relationship emitted
 * detectRelationships([
 *   { name: 'Next.js', ... },
 *   { name: 'React',   ... },
 * ]);
 * // → [{ from: 'Next.js', to: 'React', relationship: 'built-with' }]
 *
 * @example
 * // Next.js detected but React absent → no relationship emitted
 * detectRelationships([{ name: 'Next.js', ... }]);
 * // → []
 */
export function detectRelationships(
  technologies: Technology[],
): TechnologyRelationship[] {
  // Build a fast O(1) lookup set of detected technology names.
  const detected = new Set(technologies.map(t => t.name));

  // Accumulate matching relationships, deduplicating via a string key.
  const seen = new Set<string>();
  const result: TechnologyRelationship[] = [];

  for (const rule of RELATIONSHIP_RULES) {
    // Both ends of the relationship must be present in the detected set.
    if (!detected.has(rule.from) || !detected.has(rule.to)) continue;

    // Deduplicate — a (from, relationship, to) triple may only appear once.
    const key = `${rule.from}\x00${rule.relationship}\x00${rule.to}`;
    if (seen.has(key)) continue;
    seen.add(key);

    result.push({
      from:         rule.from,
      to:           rule.to,
      relationship: rule.relationship,
    });
  }

  // Deterministic sort: from asc → relationship asc → to asc.
  result.sort((a, b) => {
    const fromCmp = a.from.localeCompare(b.from);
    if (fromCmp !== 0) return fromCmp;
    const relCmp = a.relationship.localeCompare(b.relationship);
    if (relCmp !== 0) return relCmp;
    return a.to.localeCompare(b.to);
  });

  return result;
}
