/**
 * @fileoverview Toren — Centralized Evidence Weight Model (v1.1.1)
 *
 * Single source of truth for evidence confidence contributions.
 * All technology detection rules MUST reference these weights rather than
 * embedding raw numbers independently.
 *
 * Design principles:
 *  - Deterministic: same evidence always yields the same weight.
 *  - Strongly typed: TechnologyEvidenceType is the key.
 *  - Immutable: `as const` prevents accidental mutation.
 *  - Capped externally: callers cap the total at 1.0 via `capConfidence()`.
 *  - Zero runtime dependencies.
 *
 * Evidence strength tiers:
 *  STRONG   (≥ 0.60): dependency, devDependency, peerDependency, manifest
 *    - A single strong signal alone crosses the 0.60 detection threshold.
 *    - Suitable for package.json entries and canonical manifest files.
 *  MODERATE (0.20–0.25): config, script
 *    - Provides meaningful supporting evidence but cannot stand alone.
 *  WEAK     (0.10–0.15): file, directory
 *    - Supplements strong detections but never creates one independently.
 *
 * @module detectors/evidence-weights
 */

import type { TechnologyEvidenceType } from '../types/index.js';

// ---------------------------------------------------------------------------
// Evidence weight table
// ---------------------------------------------------------------------------

/**
 * Confidence contribution for each evidence kind.
 *
 * Values chosen to satisfy the following invariants:
 *  1. One strong signal alone (dep/devDep/peerDep/manifest) crosses 0.60 threshold.
 *  2. One weak signal alone (file/dir) does NOT cross 0.60 threshold.
 *  3. One config alone (0.25) does NOT cross 0.60 threshold.
 *  4. dep(0.60) + config(0.25) = 0.85 — consistent with existing tests.
 *  5. dep(0.60) + config(0.25) + file(0.15) = 1.00 — consistent with existing tests.
 *  6. peerDep(0.55) alone crosses 0.60 — WAIT, 0.55 < 0.60. Let peers be 0.60 too for
 *     backwards compat, or use a nuanced threshold. We keep peerDep = 0.60 for now.
 */
export const EVIDENCE_WEIGHTS = {
  /** Direct runtime dependency in package.json `dependencies`. */
  dependency:      0.60,
  /** Development dependency in package.json `devDependencies`. */
  devDependency:   0.60,
  /** Peer dependency in package.json `peerDependencies`. */
  peerDependency:  0.60,
  /** A recognised framework/tool configuration file (e.g. tailwind.config.ts). */
  config:          0.25,
  /** A specific file whose presence indicates a technology (e.g. schema.prisma). */
  file:            0.15,
  /** A specific directory whose presence supports detection (supplementary only). */
  directory:       0.15,
  /** A package.json script keyword that invokes a tool. */
  script:          0.15,
  /**
   * A non-package.json manifest file (e.g. Dockerfile, Gemfile, manage.py).
   * Treated as strong evidence, equivalent to a direct dependency.
   */
  manifest:        0.60,
} as const satisfies Record<TechnologyEvidenceType, number>;

// ---------------------------------------------------------------------------
// Type helpers
// ---------------------------------------------------------------------------

/** Ordered list of evidence types from strongest to weakest. */
export const EVIDENCE_TYPE_ORDER: TechnologyEvidenceType[] = [
  'dependency',
  'devDependency',
  'peerDependency',
  'manifest',
  'config',
  'script',
  'file',
  'directory',
];

/** Evidence types that are considered "strong" (≥ 0.60 threshold by themselves). */
export const STRONG_EVIDENCE_TYPES = new Set<TechnologyEvidenceType>([
  'dependency',
  'devDependency',
  'peerDependency',
  'manifest',
]);

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

/**
 * Returns the confidence weight for a given evidence type.
 *
 * @param type - The evidence kind to look up.
 * @returns The confidence contribution in the range [0, 1].
 *
 * @example
 * getEvidenceWeight('dependency')   // 0.60
 * getEvidenceWeight('config')       // 0.25
 * getEvidenceWeight('directory')    // 0.15
 */
export function getEvidenceWeight(type: TechnologyEvidenceType): number {
  return EVIDENCE_WEIGHTS[type];
}

/**
 * Returns true if the evidence type is considered "strong" — i.e., a single
 * piece of this evidence alone can cross the detection threshold.
 *
 * @param type - The evidence kind to check.
 */
export function isStrongEvidence(type: TechnologyEvidenceType): boolean {
  return STRONG_EVIDENCE_TYPES.has(type);
}

/**
 * Cap a raw confidence score at exactly 1.0 and round to 2 decimal places
 * to avoid floating-point representation issues (e.g. 0.8500000000000001).
 *
 * Rounding is applied BEFORE the cap so the cap always produces a clean 1.00.
 *
 * @param rawScore - Accumulated raw score (may exceed 1.0).
 * @returns Confidence in [0.00, 1.00] rounded to 2 decimal places.
 */
export function capConfidence(rawScore: number): number {
  // Round to 2 decimal places first to eliminate floating-point drift.
  const rounded = Math.round(rawScore * 100) / 100;
  return Math.min(rounded, 1.0);
}

/**
 * Returns the sort rank for an evidence type used in deterministic ordering.
 * Lower rank = displayed first.
 *
 * Ordering: dependency < devDependency < peerDependency < manifest <
 *           config < script < file < directory
 * Within the same type, values are sorted alphabetically.
 */
export function evidenceTypeRank(type: TechnologyEvidenceType): number {
  const idx = EVIDENCE_TYPE_ORDER.indexOf(type);
  return idx === -1 ? EVIDENCE_TYPE_ORDER.length : idx;
}
