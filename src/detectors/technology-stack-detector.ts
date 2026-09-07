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
 *  - Confidence is capped at 1.0.
 *  - Technologies below the CONFIDENCE_THRESHOLD (0.60) are suppressed.
 *  - When multiple rules match the same technology, evidence is merged and
 *    confidence is combined (capped), never producing duplicate entries.
 *  - Output is ordered by: category rank → confidence desc → name asc.
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
  manifest:       0.15,
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

  // ── React ─────────────────────────────────────────────────────────────────

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
    tech: 'React',
    category: 'frontend',
    evidenceType: 'file',
    match: ({ flatFiles }) =>
      flatFiles.some(f => /\.(jsx|tsx)$/.test(f)) ? '*.jsx / *.tsx files' : null,
  },

  // ── Next.js ───────────────────────────────────────────────────────────────

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
    tech: 'Next.js',
    category: 'frontend',
    evidenceType: 'directory',
    match: ({ flatFiles }) =>
      flatFiles.some(f => f.startsWith('app/') || f.startsWith('pages/'))
        ? 'app/ or pages/ directory'
        : null,
  },

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
