/**
 * @fileoverview Toren — Technology Stack Detector (v1.1.0)
 *
 * Detects the technology stack of a project using pre-collected scan context.
 * Does NOT re-scan the repository or re-read package.json.
 *
 * Design contract:
 *  - Consumes only the data already collected by scan() and passed in context.
 *  - Deterministic: same input always produces the same ordered output.
 *  - Confidence model:
 *      dependency / devDependency  → +0.60 (strong)
 *      config file                 → +0.25 (strong supporting)
 *      file / directory evidence   → +0.15 (supporting)
 *      script keyword              → +0.15 (supporting)
 *      manifest                    → +0.15 (supporting)
 *  - Confidence is capped at 1.0.
 *  - Technologies below the CONFIDENCE_THRESHOLD (0.60) are suppressed.
 *  - When multiple rules match the same technology, evidence is merged and
 *    confidence is combined (capped), never producing duplicate entries.
 *  - Output is ordered by: category rank → confidence desc → name asc.
 *
 * Frontend technologies detected (Step 4):
 *   React, Next.js, Vue, Nuxt, Angular, Svelte, SvelteKit, Astro, Remix
 *
 * Styling technologies detected (Step 4):
 *   Tailwind CSS, Sass, Less, Styled Components, Emotion, Bootstrap,
 *   Material UI, Chakra UI
 *
 * Backend technologies detected (Step 5):
 *   Node.js: Express, Fastify, NestJS, Koa, Hapi
 *   Python:  Django, Flask, FastAPI
 *   Java:    Spring Boot
 *   PHP:     Laravel
 *   Ruby:    Rails
 *
 * Database technologies detected (Step 5):
 *   PostgreSQL, MySQL, MariaDB, SQLite, MongoDB, Redis
 *
 * ORM / data-access tools detected (Step 5):
 *   Prisma, Drizzle, TypeORM, Sequelize, Mongoose, Knex,
 *   SQLAlchemy, Hibernate, Django ORM, Eloquent, Active Record
 *
 * Testing frameworks detected (Step 6):
 *   Jest, Vitest, Mocha, Playwright, Cypress, Testing Library,
 *   Pytest, JUnit
 *
 * Build tools detected (Step 6):
 *   Vite, Webpack, Rollup, esbuild
 *
 * Quality tools detected (Step 6):
 *   ESLint, Prettier, Biome, Stylelint
 *
 * Container tools detected (Step 6):
 *   Docker, Docker Compose
 *
 * Deployment tools detected (Step 6):
 *   Vercel, Netlify, Fly.io, Railway, Render,
 *   Serverless Framework, AWS SAM
 *
 * False-positive / safety guards:
 *   - Directory names alone never trigger framework detection.
 *   - .env / secret files are NEVER read or scanned.
 *   - Database URLs / credentials are NEVER used as evidence.
 *   - ORM is never guessed from database type; each needs its own evidence.
 *   - Plain CSS files are never reported as a technology framework.
 *
 * @module detectors/technology-stack-detector
 */


import type {
  Technology,
  TechnologyStack,
  TechnologyCategory,
  TechnologyEvidenceType,
  TechnologyEvidence,
  PackageManager,
  ScriptInfo,
} from '../types/index.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Minimum confidence required to include a technology in the output. */
const CONFIDENCE_THRESHOLD = 0.60;

/** Confidence contribution per evidence kind. */
const SCORE: Record<TechnologyEvidenceType, number> = {
  dependency:     0.60,
  devDependency:  0.60,
  peerDependency: 0.60,
  config:         0.25,
  file:           0.15,
  directory:      0.15,
  script:         0.15,
  manifest:       0.60,
};

/**
 * Canonical ordering for technology categories.
 * Lower index = listed first in the output.
 */
const CATEGORY_ORDER: TechnologyCategory[] = [
  'language',
  'runtime',
  'package-manager',
  'frontend',
  'backend',
  'styling',
  'database',
  'orm',
  'testing',
  'build',
  'quality',
  'container',
  'deployment',
  'other',
];

// ---------------------------------------------------------------------------
// Context type
// ---------------------------------------------------------------------------

/**
 * All information already collected by scan().
 * The detector reuses this data — it never reads from disk again.
 */
export interface TechnologyDetectorContext {
  /** Flat list of relative file paths (POSIX separators). */
  flatFiles: string[];
  /** Root-level config file names (already detected). */
  configs: string[];
  /** Enriched script entries. */
  scripts: ScriptInfo[];
  /** Detected package manager (or null). */
  packageManager: PackageManager | null;
  /** Detected project type string (e.g. "Next.js", "Node.js / TypeScript"). */
  projectType: string;
  /**
   * Parsed package.json dependencies already available from a prior read.
   * Keyed maps of name → version.
   * Providing this avoids re-reading package.json.
   */
  packageManifest?: {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
  } | null;
  /** Frameworks already detected by project-info-detector. */
  existingFrameworks?: string[];
}

// ---------------------------------------------------------------------------
// Internal accumulator
// ---------------------------------------------------------------------------

/**
 * Mutable accumulator used while building detection results.
 * Keyed by a canonical technology name (lowercase) for deduplication.
 */
interface TechAccumulator {
  name: string;
  category: TechnologyCategory;
  rawScore: number;
  evidence: TechnologyEvidence[];
}

// ---------------------------------------------------------------------------
// Rule definition
// ---------------------------------------------------------------------------

/**
 * A single detection rule.
 * A rule tests one specific signal and, when it matches, contributes evidence
 * to a named technology.
 */
interface TechRule {
  /** Canonical technology name (human-readable, e.g. "Next.js"). */
  tech: string;
  category: TechnologyCategory;
  evidenceType: TechnologyEvidenceType;
  /**
   * Test function: receives the context and returns the matching value
   * (package name, filename, etc.) if the rule fires, or null/undefined
   * if it does not.
   */
  match: (ctx: TechnologyDetectorContext) => string | null | undefined;
}

// ---------------------------------------------------------------------------
// Rule registry
// ---------------------------------------------------------------------------

/**
 * All detection rules, evaluated in order.
 * Add new rules here — the engine handles deduplication automatically.
 *
 * Keep this list small for v1.1.0 (proof-of-concept set).
 * Future steps will add comprehensive rules per category.
 */
const TECH_RULES: TechRule[] = [

  // ── TypeScript ────────────────────────────────────────────────────────────

  {
    tech: 'TypeScript',
    category: 'language',
    evidenceType: 'devDependency',
    match: ({ packageManifest }) =>
      packageManifest?.devDependencies?.['typescript'] ? 'typescript' : null,
  },
  {
    tech: 'TypeScript',
    category: 'language',
    evidenceType: 'dependency',
    match: ({ packageManifest }) =>
      packageManifest?.dependencies?.['typescript'] ? 'typescript' : null,
  },
  {
    tech: 'TypeScript',
    category: 'language',
    evidenceType: 'config',
    match: ({ configs }) =>
      configs.includes('tsconfig.json') ? 'tsconfig.json' : null,
  },
  {
    tech: 'TypeScript',
    category: 'language',
    evidenceType: 'file',
    match: ({ flatFiles }) =>
      flatFiles.some(f => /\.(ts|tsx)$/.test(f) && !f.endsWith('.d.ts'))
        ? '*.ts / *.tsx source files'
        : null,
  },

  // ── JavaScript ───────────────────────────────────────────────────────────

  {
    tech: 'JavaScript',
    category: 'language',
    evidenceType: 'file',
    match: ({ flatFiles }) =>
      flatFiles.some(f => /\.(js|jsx|mjs|cjs)$/.test(f))
        ? '*.js / *.jsx source files'
        : null,
  },
  {
    tech: 'JavaScript',
    category: 'language',
    evidenceType: 'config',
    match: ({ configs }) =>
      configs.includes('jsconfig.json') ? 'jsconfig.json' : null,
  },
  {
    tech: 'JavaScript',
    category: 'language',
    evidenceType: 'manifest',
    match: ({ flatFiles }) =>
      flatFiles.includes('package.json') ? 'package.json' : null,
  },

  // ==========================================================================
  // FRONTEND FRAMEWORKS
  // ==========================================================================

  // ── React ─────────────────────────────────────────────────────────────────
  // False-positive guard: a directory named "react/" alone must NOT trigger this.
  // Evidence must come from package.json deps or explicit .jsx/.tsx files.

  {
    tech: 'React',
    category: 'frontend',
    evidenceType: 'dependency',
    match: ({ packageManifest }) =>
      packageManifest?.dependencies?.['react'] ? 'react' : null,
  },
  {
    tech: 'React',
    category: 'frontend',
    evidenceType: 'devDependency',
    match: ({ packageManifest }) =>
      packageManifest?.devDependencies?.['react'] ? 'react' : null,
  },
  {
    // *.jsx / *.tsx files are supporting evidence only (0.15 alone < threshold).
    tech: 'React',
    category: 'frontend',
    evidenceType: 'file',
    match: ({ flatFiles }) =>
      flatFiles.some(f => /\.(jsx|tsx)$/.test(f)) ? '*.jsx / *.tsx files' : null,
  },

  // ── Next.js ───────────────────────────────────────────────────────────────
  // False-positive guards:
  //   - A directory named "next/" alone must NOT trigger detection.
  //   - README mentions are not used as evidence (no text-scanning rules).
  //   - app/ or pages/ directories are only supporting evidence (< threshold alone).

  {
    tech: 'Next.js',
    category: 'frontend',
    evidenceType: 'dependency',
    match: ({ packageManifest }) =>
      packageManifest?.dependencies?.['next'] ? 'next' : null,
  },
  {
    tech: 'Next.js',
    category: 'frontend',
    evidenceType: 'devDependency',
    match: ({ packageManifest }) =>
      packageManifest?.devDependencies?.['next'] ? 'next' : null,
  },
  {
    tech: 'Next.js',
    category: 'frontend',
    evidenceType: 'config',
    match: ({ configs }) => {
      const found = configs.find(c => /^next\.config\.[a-zA-Z0-9]+$/.test(c));
      return found ?? null;
    },
  },
  {
    // app/ or pages/ are supporting evidence only — not standalone triggers.
    tech: 'Next.js',
    category: 'frontend',
    evidenceType: 'directory',
    match: ({ flatFiles }) =>
      flatFiles.some(f => f.startsWith('app/') || f.startsWith('pages/'))
        ? 'app/ or pages/ directory'
        : null,
  },

  // ── Vue ───────────────────────────────────────────────────────────────────

  {
    tech: 'Vue',
    category: 'frontend',
    evidenceType: 'dependency',
    match: ({ packageManifest }) =>
      packageManifest?.dependencies?.['vue'] ? 'vue' : null,
  },
  {
    tech: 'Vue',
    category: 'frontend',
    evidenceType: 'devDependency',
    match: ({ packageManifest }) =>
      packageManifest?.devDependencies?.['vue'] ? 'vue' : null,
  },
  {
    // *.vue SFC files — supporting evidence only (0.15 alone < threshold).
    tech: 'Vue',
    category: 'frontend',
    evidenceType: 'file',
    match: ({ flatFiles }) =>
      flatFiles.some(f => f.endsWith('.vue')) ? '*.vue single-file components' : null,
  },

  // ── Nuxt ──────────────────────────────────────────────────────────────────

  {
    tech: 'Nuxt',
    category: 'frontend',
    evidenceType: 'dependency',
    match: ({ packageManifest }) =>
      packageManifest?.dependencies?.['nuxt'] ? 'nuxt' : null,
  },
  {
    tech: 'Nuxt',
    category: 'frontend',
    evidenceType: 'devDependency',
    match: ({ packageManifest }) =>
      packageManifest?.devDependencies?.['nuxt'] ? 'nuxt' : null,
  },
  {
    tech: 'Nuxt',
    category: 'frontend',
    evidenceType: 'config',
    match: ({ configs }) => {
      const found = configs.find(c => /^nuxt\.config\.[a-zA-Z0-9]+$/.test(c));
      return found ?? null;
    },
  },

  // ── Angular ───────────────────────────────────────────────────────────────

  {
    tech: 'Angular',
    category: 'frontend',
    evidenceType: 'dependency',
    match: ({ packageManifest }) =>
      packageManifest?.dependencies?.['@angular/core'] ? '@angular/core' : null,
  },
  {
    tech: 'Angular',
    category: 'frontend',
    evidenceType: 'devDependency',
    match: ({ packageManifest }) =>
      packageManifest?.devDependencies?.['@angular/core'] ? '@angular/core' : null,
  },
  {
    tech: 'Angular',
    category: 'frontend',
    evidenceType: 'config',
    match: ({ configs }) =>
      configs.includes('angular.json') ? 'angular.json' : null,
  },

  // ── Svelte ────────────────────────────────────────────────────────────────

  {
    tech: 'Svelte',
    category: 'frontend',
    evidenceType: 'dependency',
    match: ({ packageManifest }) =>
      packageManifest?.dependencies?.['svelte'] ? 'svelte' : null,
  },
  {
    tech: 'Svelte',
    category: 'frontend',
    evidenceType: 'devDependency',
    match: ({ packageManifest }) =>
      packageManifest?.devDependencies?.['svelte'] ? 'svelte' : null,
  },
  {
    // *.svelte files — supporting evidence only (0.15 alone < threshold).
    tech: 'Svelte',
    category: 'frontend',
    evidenceType: 'file',
    match: ({ flatFiles }) =>
      flatFiles.some(f => f.endsWith('.svelte')) ? '*.svelte component files' : null,
  },

  // ── SvelteKit ─────────────────────────────────────────────────────────────
  // SvelteKit is a distinct meta-framework from bare Svelte — detected separately.

  {
    tech: 'SvelteKit',
    category: 'frontend',
    evidenceType: 'dependency',
    match: ({ packageManifest }) =>
      packageManifest?.dependencies?.['@sveltejs/kit'] ? '@sveltejs/kit' : null,
  },
  {
    tech: 'SvelteKit',
    category: 'frontend',
    evidenceType: 'devDependency',
    match: ({ packageManifest }) =>
      packageManifest?.devDependencies?.['@sveltejs/kit'] ? '@sveltejs/kit' : null,
  },
  {
    tech: 'SvelteKit',
    category: 'frontend',
    evidenceType: 'config',
    match: ({ configs }) => {
      const found = configs.find(c => /^svelte\.config\.[a-zA-Z0-9]+$/.test(c));
      return found ?? null;
    },
  },

  // ── Astro ─────────────────────────────────────────────────────────────────

  {
    tech: 'Astro',
    category: 'frontend',
    evidenceType: 'dependency',
    match: ({ packageManifest }) =>
      packageManifest?.dependencies?.['astro'] ? 'astro' : null,
  },
  {
    tech: 'Astro',
    category: 'frontend',
    evidenceType: 'devDependency',
    match: ({ packageManifest }) =>
      packageManifest?.devDependencies?.['astro'] ? 'astro' : null,
  },
  {
    tech: 'Astro',
    category: 'frontend',
    evidenceType: 'config',
    match: ({ configs }) => {
      const found = configs.find(c => /^astro\.config\.[a-zA-Z0-9]+$/.test(c));
      return found ?? null;
    },
  },

  // ── Remix ─────────────────────────────────────────────────────────────────
  // Modern Remix (v2+) uses @remix-run/react + @remix-run/node.

  {
    tech: 'Remix',
    category: 'frontend',
    evidenceType: 'dependency',
    match: ({ packageManifest }) =>
      packageManifest?.dependencies?.['@remix-run/react'] ? '@remix-run/react' : null,
  },
  {
    tech: 'Remix',
    category: 'frontend',
    evidenceType: 'devDependency',
    match: ({ packageManifest }) =>
      packageManifest?.devDependencies?.['@remix-run/react'] ? '@remix-run/react' : null,
  },
  {
    tech: 'Remix',
    category: 'frontend',
    evidenceType: 'dependency',
    match: ({ packageManifest }) =>
      packageManifest?.dependencies?.['@remix-run/node'] ? '@remix-run/node' : null,
  },
  {
    tech: 'Remix',
    category: 'frontend',
    evidenceType: 'devDependency',
    match: ({ packageManifest }) =>
      packageManifest?.devDependencies?.['@remix-run/node'] ? '@remix-run/node' : null,
  },

  // ==========================================================================
  // STYLING
  // ==========================================================================

  // ── Tailwind CSS ──────────────────────────────────────────────────────────

  {
    tech: 'Tailwind CSS',
    category: 'styling',
    evidenceType: 'dependency',
    match: ({ packageManifest }) =>
      packageManifest?.dependencies?.['tailwindcss'] ? 'tailwindcss' : null,
  },
  {
    tech: 'Tailwind CSS',
    category: 'styling',
    evidenceType: 'devDependency',
    match: ({ packageManifest }) =>
      packageManifest?.devDependencies?.['tailwindcss'] ? 'tailwindcss' : null,
  },
  {
    tech: 'Tailwind CSS',
    category: 'styling',
    evidenceType: 'config',
    match: ({ configs }) => {
      const found = configs.find(c => /^tailwind\.config\.[a-zA-Z0-9]+$/.test(c));
      return found ?? null;
    },
  },

  // ── Sass ──────────────────────────────────────────────────────────────────

  {
    tech: 'Sass',
    category: 'styling',
    evidenceType: 'dependency',
    match: ({ packageManifest }) =>
      packageManifest?.dependencies?.['sass'] ? 'sass' : null,
  },
  {
    tech: 'Sass',
    category: 'styling',
    evidenceType: 'devDependency',
    match: ({ packageManifest }) =>
      packageManifest?.devDependencies?.['sass'] ? 'sass' : null,
  },
  {
    // *.scss files — supporting evidence only (0.15 alone < threshold).
    tech: 'Sass',
    category: 'styling',
    evidenceType: 'file',
    match: ({ flatFiles }) =>
      flatFiles.some(f => f.endsWith('.scss')) ? '*.scss stylesheets' : null,
  },

  // ── Less ──────────────────────────────────────────────────────────────────

  {
    tech: 'Less',
    category: 'styling',
    evidenceType: 'dependency',
    match: ({ packageManifest }) =>
      packageManifest?.dependencies?.['less'] ? 'less' : null,
  },
  {
    tech: 'Less',
    category: 'styling',
    evidenceType: 'devDependency',
    match: ({ packageManifest }) =>
      packageManifest?.devDependencies?.['less'] ? 'less' : null,
  },
  {
    tech: 'Less',
    category: 'styling',
    evidenceType: 'file',
    match: ({ flatFiles }) =>
      flatFiles.some(f => f.endsWith('.less')) ? '*.less stylesheets' : null,
  },

  // ── Styled Components ─────────────────────────────────────────────────────

  {
    tech: 'Styled Components',
    category: 'styling',
    evidenceType: 'dependency',
    match: ({ packageManifest }) =>
      packageManifest?.dependencies?.['styled-components'] ? 'styled-components' : null,
  },
  {
    tech: 'Styled Components',
    category: 'styling',
    evidenceType: 'devDependency',
    match: ({ packageManifest }) =>
      packageManifest?.devDependencies?.['styled-components'] ? 'styled-components' : null,
  },

  // ── Emotion ───────────────────────────────────────────────────────────────

  {
    tech: 'Emotion',
    category: 'styling',
    evidenceType: 'dependency',
    match: ({ packageManifest }) =>
      packageManifest?.dependencies?.['@emotion/react'] ? '@emotion/react' : null,
  },
  {
    tech: 'Emotion',
    category: 'styling',
    evidenceType: 'devDependency',
    match: ({ packageManifest }) =>
      packageManifest?.devDependencies?.['@emotion/react'] ? '@emotion/react' : null,
  },

  // ── Bootstrap ─────────────────────────────────────────────────────────────

  {
    tech: 'Bootstrap',
    category: 'styling',
    evidenceType: 'dependency',
    match: ({ packageManifest }) =>
      packageManifest?.dependencies?.['bootstrap'] ? 'bootstrap' : null,
  },
  {
    tech: 'Bootstrap',
    category: 'styling',
    evidenceType: 'devDependency',
    match: ({ packageManifest }) =>
      packageManifest?.devDependencies?.['bootstrap'] ? 'bootstrap' : null,
  },

  // ── Material UI ───────────────────────────────────────────────────────────

  {
    tech: 'Material UI',
    category: 'styling',
    evidenceType: 'dependency',
    match: ({ packageManifest }) =>
      packageManifest?.dependencies?.['@mui/material'] ? '@mui/material' : null,
  },
  {
    tech: 'Material UI',
    category: 'styling',
    evidenceType: 'devDependency',
    match: ({ packageManifest }) =>
      packageManifest?.devDependencies?.['@mui/material'] ? '@mui/material' : null,
  },

  // ── Chakra UI ─────────────────────────────────────────────────────────────

  {
    tech: 'Chakra UI',
    category: 'styling',
    evidenceType: 'dependency',
    match: ({ packageManifest }) =>
      packageManifest?.dependencies?.['@chakra-ui/react'] ? '@chakra-ui/react' : null,
  },
  {
    tech: 'Chakra UI',
    category: 'styling',
    evidenceType: 'devDependency',
    match: ({ packageManifest }) =>
      packageManifest?.devDependencies?.['@chakra-ui/react'] ? '@chakra-ui/react' : null,
  },

  // ==========================================================================
  // BACKEND FRAMEWORKS
  // ==========================================================================
  //
  // Node.js backends: detected via packageManifest deps.
  // Python/Java/PHP/Ruby: detected via flatFiles manifest/config/file signals,
  // since packageManifest is null for non-Node projects.
  //
  // Safety contract:
  //   - .env files are NEVER read or inspected.
  //   - No credentials or connection strings are ever accessed.
  //   - All evidence is structural (file presence, package names).

  // ── Express ───────────────────────────────────────────────────────────────

  {
    tech: 'Express',
    category: 'backend',
    evidenceType: 'dependency',
    match: ({ packageManifest }) =>
      packageManifest?.dependencies?.['express'] ? 'express' : null,
  },
  {
    tech: 'Express',
    category: 'backend',
    evidenceType: 'devDependency',
    match: ({ packageManifest }) =>
      packageManifest?.devDependencies?.['express'] ? 'express' : null,
  },

  // ── Fastify ───────────────────────────────────────────────────────────────

  {
    tech: 'Fastify',
    category: 'backend',
    evidenceType: 'dependency',
    match: ({ packageManifest }) =>
      packageManifest?.dependencies?.['fastify'] ? 'fastify' : null,
  },
  {
    tech: 'Fastify',
    category: 'backend',
    evidenceType: 'devDependency',
    match: ({ packageManifest }) =>
      packageManifest?.devDependencies?.['fastify'] ? 'fastify' : null,
  },

  // ── NestJS ────────────────────────────────────────────────────────────────

  {
    tech: 'NestJS',
    category: 'backend',
    evidenceType: 'dependency',
    match: ({ packageManifest }) =>
      packageManifest?.dependencies?.['@nestjs/core'] ? '@nestjs/core' : null,
  },
  {
    tech: 'NestJS',
    category: 'backend',
    evidenceType: 'devDependency',
    match: ({ packageManifest }) =>
      packageManifest?.devDependencies?.['@nestjs/core'] ? '@nestjs/core' : null,
  },
  {
    // nest-cli.json is a root-level NestJS CLI config file.
    tech: 'NestJS',
    category: 'backend',
    evidenceType: 'config',
    match: ({ flatFiles }) =>
      flatFiles.includes('nest-cli.json') ? 'nest-cli.json' : null,
  },

  // ── Koa ───────────────────────────────────────────────────────────────────

  {
    tech: 'Koa',
    category: 'backend',
    evidenceType: 'dependency',
    match: ({ packageManifest }) =>
      packageManifest?.dependencies?.['koa'] ? 'koa' : null,
  },
  {
    tech: 'Koa',
    category: 'backend',
    evidenceType: 'devDependency',
    match: ({ packageManifest }) =>
      packageManifest?.devDependencies?.['koa'] ? 'koa' : null,
  },

  // ── Hapi ──────────────────────────────────────────────────────────────────

  {
    tech: 'Hapi',
    category: 'backend',
    evidenceType: 'dependency',
    match: ({ packageManifest }) =>
      packageManifest?.dependencies?.['@hapi/hapi'] ? '@hapi/hapi' : null,
  },
  {
    tech: 'Hapi',
    category: 'backend',
    evidenceType: 'devDependency',
    match: ({ packageManifest }) =>
      packageManifest?.devDependencies?.['@hapi/hapi'] ? '@hapi/hapi' : null,
  },

  // ── Django ────────────────────────────────────────────────────────────────
  // manage.py at root is the canonical Django management script. It is
  // generated by `django-admin startproject` and is unique to Django.
  // Treated as manifest-level evidence (0.60) so Django crosses the threshold
  // on its own. settings.py provides additional supporting evidence.

  {
    tech: 'Django',
    category: 'backend',
    evidenceType: 'manifest',
    match: ({ flatFiles }) =>
      flatFiles.includes('manage.py') ? 'manage.py' : null,
  },
  {
    tech: 'Django',
    category: 'backend',
    evidenceType: 'file',
    match: ({ flatFiles }) =>
      flatFiles.some(f => f === 'settings.py' || f.endsWith('/settings.py'))
        ? 'settings.py'
        : null,
  },

  // ── Flask ─────────────────────────────────────────────────────────────────
  // app.py at root + a Python manifest (requirements.txt / pyproject.toml /
  // Pipfile) is treated as manifest-level evidence (0.60).
  // wsgi.py provides additional supporting evidence.

  {
    tech: 'Flask',
    category: 'backend',
    evidenceType: 'manifest',
    match: ({ flatFiles }) => {
      const hasApp = flatFiles.includes('app.py');
      const hasPyManifest =
        flatFiles.includes('requirements.txt') ||
        flatFiles.includes('pyproject.toml') ||
        flatFiles.includes('Pipfile');
      return hasApp && hasPyManifest ? 'app.py' : null;
    },
  },
  {
    tech: 'Flask',
    category: 'backend',
    evidenceType: 'file',
    match: ({ flatFiles }) =>
      flatFiles.some(f => f === 'wsgi.py' || f.endsWith('/wsgi.py'))
        ? 'wsgi.py'
        : null,
  },

  // ── FastAPI ───────────────────────────────────────────────────────────────
  // main.py at root + a Python manifest = manifest-level evidence (0.60).
  // routers/ directory is additional supporting evidence.

  {
    tech: 'FastAPI',
    category: 'backend',
    evidenceType: 'manifest',
    match: ({ flatFiles }) => {
      const hasMain = flatFiles.includes('main.py');
      const hasPyManifest =
        flatFiles.includes('requirements.txt') ||
        flatFiles.includes('pyproject.toml') ||
        flatFiles.includes('Pipfile');
      return hasMain && hasPyManifest ? 'main.py' : null;
    },
  },
  {
    tech: 'FastAPI',
    category: 'backend',
    evidenceType: 'directory',
    match: ({ flatFiles }) =>
      flatFiles.some(f => f.startsWith('routers/') || f.startsWith('app/routers/'))
        ? 'routers/ directory'
        : null,
  },

  // ── Spring Boot ───────────────────────────────────────────────────────────
  // pom.xml and build.gradle are recognised by detectConfigs (root-level only).
  // *Application.java is the canonical Spring Boot entry-point convention.

  {
    tech: 'Spring Boot',
    category: 'backend',
    evidenceType: 'config',
    match: ({ configs }) =>
      configs.includes('pom.xml') ? 'pom.xml' : null,
  },
  {
    tech: 'Spring Boot',
    category: 'backend',
    evidenceType: 'config',
    match: ({ configs }) =>
      configs.includes('build.gradle') || configs.includes('build.gradle.kts')
        ? (configs.includes('build.gradle') ? 'build.gradle' : 'build.gradle.kts')
        : null,
  },
  {
    tech: 'Spring Boot',
    category: 'backend',
    evidenceType: 'file',
    match: ({ flatFiles }) =>
      flatFiles.some(f => f.endsWith('Application.java'))
        ? 'Application.java'
        : null,
  },

  // ── Laravel ───────────────────────────────────────────────────────────────
  // artisan is present in every Laravel project (0.60 manifest).
  // composer.json provides additional PHP-project confirmation.

  {
    tech: 'Laravel',
    category: 'backend',
    evidenceType: 'manifest',
    match: ({ flatFiles }) =>
      flatFiles.includes('artisan') ? 'artisan' : null,
  },
  {
    tech: 'Laravel',
    category: 'backend',
    evidenceType: 'file',
    match: ({ flatFiles }) =>
      flatFiles.includes('composer.json') ? 'composer.json' : null,
  },

  // ── Rails ─────────────────────────────────────────────────────────────────
  // Gemfile (0.60 manifest) + config/routes.rb (0.15 file) = 0.75.

  {
    tech: 'Rails',
    category: 'backend',
    evidenceType: 'manifest',
    match: ({ flatFiles }) =>
      flatFiles.includes('Gemfile') ? 'Gemfile' : null,
  },
  {
    tech: 'Rails',
    category: 'backend',
    evidenceType: 'file',
    match: ({ flatFiles }) =>
      flatFiles.includes('config/routes.rb') ? 'config/routes.rb' : null,
  },

  // ==========================================================================
  // DATABASES
  // ==========================================================================
  //
  // Evidence: package.json deps OR structural config/schema files.
  // Safety: .env files are NEVER read. DATABASE_URL / connection strings are
  //         NEVER used as evidence — only package names and config files.

  // ── PostgreSQL ────────────────────────────────────────────────────────────

  {
    tech: 'PostgreSQL',
    category: 'database',
    evidenceType: 'dependency',
    match: ({ packageManifest }) =>
      packageManifest?.dependencies?.['pg'] ? 'pg' : null,
  },
  {
    tech: 'PostgreSQL',
    category: 'database',
    evidenceType: 'devDependency',
    match: ({ packageManifest }) =>
      packageManifest?.devDependencies?.['pg'] ? 'pg' : null,
  },
  {
    tech: 'PostgreSQL',
    category: 'database',
    evidenceType: 'dependency',
    match: ({ packageManifest }) =>
      packageManifest?.dependencies?.['postgres'] ? 'postgres' : null,
  },
  {
    tech: 'PostgreSQL',
    category: 'database',
    evidenceType: 'dependency',
    match: ({ packageManifest }) =>
      packageManifest?.dependencies?.['@neondatabase/serverless']
        ? '@neondatabase/serverless'
        : null,
  },

  // ── MySQL ─────────────────────────────────────────────────────────────────

  {
    tech: 'MySQL',
    category: 'database',
    evidenceType: 'dependency',
    match: ({ packageManifest }) =>
      packageManifest?.dependencies?.['mysql'] ? 'mysql' : null,
  },
  {
    tech: 'MySQL',
    category: 'database',
    evidenceType: 'dependency',
    match: ({ packageManifest }) =>
      packageManifest?.dependencies?.['mysql2'] ? 'mysql2' : null,
  },
  {
    tech: 'MySQL',
    category: 'database',
    evidenceType: 'devDependency',
    match: ({ packageManifest }) =>
      packageManifest?.devDependencies?.['mysql2'] ? 'mysql2' : null,
  },

  // ── MariaDB ───────────────────────────────────────────────────────────────

  {
    tech: 'MariaDB',
    category: 'database',
    evidenceType: 'dependency',
    match: ({ packageManifest }) =>
      packageManifest?.dependencies?.['mariadb'] ? 'mariadb' : null,
  },
  {
    tech: 'MariaDB',
    category: 'database',
    evidenceType: 'devDependency',
    match: ({ packageManifest }) =>
      packageManifest?.devDependencies?.['mariadb'] ? 'mariadb' : null,
  },

  // ── SQLite ────────────────────────────────────────────────────────────────

  {
    tech: 'SQLite',
    category: 'database',
    evidenceType: 'dependency',
    match: ({ packageManifest }) =>
      packageManifest?.dependencies?.['sqlite3'] ? 'sqlite3' : null,
  },
  {
    tech: 'SQLite',
    category: 'database',
    evidenceType: 'devDependency',
    match: ({ packageManifest }) =>
      packageManifest?.devDependencies?.['sqlite3'] ? 'sqlite3' : null,
  },
  {
    tech: 'SQLite',
    category: 'database',
    evidenceType: 'dependency',
    match: ({ packageManifest }) =>
      packageManifest?.dependencies?.['better-sqlite3'] ? 'better-sqlite3' : null,
  },
  {
    tech: 'SQLite',
    category: 'database',
    evidenceType: 'devDependency',
    match: ({ packageManifest }) =>
      packageManifest?.devDependencies?.['better-sqlite3'] ? 'better-sqlite3' : null,
  },
  {
    tech: 'SQLite',
    category: 'database',
    evidenceType: 'dependency',
    match: ({ packageManifest }) =>
      packageManifest?.dependencies?.['@libsql/client'] ? '@libsql/client' : null,
  },
  {
    // *.db / *.sqlite files are supporting structural evidence.
    tech: 'SQLite',
    category: 'database',
    evidenceType: 'file',
    match: ({ flatFiles }) =>
      flatFiles.some(f => /\.(db|sqlite|sqlite3)$/.test(f))
        ? '*.db / *.sqlite file'
        : null,
  },

  // ── MongoDB ───────────────────────────────────────────────────────────────

  {
    tech: 'MongoDB',
    category: 'database',
    evidenceType: 'dependency',
    match: ({ packageManifest }) =>
      packageManifest?.dependencies?.['mongodb'] ? 'mongodb' : null,
  },
  {
    tech: 'MongoDB',
    category: 'database',
    evidenceType: 'devDependency',
    match: ({ packageManifest }) =>
      packageManifest?.devDependencies?.['mongodb'] ? 'mongodb' : null,
  },

  // ── Redis ─────────────────────────────────────────────────────────────────

  {
    tech: 'Redis',
    category: 'database',
    evidenceType: 'dependency',
    match: ({ packageManifest }) =>
      packageManifest?.dependencies?.['redis'] ? 'redis' : null,
  },
  {
    tech: 'Redis',
    category: 'database',
    evidenceType: 'devDependency',
    match: ({ packageManifest }) =>
      packageManifest?.devDependencies?.['redis'] ? 'redis' : null,
  },
  {
    tech: 'Redis',
    category: 'database',
    evidenceType: 'dependency',
    match: ({ packageManifest }) =>
      packageManifest?.dependencies?.['ioredis'] ? 'ioredis' : null,
  },
  {
    tech: 'Redis',
    category: 'database',
    evidenceType: 'devDependency',
    match: ({ packageManifest }) =>
      packageManifest?.devDependencies?.['ioredis'] ? 'ioredis' : null,
  },

  // ==========================================================================
  // ORM / DATA-ACCESS TOOLS
  // ==========================================================================
  //
  // Each ORM has independent evidence — never inferred from the database type.
  // Schema/config files are detected via presence only; content is never read.

  // ── Prisma ────────────────────────────────────────────────────────────────

  {
    tech: 'Prisma',
    category: 'orm',
    evidenceType: 'dependency',
    match: ({ packageManifest }) =>
      packageManifest?.dependencies?.['@prisma/client'] ? '@prisma/client' : null,
  },
  {
    tech: 'Prisma',
    category: 'orm',
    evidenceType: 'devDependency',
    match: ({ packageManifest }) =>
      packageManifest?.devDependencies?.['prisma'] ? 'prisma' : null,
  },
  {
    tech: 'Prisma',
    category: 'orm',
    evidenceType: 'devDependency',
    match: ({ packageManifest }) =>
      packageManifest?.devDependencies?.['@prisma/client'] ? '@prisma/client' : null,
  },
  {
    // schema.prisma presence is structural evidence — file is NOT read.
    tech: 'Prisma',
    category: 'orm',
    evidenceType: 'file',
    match: ({ flatFiles }) =>
      flatFiles.some(f => f === 'prisma/schema.prisma' || f.endsWith('/schema.prisma'))
        ? 'prisma/schema.prisma'
        : null,
  },

  // ── Drizzle ───────────────────────────────────────────────────────────────

  {
    tech: 'Drizzle',
    category: 'orm',
    evidenceType: 'dependency',
    match: ({ packageManifest }) =>
      packageManifest?.dependencies?.['drizzle-orm'] ? 'drizzle-orm' : null,
  },
  {
    tech: 'Drizzle',
    category: 'orm',
    evidenceType: 'devDependency',
    match: ({ packageManifest }) =>
      packageManifest?.devDependencies?.['drizzle-orm'] ? 'drizzle-orm' : null,
  },
  {
    tech: 'Drizzle',
    category: 'orm',
    evidenceType: 'devDependency',
    match: ({ packageManifest }) =>
      packageManifest?.devDependencies?.['drizzle-kit'] ? 'drizzle-kit' : null,
  },

  // ── TypeORM ───────────────────────────────────────────────────────────────

  {
    tech: 'TypeORM',
    category: 'orm',
    evidenceType: 'dependency',
    match: ({ packageManifest }) =>
      packageManifest?.dependencies?.['typeorm'] ? 'typeorm' : null,
  },
  {
    tech: 'TypeORM',
    category: 'orm',
    evidenceType: 'devDependency',
    match: ({ packageManifest }) =>
      packageManifest?.devDependencies?.['typeorm'] ? 'typeorm' : null,
  },

  // ── Sequelize ─────────────────────────────────────────────────────────────

  {
    tech: 'Sequelize',
    category: 'orm',
    evidenceType: 'dependency',
    match: ({ packageManifest }) =>
      packageManifest?.dependencies?.['sequelize'] ? 'sequelize' : null,
  },
  {
    tech: 'Sequelize',
    category: 'orm',
    evidenceType: 'devDependency',
    match: ({ packageManifest }) =>
      packageManifest?.devDependencies?.['sequelize'] ? 'sequelize' : null,
  },

  // ── Mongoose ──────────────────────────────────────────────────────────────

  {
    tech: 'Mongoose',
    category: 'orm',
    evidenceType: 'dependency',
    match: ({ packageManifest }) =>
      packageManifest?.dependencies?.['mongoose'] ? 'mongoose' : null,
  },
  {
    tech: 'Mongoose',
    category: 'orm',
    evidenceType: 'devDependency',
    match: ({ packageManifest }) =>
      packageManifest?.devDependencies?.['mongoose'] ? 'mongoose' : null,
  },

  // ── Knex ──────────────────────────────────────────────────────────────────

  {
    tech: 'Knex',
    category: 'orm',
    evidenceType: 'dependency',
    match: ({ packageManifest }) =>
      packageManifest?.dependencies?.['knex'] ? 'knex' : null,
  },
  {
    tech: 'Knex',
    category: 'orm',
    evidenceType: 'devDependency',
    match: ({ packageManifest }) =>
      packageManifest?.devDependencies?.['knex'] ? 'knex' : null,
  },

  // ── SQLAlchemy ────────────────────────────────────────────────────────────
  // alembic.ini + Python manifest (requirements.txt / pyproject.toml / Pipfile)
  // = manifest-level evidence (0.60). alembic.ini alone = config (0.25 < threshold).

  {
    tech: 'SQLAlchemy',
    category: 'orm',
    evidenceType: 'config',
    match: ({ flatFiles }) =>
      flatFiles.includes('alembic.ini') ? 'alembic.ini' : null,
  },
  {
    tech: 'SQLAlchemy',
    category: 'orm',
    evidenceType: 'manifest',
    match: ({ flatFiles }) => {
      const hasAlembic = flatFiles.includes('alembic.ini');
      const hasPython =
        flatFiles.includes('requirements.txt') ||
        flatFiles.includes('pyproject.toml') ||
        flatFiles.includes('Pipfile');
      return hasAlembic && hasPython ? 'alembic.ini (SQLAlchemy/Alembic)' : null;
    },
  },

  // ── Hibernate ─────────────────────────────────────────────────────────────
  // persistence.xml (JPA standard) or hibernate.cfg.xml (classic config).
  // pom.xml/build.gradle (0.25 each) + persistence.xml (0.15) = 0.40 < threshold.
  // Use persistence.xml as manifest-level (0.60) when pom.xml is also present.

  {
    tech: 'Hibernate',
    category: 'orm',
    evidenceType: 'manifest',
    match: ({ flatFiles, configs }) => {
      const hasBuildFile = configs.includes('pom.xml') ||
                           configs.includes('build.gradle') ||
                           configs.includes('build.gradle.kts');
      const hasPersistence = flatFiles.some(f => f.endsWith('persistence.xml'));
      return hasBuildFile && hasPersistence ? 'persistence.xml' : null;
    },
  },
  {
    tech: 'Hibernate',
    category: 'orm',
    evidenceType: 'manifest',
    match: ({ flatFiles, configs }) => {
      const hasBuildFile = configs.includes('pom.xml') ||
                           configs.includes('build.gradle') ||
                           configs.includes('build.gradle.kts');
      const hasHibernateCfg = flatFiles.some(f => f.endsWith('hibernate.cfg.xml'));
      return hasBuildFile && hasHibernateCfg ? 'hibernate.cfg.xml' : null;
    },
  },

  // ── Django ORM ────────────────────────────────────────────────────────────
  // models.py + manage.py = manifest-level evidence (0.60).

  {
    tech: 'Django ORM',
    category: 'orm',
    evidenceType: 'manifest',
    match: ({ flatFiles }) => {
      const hasManage = flatFiles.includes('manage.py');
      const hasModels = flatFiles.some(
        f => f === 'models.py' || f.endsWith('/models.py'),
      );
      return hasManage && hasModels ? 'models.py' : null;
    },
  },

  // ── Eloquent ──────────────────────────────────────────────────────────────
  // artisan + app/Models/ directory = manifest-level evidence (0.60).

  {
    tech: 'Eloquent',
    category: 'orm',
    evidenceType: 'manifest',
    match: ({ flatFiles }) => {
      const hasArtisan = flatFiles.includes('artisan');
      const hasModels = flatFiles.some(f => f.startsWith('app/Models/'));
      return hasArtisan && hasModels ? 'app/Models/ (Eloquent)' : null;
    },
  },

  // ── Active Record ─────────────────────────────────────────────────────────
  // Gemfile + db/schema.rb = manifest-level evidence (0.60).

  {
    tech: 'Active Record',
    category: 'orm',
    evidenceType: 'manifest',
    match: ({ flatFiles }) => {
      const hasGemfile = flatFiles.includes('Gemfile');
      const hasSchema = flatFiles.includes('db/schema.rb');
      return hasGemfile && hasSchema ? 'db/schema.rb' : null;
    },
  },

  // ==========================================================================
  // PACKAGE MANAGERS
  // ==========================================================================

  // ── npm ───────────────────────────────────────────────────────────────────

  {
    tech: 'npm',
    category: 'package-manager',
    evidenceType: 'file',
    match: ({ packageManager, flatFiles }) =>
      packageManager === 'npm' || flatFiles.includes('package-lock.json')
        ? 'package-lock.json'
        : null,
  },

  // ── pnpm ──────────────────────────────────────────────────────────────────

  {
    tech: 'pnpm',
    category: 'package-manager',
    evidenceType: 'file',
    match: ({ packageManager, flatFiles }) =>
      packageManager === 'pnpm' || flatFiles.includes('pnpm-lock.yaml')
        ? 'pnpm-lock.yaml'
        : null,
  },

  // ── Yarn ──────────────────────────────────────────────────────────────────

  {
    tech: 'Yarn',
    category: 'package-manager',
    evidenceType: 'file',
    match: ({ packageManager, flatFiles }) =>
      packageManager === 'yarn' || flatFiles.includes('yarn.lock')
        ? 'yarn.lock'
        : null,
  },

  // ── Bun ───────────────────────────────────────────────────────────────────

  {
    tech: 'Bun',
    category: 'package-manager',
    evidenceType: 'file',
    match: ({ packageManager, flatFiles }) =>
      packageManager === 'bun' ||
      flatFiles.includes('bun.lock') ||
      flatFiles.includes('bun.lockb')
        ? (flatFiles.includes('bun.lockb') ? 'bun.lockb' : 'bun.lock')
        : null,
  },
  // ==========================================================================
  // TESTING FRAMEWORKS
  // ==========================================================================
  // ── Jest ─────────────────────────────────────────────────────────────────────
  {
    tech: 'Jest',
    category: 'testing',
    evidenceType: 'dependency',
    match: ({ packageManifest }) =>
      packageManifest?.devDependencies?.['jest'] ? 'jest' : null,
  },
  {
    tech: 'Jest',
    category: 'testing',
    evidenceType: 'dependency',
    match: ({ packageManifest }) =>
      packageManifest?.dependencies?.['jest'] ? 'jest' : null,
  },
  {
    tech: 'Jest',
    category: 'testing',
    evidenceType: 'manifest',
    match: ({ configs }) => {
      const found = configs.find(c => /^jest\.config\.[a-zA-Z0-9]+$/.test(c));
      return found ?? null;
    },
  },
  {
    tech: 'Jest',
    category: 'testing',
    evidenceType: 'script',
    match: ({ scripts }) =>
      scripts.some(s => /\bjest\b/.test(s.command)) ? 'jest script' : null,
  },

  // ── Vitest ────────────────────────────────────────────────────────────────────
  {
    tech: 'Vitest',
    category: 'testing',
    evidenceType: 'devDependency',
    match: ({ packageManifest }) =>
      packageManifest?.devDependencies?.['vitest'] ? 'vitest' : null,
  },
  {
    tech: 'Vitest',
    category: 'testing',
    evidenceType: 'dependency',
    match: ({ packageManifest }) =>
      packageManifest?.dependencies?.['vitest'] ? 'vitest' : null,
  },
  {
    tech: 'Vitest',
    category: 'testing',
    evidenceType: 'manifest',
    match: ({ configs }) => {
      const found = configs.find(c => /^vitest\.config\.[a-zA-Z0-9]+$/.test(c));
      return found ?? null;
    },
  },

  // ── Mocha ────────────────────────────────────────────────────────────────────
  {
    tech: 'Mocha',
    category: 'testing',
    evidenceType: 'devDependency',
    match: ({ packageManifest }) =>
      packageManifest?.devDependencies?.['mocha'] ? 'mocha' : null,
  },
  {
    tech: 'Mocha',
    category: 'testing',
    evidenceType: 'dependency',
    match: ({ packageManifest }) =>
      packageManifest?.dependencies?.['mocha'] ? 'mocha' : null,
  },
  {
    tech: 'Mocha',
    category: 'testing',
    evidenceType: 'manifest',
    match: ({ configs }) =>
      configs.includes('.mocharc.yml') || configs.includes('.mocharc.json') ||
      configs.includes('.mocharc.js') || configs.includes('.mocharc.cjs')
        ? '.mocharc.*'
        : null,
  },

  // ── Playwright ────────────────────────────────────────────────────────────────
  {
    tech: 'Playwright',
    category: 'testing',
    evidenceType: 'devDependency',
    match: ({ packageManifest }) =>
      packageManifest?.devDependencies?.['@playwright/test'] ? '@playwright/test' : null,
  },
  {
    tech: 'Playwright',
    category: 'testing',
    evidenceType: 'dependency',
    match: ({ packageManifest }) =>
      packageManifest?.dependencies?.['@playwright/test'] ? '@playwright/test' : null,
  },
  {
    tech: 'Playwright',
    category: 'testing',
    evidenceType: 'manifest',
    match: ({ configs, flatFiles }) => {
      const found = configs.find(c => /^playwright\.config\.[a-zA-Z0-9]+$/.test(c)) ??
        flatFiles.find(f => /^playwright\.config\.[a-zA-Z0-9]+$/.test(f.split('/').pop() ?? ''));
      return found ? 'playwright.config.*' : null;
    },
  },

  // ── Cypress ────────────────────────────────────────────────────────────────────
  {
    tech: 'Cypress',
    category: 'testing',
    evidenceType: 'devDependency',
    match: ({ packageManifest }) =>
      packageManifest?.devDependencies?.['cypress'] ? 'cypress' : null,
  },
  {
    tech: 'Cypress',
    category: 'testing',
    evidenceType: 'dependency',
    match: ({ packageManifest }) =>
      packageManifest?.dependencies?.['cypress'] ? 'cypress' : null,
  },
  {
    tech: 'Cypress',
    category: 'testing',
    evidenceType: 'manifest',
    match: ({ configs, flatFiles }) => {
      const found = configs.find(c => /^cypress\.config\.[a-zA-Z0-9]+$/.test(c)) ??
        flatFiles.find(f => /^cypress\.config\.[a-zA-Z0-9]+$/.test(f.split('/').pop() ?? ''));
      return found ? 'cypress.config.*' : null;
    },
  },

  // ── Testing Library ──────────────────────────────────────────────────────────
  {
    tech: 'Testing Library',
    category: 'testing',
    evidenceType: 'devDependency',
    match: ({ packageManifest }) => {
      const devDeps = packageManifest?.devDependencies ?? {};
      const found = Object.keys(devDeps).find(k => k.startsWith('@testing-library/'));
      return found ?? null;
    },
  },
  {
    tech: 'Testing Library',
    category: 'testing',
    evidenceType: 'dependency',
    match: ({ packageManifest }) => {
      const deps = packageManifest?.dependencies ?? {};
      const found = Object.keys(deps).find(k => k.startsWith('@testing-library/'));
      return found ?? null;
    },
  },

  // ── Pytest ────────────────────────────────────────────────────────────────────
  // pytest.ini or pyproject.toml + a Python project = manifest evidence (0.60)
  {
    tech: 'Pytest',
    category: 'testing',
    evidenceType: 'manifest',
    match: ({ flatFiles }) => {
      const hasPytest = flatFiles.includes('pytest.ini') || flatFiles.includes('setup.cfg');
      const hasPython = flatFiles.includes('requirements.txt') ||
        flatFiles.includes('pyproject.toml') ||
        flatFiles.includes('Pipfile');
      return hasPytest && hasPython ? 'pytest.ini' : null;
    },
  },
  {
    tech: 'Pytest',
    category: 'testing',
    evidenceType: 'file',
    match: ({ flatFiles }) => {
      // conftest.py is a pytest-specific file
      return flatFiles.some(f => f === 'conftest.py' || f.endsWith('/conftest.py'))
        ? 'conftest.py'
        : null;
    },
  },

  // ── JUnit ────────────────────────────────────────────────────────────────────
  // JUnit is detected via Java build files + test source patterns
  {
    tech: 'JUnit',
    category: 'testing',
    evidenceType: 'manifest',
    match: ({ flatFiles, configs }) => {
      const hasBuild = configs.includes('pom.xml') ||
        configs.includes('build.gradle') ||
        configs.includes('build.gradle.kts');
      const hasTestJava = flatFiles.some(f => f.endsWith('Test.java') || f.endsWith('Tests.java'));
      return hasBuild && hasTestJava ? 'Test.java' : null;
    },
  },

  // ==========================================================================
  // BUILD TOOLS
  // ==========================================================================
  // ── Vite ─────────────────────────────────────────────────────────────────────
  {
    tech: 'Vite',
    category: 'build',
    evidenceType: 'devDependency',
    match: ({ packageManifest }) =>
      packageManifest?.devDependencies?.['vite'] ? 'vite' : null,
  },
  {
    tech: 'Vite',
    category: 'build',
    evidenceType: 'dependency',
    match: ({ packageManifest }) =>
      packageManifest?.dependencies?.['vite'] ? 'vite' : null,
  },
  {
    tech: 'Vite',
    category: 'build',
    evidenceType: 'manifest',
    match: ({ configs }) => {
      const found = configs.find(c => /^vite\.config\.[a-zA-Z0-9]+$/.test(c));
      return found ?? null;
    },
  },

  // ── Webpack ───────────────────────────────────────────────────────────────────
  // IMPORTANT: Only detect explicit usage. Do NOT detect webpack just because
  // a framework may use it internally (e.g. Next.js uses webpack internally).
  {
    tech: 'Webpack',
    category: 'build',
    evidenceType: 'devDependency',
    match: ({ packageManifest }) =>
      packageManifest?.devDependencies?.['webpack'] ? 'webpack' : null,
  },
  {
    tech: 'Webpack',
    category: 'build',
    evidenceType: 'dependency',
    match: ({ packageManifest }) =>
      packageManifest?.dependencies?.['webpack'] ? 'webpack' : null,
  },
  {
    tech: 'Webpack',
    category: 'build',
    evidenceType: 'manifest',
    match: ({ configs, flatFiles }) => {
      const found = configs.find(c => /^webpack\.config\.[a-zA-Z0-9]+$/.test(c)) ??
        flatFiles.find(f => /^webpack\.config\.[a-zA-Z0-9]+$/.test(f.split('/').pop() ?? ''));
      return found ? 'webpack.config.*' : null;
    },
  },

  // ── Rollup ────────────────────────────────────────────────────────────────────
  {
    tech: 'Rollup',
    category: 'build',
    evidenceType: 'devDependency',
    match: ({ packageManifest }) =>
      packageManifest?.devDependencies?.['rollup'] ? 'rollup' : null,
  },
  {
    tech: 'Rollup',
    category: 'build',
    evidenceType: 'dependency',
    match: ({ packageManifest }) =>
      packageManifest?.dependencies?.['rollup'] ? 'rollup' : null,
  },
  {
    tech: 'Rollup',
    category: 'build',
    evidenceType: 'manifest',
    match: ({ configs, flatFiles }) => {
      const found = configs.find(c => /^rollup\.config\.[a-zA-Z0-9]+$/.test(c)) ??
        flatFiles.find(f => /^rollup\.config\.[a-zA-Z0-9]+$/.test(f.split('/').pop() ?? ''));
      return found ? 'rollup.config.*' : null;
    },
  },

  // ── esbuild ───────────────────────────────────────────────────────────────────
  {
    tech: 'esbuild',
    category: 'build',
    evidenceType: 'devDependency',
    match: ({ packageManifest }) =>
      packageManifest?.devDependencies?.['esbuild'] ? 'esbuild' : null,
  },
  {
    tech: 'esbuild',
    category: 'build',
    evidenceType: 'dependency',
    match: ({ packageManifest }) =>
      packageManifest?.dependencies?.['esbuild'] ? 'esbuild' : null,
  },

  // ==========================================================================
  // QUALITY TOOLS
  // ==========================================================================
  // ── ESLint ────────────────────────────────────────────────────────────────────
  {
    tech: 'ESLint',
    category: 'quality',
    evidenceType: 'devDependency',
    match: ({ packageManifest }) =>
      packageManifest?.devDependencies?.['eslint'] ? 'eslint' : null,
  },
  {
    tech: 'ESLint',
    category: 'quality',
    evidenceType: 'dependency',
    match: ({ packageManifest }) =>
      packageManifest?.dependencies?.['eslint'] ? 'eslint' : null,
  },
  {
    tech: 'ESLint',
    category: 'quality',
    evidenceType: 'manifest',
    match: ({ configs, flatFiles }) => {
      // eslint.config.* (flat config, v9+)
      const flatConfig = configs.find(c => /^eslint\.config\.[a-zA-Z0-9]+$/.test(c));
      if (flatConfig) return flatConfig;
      // .eslintrc* legacy configs
      const legacyConfig = flatFiles.find(f => {
        const base = f.split('/').pop() ?? '';
        return /^\.eslintrc(\.json|\.js|\.cjs|\.yml|\.yaml|)$/.test(base);
      });
      return legacyConfig ? '.eslintrc*' : null;
    },
  },

  // ── Prettier ──────────────────────────────────────────────────────────────────
  {
    tech: 'Prettier',
    category: 'quality',
    evidenceType: 'devDependency',
    match: ({ packageManifest }) =>
      packageManifest?.devDependencies?.['prettier'] ? 'prettier' : null,
  },
  {
    tech: 'Prettier',
    category: 'quality',
    evidenceType: 'dependency',
    match: ({ packageManifest }) =>
      packageManifest?.dependencies?.['prettier'] ? 'prettier' : null,
  },
  {
    tech: 'Prettier',
    category: 'quality',
    evidenceType: 'manifest',
    match: ({ flatFiles }) => {
      const found = flatFiles.find(f => {
        const base = f.split('/').pop() ?? '';
        return /^\.prettierrc(\.json|\.js|\.cjs|\.yml|\.yaml|)$/.test(base);
      });
      return found ? '.prettierrc*' : null;
    },
  },

  // ── Biome ────────────────────────────────────────────────────────────────────
  {
    tech: 'Biome',
    category: 'quality',
    evidenceType: 'devDependency',
    match: ({ packageManifest }) =>
      packageManifest?.devDependencies?.['@biomejs/biome'] ? '@biomejs/biome' : null,
  },
  {
    tech: 'Biome',
    category: 'quality',
    evidenceType: 'dependency',
    match: ({ packageManifest }) =>
      packageManifest?.dependencies?.['@biomejs/biome'] ? '@biomejs/biome' : null,
  },
  {
    tech: 'Biome',
    category: 'quality',
    evidenceType: 'manifest',
    match: ({ configs, flatFiles }) =>
      configs.includes('biome.json') || flatFiles.includes('biome.json')
        ? 'biome.json'
        : null,
  },

  // ── Stylelint ─────────────────────────────────────────────────────────────────
  {
    tech: 'Stylelint',
    category: 'quality',
    evidenceType: 'devDependency',
    match: ({ packageManifest }) =>
      packageManifest?.devDependencies?.['stylelint'] ? 'stylelint' : null,
  },
  {
    tech: 'Stylelint',
    category: 'quality',
    evidenceType: 'dependency',
    match: ({ packageManifest }) =>
      packageManifest?.dependencies?.['stylelint'] ? 'stylelint' : null,
  },
  {
    tech: 'Stylelint',
    category: 'quality',
    evidenceType: 'manifest',
    match: ({ flatFiles }) => {
      const found = flatFiles.find(f => {
        const base = f.split('/').pop() ?? '';
        return /^\.stylelintrc(\.json|\.js|\.cjs|\.yml|\.yaml|)$/.test(base) || base === 'stylelint.config.js' || base === 'stylelint.config.cjs';
      });
      return found ? '.stylelintrc*' : null;
    },
  },

  // ==========================================================================
  // CONTAINER
  // ==========================================================================
  // ── Docker ────────────────────────────────────────────────────────────────────
  {
    tech: 'Docker',
    category: 'container',
    evidenceType: 'manifest',
    match: ({ flatFiles }) =>
      flatFiles.some(f => f === 'Dockerfile' || /\/Dockerfile$/.test(f) || /^Dockerfile\.[a-zA-Z0-9]+$/.test(f.split('/').pop() ?? ''))
        ? 'Dockerfile'
        : null,
  },

  // ── Docker Compose ────────────────────────────────────────────────────────────
  {
    tech: 'Docker Compose',
    category: 'container',
    evidenceType: 'manifest',
    match: ({ flatFiles }) =>
      flatFiles.some(f => {
        const base = f.split('/').pop() ?? '';
        return ['docker-compose.yml', 'docker-compose.yaml', 'compose.yml', 'compose.yaml'].includes(base);
      })
        ? 'docker-compose.yml'
        : null,
  },

  // ==========================================================================
  // DEPLOYMENT
  // ==========================================================================
  // ── Vercel ────────────────────────────────────────────────────────────────────
  // Only detect from explicit vercel.json — NOT from Next.js alone.
  {
    tech: 'Vercel',
    category: 'deployment',
    evidenceType: 'manifest',
    match: ({ configs, flatFiles }) =>
      configs.includes('vercel.json') || flatFiles.includes('vercel.json')
        ? 'vercel.json'
        : null,
  },

  // ── Netlify ───────────────────────────────────────────────────────────────────
  {
    tech: 'Netlify',
    category: 'deployment',
    evidenceType: 'manifest',
    match: ({ flatFiles }) =>
      flatFiles.includes('netlify.toml') ? 'netlify.toml' : null,
  },

  // ── Fly.io ────────────────────────────────────────────────────────────────────
  {
    tech: 'Fly.io',
    category: 'deployment',
    evidenceType: 'manifest',
    match: ({ flatFiles }) =>
      flatFiles.includes('fly.toml') ? 'fly.toml' : null,
  },

  // ── Railway ────────────────────────────────────────────────────────────────────
  {
    tech: 'Railway',
    category: 'deployment',
    evidenceType: 'manifest',
    match: ({ flatFiles }) =>
      flatFiles.includes('railway.json') || flatFiles.includes('railway.toml')
        ? (flatFiles.includes('railway.json') ? 'railway.json' : 'railway.toml')
        : null,
  },

  // ── Render ────────────────────────────────────────────────────────────────────
  {
    tech: 'Render',
    category: 'deployment',
    evidenceType: 'manifest',
    match: ({ flatFiles }) =>
      flatFiles.includes('render.yaml') || flatFiles.includes('render.yml')
        ? (flatFiles.includes('render.yaml') ? 'render.yaml' : 'render.yml')
        : null,
  },

  // ── Serverless Framework ──────────────────────────────────────────────────────
  {
    tech: 'Serverless Framework',
    category: 'deployment',
    evidenceType: 'manifest',
    match: ({ flatFiles }) =>
      flatFiles.includes('serverless.yml') || flatFiles.includes('serverless.yaml') ||
      flatFiles.includes('serverless.json') || flatFiles.includes('serverless.ts')
        ? 'serverless.yml'
        : null,
  },

  // ── AWS SAM ───────────────────────────────────────────────────────────────────
  {
    tech: 'AWS SAM',
    category: 'deployment',
    evidenceType: 'manifest',
    match: ({ flatFiles }) =>
      flatFiles.includes('template.yaml') || flatFiles.includes('template.yml')
        ? (flatFiles.includes('template.yaml') ? 'template.yaml' : 'template.yml')
        : null,
  },

];

// ---------------------------------------------------------------------------
// Engine helpers
// ---------------------------------------------------------------------------

/** Normalise a technology name to a stable deduplication key. */
function techKey(name: string): string {
  return name.toLowerCase().replace(/[\s./]/g, '-');
}

/** Compute confidence from raw score, capped at 1.0. */
function toConfidence(rawScore: number): number {
  return Math.min(rawScore, 1.0);
}

/** Category sort rank (lower = first). */
function categoryRank(cat: TechnologyCategory): number {
  const idx = CATEGORY_ORDER.indexOf(cat);
  return idx === -1 ? CATEGORY_ORDER.length : idx;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Detect the technology stack from already-collected scan context.
 *
 * @param context - Pre-collected scan data. No disk I/O is performed.
 * @returns TechnologyStack with deduplicated, ordered, threshold-filtered
 *          technologies.
 */
export function detectTechnologyStack(
  context: TechnologyDetectorContext,
): TechnologyStack {
  // Map from dedup-key → mutable accumulator
  const accumulators = new Map<string, TechAccumulator>();

  for (const rule of TECH_RULES) {
    const matchedValue = rule.match(context);
    if (matchedValue == null) continue; // rule did not fire

    const key = techKey(rule.tech);
    const evidence: TechnologyEvidence = {
      type:  rule.evidenceType,
      value: matchedValue,
    };
    const scoreContribution = SCORE[rule.evidenceType];

    const existing = accumulators.get(key);
    if (existing) {
      // Merge: accumulate score and evidence (avoid duplicate evidence entries)
      existing.rawScore += scoreContribution;
      const alreadyHas = existing.evidence.some(
        e => e.type === evidence.type && e.value === evidence.value,
      );
      if (!alreadyHas) {
        existing.evidence.push(evidence);
      }
    } else {
      accumulators.set(key, {
        name:     rule.tech,
        category: rule.category,
        rawScore: scoreContribution,
        evidence: [evidence],
      });
    }
  }

  // Build Technology objects, applying confidence threshold
  const technologies: Technology[] = [];

  for (const acc of accumulators.values()) {
    const confidence = toConfidence(acc.rawScore);
    if (confidence < CONFIDENCE_THRESHOLD) continue; // suppress weak guesses

    technologies.push({
      name:       acc.name,
      category:   acc.category,
      confidence,
      evidence:   acc.evidence,
    });
  }

  // Deterministic ordering:
  //   1. Category rank (ascending)
  //   2. Confidence (descending)
  //   3. Name (ascending, alphabetical tie-breaker)
  technologies.sort((a, b) => {
    const catDiff = categoryRank(a.category) - categoryRank(b.category);
    if (catDiff !== 0) return catDiff;

    const confDiff = b.confidence - a.confidence;
    if (confDiff !== 0) return confDiff;

    return a.name.localeCompare(b.name);
  });

  return { technologies };
}
