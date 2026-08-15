/**
 * @fileoverview Toren — JSON Renderer
 *
 * Consumes a ScanResult and produces a stable, consistently-ordered JSON
 * object suitable for programmatic consumption.
 *
 * Design contract (mirrors all other renderers):
 *  - Accepts a ScanResult and an optional options object.
 *  - Never scans files or modifies the data it receives.
 *  - All arrays are always present — never undefined or missing.
 *  - Property order is fixed and documented below.
 *  - Backward compatible: no existing field is removed or renamed.
 *
 * Output property order:
 *  1. meta          — schema version + generator provenance
 *  2. project       — name (basename), path (relative), detected type
 *  3. frameworks    — derived array of detected frameworks ([] when none)
 *  4. entryPoints   — array of detected entry-point paths
 *  5. configs       — array of detected configuration file paths
 *  6. scripts       — array of { name, command } objects
 *  7. statistics    — file/folder counts and scan duration (structured)
 *  8. structure     — recursive file-tree array
 *  9. summary       — retained for backward compatibility (same data as statistics)
 */

import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const pkg     = require('../../package.json');

// ---------------------------------------------------------------------------
// Tree mapper
// ---------------------------------------------------------------------------

/**
 * Recursively map an internal DirNode / FileNode to a clean JSON shape.
 * Directory nodes always include a `children` array (never undefined).
 *
 * @param {import('../scanner/scan.js').DirNode | import('../scanner/scan.js').FileNode} node
 * @returns {{ type: 'folder'|'file', name: string, children?: object[] }}
 */
function mapTree(node) {
  if (node.type === 'directory') {
    return {
      type:     'folder',
      name:     node.name,
      children: (node.children || []).map(mapTree),
    };
  }
  return {
    type: 'file',
    name: node.name,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Derive a `frameworks` array from the scanner's `projectType` string.
 * Returns a single-element array when a framework is detected, empty otherwise.
 * This is a pure presentation decision — no business logic is added.
 *
 * @param {string} projectType
 * @returns {string[]}
 */
function deriveFrameworks(projectType) {
  if (!projectType || projectType === 'Unknown') return [];
  return [projectType];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Render a ScanResult as a stable JSON document to stdout.
 *
 * @param {import('../scanner/scan.js').ScanResult} result
 * @param {{ cwd?: string }} [options]
 */
export function render(result, options = {}) {
  const {
    rootPath,
    projectType,
    entryPoints   = [],
    configs       = [],
    scripts       = [],
    tree,
    flatFiles     = [],
    totalFolders  = 0,
    scanDurationMs,
  } = result;

  const cwd      = options.cwd ?? process.cwd();
  const relRoot   = path.relative(cwd, rootPath) || '.';
  const rootName  = path.basename(rootPath) || relRoot;

  // Shared statistics values — computed once, used in both `statistics` and
  // the backward-compatible `summary` block.
  // Guard against NaN/undefined: JSON.stringify(NaN) produces null, breaking
  // the schema guarantee that durationMs is always a number.
  const totalFiles = flatFiles.length;
  const durationMs = Number.isFinite(scanDurationMs) ? Math.round(scanDurationMs) : 0;

  const output = {
    // 1. Provenance — lets consumers detect schema changes.
    meta: {
      generatedBy: 'Toren',
      version:     pkg.version,
      schema:      1,
    },

    // 2. Project identity — name is the human-readable basename; path is the
    //    relative path used for filesystem resolution.
    project: {
      name: rootName,
      path: relRoot,
      type: projectType,
    },

    // 3. Detected frameworks — always an array.
    frameworks: deriveFrameworks(projectType),

    // 4–6. Discovery results — all arrays, always present, never null.
    entryPoints: Array.isArray(entryPoints) ? entryPoints : [],
    configs:     Array.isArray(configs)     ? configs     : [],
    scripts:     Array.isArray(scripts)     ? scripts     : [],

    // 7. Structured statistics — always a complete object with numeric values.
    //    durationMs is rounded to the nearest millisecond (integer).
    statistics: {
      files:     totalFiles,
      folders:   totalFolders,
      durationMs,
    },

    // 8. File-tree — array of root-level nodes; always present.
    //    Empty array when the scanned directory is empty.
    structure: (tree?.children || []).map(mapTree),

    // 9. Backward-compatible summary block — preserved for existing consumers.
    //    Contains the same data under the original field names.
    summary: {
      totalFiles,
      totalFolders,
      scanDurationMs: durationMs,
    },
  };

  console.log(JSON.stringify(output, null, 2));
}
