/**
 * @fileoverview Toren — Stack Summary Generator (v1.1.2)
 *
 * Produces a deterministic, template-based StackSummary from a detected
 * TechnologyStack.  No AI, no LLMs, no external dependencies.
 *
 * Design contract:
 *  - PURELY DATA-DRIVEN: every rule is a static template keyed on detected
 *    technology names and categories.
 *  - GRACEFUL DEGRADATION: no field is ever fabricated.  When information is
 *    missing the corresponding field is absent (headline) or empty ([]).
 *  - DETERMINISTIC: identical TechnologyStack → identical StackSummary.
 *  - ADDITIVE: this module never mutates its input.
 *  - ZERO RUNTIME DEPENDENCIES: imports only from the local types module.
 *
 * Headline construction rules (in priority order):
 *   1.  If a language is detected, use it as the prefix.
 *   2.  Classify the application type from the detected stack:
 *       - "full-stack web application"  → both frontend AND backend frameworks
 *       - "web application"             → frontend frameworks only
 *       - "server application"          → backend frameworks, no frontend
 *       - "application"                 → neither frontend nor backend (just language/tools)
 *   3.  If no language AND no frontend AND no backend → omit headline entirely.
 *
 * The goal is useful context, not a complete sentence for every project.
 *
 * @module detectors/stack-summary
 */

import type { TechnologyStack, StackSummary } from '../types/index.js';

// ---------------------------------------------------------------------------
// Internal constants
// ---------------------------------------------------------------------------

/** Technologies treated as "frontend frameworks" for headline classification. */
const FRONTEND_FRAMEWORKS = new Set([
  'React', 'Next.js', 'Vue', 'Nuxt', 'Angular', 'Svelte', 'SvelteKit',
  'Astro', 'Remix',
]);

/** Technologies treated as "backend frameworks" for headline classification. */
const BACKEND_FRAMEWORKS = new Set([
  'Express', 'Fastify', 'NestJS', 'Koa', 'Hapi',
  'Django', 'Flask', 'FastAPI',
  'Spring Boot',
  'Laravel',
  'Rails',
]);

/** Categories that contribute to the "frameworks" output field. */
const FRAMEWORK_CATEGORIES = new Set(['frontend', 'backend']);

/** Categories that contribute to the "styling" output field. */
const STYLING_CATEGORIES = new Set(['styling']);

/** Categories that contribute to the "data" output field (databases + ORMs). */
const DATA_CATEGORIES = new Set(['database', 'orm']);

/** Categories that contribute to the "testing" output field. */
const TESTING_CATEGORIES = new Set(['testing']);

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a deterministic stack summary from a detected TechnologyStack.
 *
 * @param stack - The already-detected TechnologyStack produced by
 *                detectTechnologyStack(). May be empty (technologies: []).
 * @returns A StackSummary. Always returns a valid object — never throws.
 *
 * @example
 * generateStackSummary({
 *   technologies: [
 *     { name: 'TypeScript', category: 'language',  ... },
 *     { name: 'Next.js',    category: 'frontend',  ... },
 *     { name: 'React',      category: 'frontend',  ... },
 *     { name: 'Tailwind CSS', category: 'styling', ... },
 *     { name: 'Prisma',     category: 'orm',       ... },
 *     { name: 'PostgreSQL', category: 'database',  ... },
 *   ],
 *   relationships: [...],
 * });
 * // →
 * // {
 * //   headline:   'TypeScript web application',
 * //   frameworks: ['Next.js', 'React'],
 * //   styling:    ['Tailwind CSS'],
 * //   data:       ['Prisma', 'PostgreSQL'],
 * //   testing:    [],
 * // }
 */
export function generateStackSummary(stack: TechnologyStack): StackSummary {
  const techs = stack?.technologies ?? [];

  if (techs.length === 0) {
    return { frameworks: [], styling: [], data: [], testing: [] };
  }

  // ── Collect technologies per output field ─────────────────────────────────
  // The input array is already sorted deterministically by the detector
  // (category rank → confidence desc → name asc), so we preserve that order
  // rather than re-sorting here.

  const frameworks: string[] = techs
    .filter(t => FRAMEWORK_CATEGORIES.has(t.category))
    .map(t => t.name);

  const styling: string[] = techs
    .filter(t => STYLING_CATEGORIES.has(t.category))
    .map(t => t.name);

  const data: string[] = techs
    .filter(t => DATA_CATEGORIES.has(t.category))
    .map(t => t.name);

  const testing: string[] = techs
    .filter(t => TESTING_CATEGORIES.has(t.category))
    .map(t => t.name);

  // ── Headline construction ─────────────────────────────────────────────────

  const languageTech = techs.find(t => t.category === 'language');
  const languagePrefix = languageTech ? languageTech.name : null;

  const hasFrontend = techs.some(
    t => t.category === 'frontend' && FRONTEND_FRAMEWORKS.has(t.name),
  );
  const hasBackend = techs.some(
    t => t.category === 'backend' && BACKEND_FRAMEWORKS.has(t.name),
  );

  let appType: string | null = null;
  if (hasFrontend && hasBackend) {
    appType = 'full-stack web application';
  } else if (hasFrontend) {
    appType = 'web application';
  } else if (hasBackend) {
    appType = 'server application';
  } else if (languagePrefix) {
    // Language only — use a minimal fallback so we don't invent a type.
    appType = 'application';
  }

  // Only generate a headline when we have enough signal to say something
  // meaningful. Language-only + "application" would be almost tautological,
  // so we suppress it unless there really is nothing else to say.
  let headline: string | undefined;
  if (languagePrefix && appType) {
    headline = `${languagePrefix} ${appType}`;
  } else if (!languagePrefix && appType && appType !== 'application') {
    // No language detected but clear stack shape — omit language prefix
    headline = appType.charAt(0).toUpperCase() + appType.slice(1);
  }

  const summary: StackSummary = { frameworks, styling, data, testing };
  if (headline) summary.headline = headline;

  return summary;
}
