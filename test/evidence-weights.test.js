/**
 * @fileoverview Tests for the centralized evidence-weights module.
 *
 * Verifies:
 *  1. All evidence types have correct weights.
 *  2. Confidence is capped at 1.0.
 *  3. Rounding eliminates floating-point drift.
 *  4. Repeated identical evidence does not double-add weight.
 *  5. getEvidenceWeight returns expected values for all types.
 *  6. evidenceTypeRank produces deterministic ordering.
 *  7. isStrongEvidence correctly identifies strong vs weak types.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  EVIDENCE_WEIGHTS,
  getEvidenceWeight,
  evidenceTypeRank,
  capConfidence,
  isStrongEvidence,
  EVIDENCE_TYPE_ORDER,
  STRONG_EVIDENCE_TYPES,
} from '../dist/detectors/evidence-weights.js';

// ---------------------------------------------------------------------------
// 1. Weight values
// ---------------------------------------------------------------------------

describe('EVIDENCE_WEIGHTS — correct values', () => {

  test('dependency weight is 0.60', () => {
    assert.equal(EVIDENCE_WEIGHTS.dependency, 0.60);
  });

  test('devDependency weight is 0.60', () => {
    assert.equal(EVIDENCE_WEIGHTS.devDependency, 0.60);
  });

  test('peerDependency weight is 0.60', () => {
    assert.equal(EVIDENCE_WEIGHTS.peerDependency, 0.60);
  });

  test('config weight is 0.25', () => {
    assert.equal(EVIDENCE_WEIGHTS.config, 0.25);
  });

  test('file weight is 0.15', () => {
    assert.equal(EVIDENCE_WEIGHTS.file, 0.15);
  });

  test('directory weight is 0.15', () => {
    assert.equal(EVIDENCE_WEIGHTS.directory, 0.15);
  });

  test('script weight is 0.15', () => {
    assert.equal(EVIDENCE_WEIGHTS.script, 0.15);
  });

  test('manifest weight is 0.60', () => {
    assert.equal(EVIDENCE_WEIGHTS.manifest, 0.60);
  });

  test('all 8 evidence types are present', () => {
    const types = Object.keys(EVIDENCE_WEIGHTS);
    assert.equal(types.length, 8);
    const expected = [
      'dependency', 'devDependency', 'peerDependency',
      'config', 'file', 'directory', 'script', 'manifest',
    ];
    for (const t of expected) {
      assert.ok(types.includes(t), `Missing evidence type: ${t}`);
    }
  });

});

// ---------------------------------------------------------------------------
// 2. getEvidenceWeight API
// ---------------------------------------------------------------------------

describe('getEvidenceWeight — API', () => {

  test('getEvidenceWeight("dependency") returns 0.60', () => {
    assert.equal(getEvidenceWeight('dependency'), 0.60);
  });

  test('getEvidenceWeight("devDependency") returns 0.60', () => {
    assert.equal(getEvidenceWeight('devDependency'), 0.60);
  });

  test('getEvidenceWeight("config") returns 0.25', () => {
    assert.equal(getEvidenceWeight('config'), 0.25);
  });

  test('getEvidenceWeight("file") returns 0.15', () => {
    assert.equal(getEvidenceWeight('file'), 0.15);
  });

  test('getEvidenceWeight("directory") returns 0.15', () => {
    assert.equal(getEvidenceWeight('directory'), 0.15);
  });

  test('getEvidenceWeight("script") returns 0.15', () => {
    assert.equal(getEvidenceWeight('script'), 0.15);
  });

  test('getEvidenceWeight("manifest") returns 0.60', () => {
    assert.equal(getEvidenceWeight('manifest'), 0.60);
  });

  test('getEvidenceWeight("peerDependency") returns 0.60', () => {
    assert.equal(getEvidenceWeight('peerDependency'), 0.60);
  });

});

// ---------------------------------------------------------------------------
// 3. Confidence cap and rounding
// ---------------------------------------------------------------------------

describe('capConfidence — capping and rounding', () => {

  test('capConfidence(0.60) = 0.60', () => {
    assert.equal(capConfidence(0.60), 0.60);
  });

  test('capConfidence(0.85) = 0.85', () => {
    assert.equal(capConfidence(0.85), 0.85);
  });

  test('capConfidence(1.0) = 1.0', () => {
    assert.equal(capConfidence(1.0), 1.0);
  });

  test('capConfidence(1.5) is capped at 1.0', () => {
    assert.equal(capConfidence(1.5), 1.0);
  });

  test('capConfidence(2.0) is capped at 1.0', () => {
    assert.equal(capConfidence(2.0), 1.0);
  });

  test('capConfidence(0.0) = 0.0', () => {
    assert.equal(capConfidence(0.0), 0.0);
  });

  test('capConfidence rounds away floating-point drift', () => {
    // 0.1 + 0.2 = 0.30000000000000004 in JS — should be 0.30
    const raw = 0.1 + 0.2;
    const result = capConfidence(raw);
    assert.equal(result, 0.30, `Expected 0.30, got ${result}`);
  });

  test('dep(0.60) + config(0.25) = 0.85 exactly (no drift)', () => {
    const raw = getEvidenceWeight('dependency') + getEvidenceWeight('config');
    const result = capConfidence(raw);
    assert.equal(result, 0.85);
  });

  test('dep(0.60) + config(0.25) + file(0.15) = 1.00 exactly', () => {
    const raw = getEvidenceWeight('dependency') +
                getEvidenceWeight('config') +
                getEvidenceWeight('file');
    const result = capConfidence(raw);
    assert.equal(result, 1.0);
  });

  test('result is always a finite number', () => {
    assert.ok(Number.isFinite(capConfidence(0.75)));
    assert.ok(Number.isFinite(capConfidence(1.5)));
    assert.ok(Number.isFinite(capConfidence(0)));
  });

  test('result is always ≥ 0', () => {
    assert.ok(capConfidence(0) >= 0);
    assert.ok(capConfidence(0.5) >= 0);
  });

  test('result is always ≤ 1', () => {
    assert.ok(capConfidence(99) <= 1);
    assert.ok(capConfidence(0.99) <= 1);
    assert.ok(capConfidence(1.01) <= 1);
  });

});

// ---------------------------------------------------------------------------
// 4. Evidence type ordering
// ---------------------------------------------------------------------------

describe('EVIDENCE_TYPE_ORDER — deterministic rank ordering', () => {

  test('EVIDENCE_TYPE_ORDER contains all 8 evidence types', () => {
    assert.equal(EVIDENCE_TYPE_ORDER.length, 8);
  });

  test('dependency has lower rank than config', () => {
    assert.ok(
      evidenceTypeRank('dependency') < evidenceTypeRank('config'),
      'dependency should come before config',
    );
  });

  test('dependency has lower rank than file', () => {
    assert.ok(
      evidenceTypeRank('dependency') < evidenceTypeRank('file'),
      'dependency should come before file',
    );
  });

  test('config has lower rank than file', () => {
    assert.ok(
      evidenceTypeRank('config') < evidenceTypeRank('file'),
      'config should come before file',
    );
  });

  test('file has lower rank than directory', () => {
    assert.ok(
      evidenceTypeRank('file') < evidenceTypeRank('directory'),
      'file should come before directory',
    );
  });

  test('manifest has lower rank than config', () => {
    assert.ok(
      evidenceTypeRank('manifest') < evidenceTypeRank('config'),
      'manifest should come before config',
    );
  });

  test('evidenceTypeRank returns stable integer for each type', () => {
    for (const type of EVIDENCE_TYPE_ORDER) {
      const rank = evidenceTypeRank(type);
      assert.ok(Number.isInteger(rank), `rank for ${type} must be integer`);
      assert.ok(rank >= 0, `rank for ${type} must be ≥ 0`);
    }
  });

  test('same call always returns same rank (deterministic)', () => {
    assert.equal(evidenceTypeRank('dependency'), evidenceTypeRank('dependency'));
    assert.equal(evidenceTypeRank('config'), evidenceTypeRank('config'));
    assert.equal(evidenceTypeRank('directory'), evidenceTypeRank('directory'));
  });

});

// ---------------------------------------------------------------------------
// 5. Strong evidence identification
// ---------------------------------------------------------------------------

describe('isStrongEvidence — strong vs weak classification', () => {

  test('dependency is strong evidence', () => {
    assert.ok(isStrongEvidence('dependency'));
  });

  test('devDependency is strong evidence', () => {
    assert.ok(isStrongEvidence('devDependency'));
  });

  test('peerDependency is strong evidence', () => {
    assert.ok(isStrongEvidence('peerDependency'));
  });

  test('manifest is strong evidence', () => {
    assert.ok(isStrongEvidence('manifest'));
  });

  test('config is NOT strong evidence', () => {
    assert.ok(!isStrongEvidence('config'));
  });

  test('file is NOT strong evidence', () => {
    assert.ok(!isStrongEvidence('file'));
  });

  test('directory is NOT strong evidence', () => {
    assert.ok(!isStrongEvidence('directory'));
  });

  test('script is NOT strong evidence', () => {
    assert.ok(!isStrongEvidence('script'));
  });

  test('STRONG_EVIDENCE_TYPES set has exactly 4 members', () => {
    assert.equal(STRONG_EVIDENCE_TYPES.size, 4);
  });

});

// ---------------------------------------------------------------------------
// 6. Repeated identical evidence does not inflate score
// ---------------------------------------------------------------------------

describe('Evidence deduplication safety', () => {

  test('adding same weight twice should not exceed 1.0 when already at cap', () => {
    // Simulated: dependency(0.60) + dep again(0.60) = 1.2 → capped at 1.0
    const raw = getEvidenceWeight('dependency') + getEvidenceWeight('dependency');
    const result = capConfidence(raw);
    assert.equal(result, 1.0, 'Double dependency score must be capped at 1.0');
  });

  test('single strong signal alone crosses detection threshold (0.60)', () => {
    const result = capConfidence(getEvidenceWeight('dependency'));
    assert.ok(result >= 0.60, 'Single dependency must cross the 0.60 threshold');
  });

  test('single weak signal alone does NOT cross detection threshold', () => {
    const fileWeight = capConfidence(getEvidenceWeight('file'));
    assert.ok(fileWeight < 0.60, 'File evidence alone (0.15) must be below threshold');

    const dirWeight = capConfidence(getEvidenceWeight('directory'));
    assert.ok(dirWeight < 0.60, 'Directory evidence alone (0.15) must be below threshold');

    const configWeight = capConfidence(getEvidenceWeight('config'));
    assert.ok(configWeight < 0.60, 'Config evidence alone (0.25) must be below threshold');

    const scriptWeight = capConfidence(getEvidenceWeight('script'));
    assert.ok(scriptWeight < 0.60, 'Script evidence alone (0.15) must be below threshold');
  });

  test('two weak signals together do NOT cross detection threshold', () => {
    const twoWeak = capConfidence(getEvidenceWeight('file') + getEvidenceWeight('directory'));
    assert.ok(twoWeak < 0.60, 'Two weak signals (0.15 + 0.15 = 0.30) must not cross threshold');
  });

  test('three weak signals (config + file + dir = 0.55) do NOT cross threshold', () => {
    const threeWeak = capConfidence(
      getEvidenceWeight('config') +
      getEvidenceWeight('file') +
      getEvidenceWeight('directory'),
    );
    assert.ok(threeWeak < 0.60,
      `config(0.25)+file(0.15)+dir(0.15)=${threeWeak} must not cross threshold`);
  });

});
