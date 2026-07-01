/**
 * @fileoverview Toren — Markdown Renderer
 *
 * Consumes a {@link ScanResult} and writes a polished, GitHub-flavored
 * Markdown report to stdout.
 *
 * Design contract (mirrors all other renderers):
 *  - Accepts a ScanResult and an optional options object.
 *  - Never scans files or modifies the data it receives.
 *  - Produces only plain Markdown — no ANSI codes, no HTML, no emoji.
 *  - All output goes to stdout so users can redirect freely:
 *      toren --format markdown > PROJECT_REPORT.md
 *
 * Sections (in order):
 *  1. Title
 *  2. Project Summary  (table)
 *  3. Entry Points     (list)
 *  4. Folder Structure (fenced code block)
 *  5. Statistics       (table)
 *  6. Scan Information
 *
 * @module renderers/markdown-renderer
 */

import path from 'node:path';

// ---------------------------------------------------------------------------
// Plain-text tree builder (Markdown-safe, no ANSI, no emoji)
// ---------------------------------------------------------------------------

/**
 * Build an in-memory nested tree from a flat list of relative file paths.
 * This avoids repeating the walk already done by the scanner while keeping
 * the markdown renderer completely self-contained.
 *
 * @param {string[]} flatFiles - Relative file paths produced by scan()
 * @returns {{ name: string, type: 'directory'|'file', children: object }[]}
 */
function buildTree(flatFiles) {
  /** @type {{ type: string, children: Record<string, object> }} */
  const root = { type: 'directory', children: {} };

  for (const filePath of flatFiles) {
    const parts = filePath.split(/[/\\]/).filter(Boolean);
    let node = root;

    for (let i = 0; i < parts.length; i++) {
      const part    = parts[i];
      const isLeaf  = i === parts.length - 1;

      if (!node.children[part]) {
        node.children[part] = isLeaf
          ? { type: 'file', name: part }
          : { type: 'directory', name: part, children: {} };
      }
      node = node.children[part];
    }
  }

  return root;
}

/**
 * Recursively serialise a tree node into classic tree-connector lines.
 * Output is plain ASCII — safe for any Markdown renderer.
 *
 * @param {object}   node    - Current tree node
 * @param {string}   prefix  - Accumulated prefix string for indentation
 * @param {boolean}  isLast  - Whether this node is the last sibling
 * @param {string[]} lines   - Accumulator for output lines
 * @param {number}   depth   - Current recursion depth
 * @param {number}   maxDepth - Maximum depth to render
 */
function serializeNode(node, prefix, isLast, lines, depth = 0, maxDepth = 5) {
  if (depth >= maxDepth) return;

  const connector  = isLast ? '└── ' : '├── ';
  const childPad   = isLast ? '    ' : '│   ';
  const label      = node.type === 'directory' ? `${node.name}/` : node.name;

  lines.push(`${prefix}${connector}${label}`);

  if (node.type === 'directory') {
    const children = Object.values(node.children || {}).sort((a, b) => {
      // Directories before files, then alphabetically.
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    // Truncate deep directories with an ellipsis rather than cutting silently.
    if (depth === maxDepth - 1 && children.length > 0) {
      lines.push(`${prefix}${childPad}└── ...`);
      return;
    }

    for (let i = 0; i < children.length; i++) {
      serializeNode(
        children[i],
        prefix + childPad,
        i === children.length - 1,
        lines,
        depth + 1,
        maxDepth,
      );
    }
  }
}

/**
 * Convert a flat file list into a Markdown-safe tree string.
 *
 * @param {string[]} flatFiles
 * @param {string}   rootName - Display name for the root node (e.g. "my-app/")
 * @returns {string}
 */
function buildTreeString(flatFiles, rootName) {
  if (flatFiles.length === 0) return '';

  const root     = buildTree(flatFiles);
  const lines    = [`${rootName}/`];
  const children = Object.values(root.children).sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  for (let i = 0; i < children.length; i++) {
    serializeNode(children[i], '', i === children.length - 1, lines);
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

/**
 * Format a scan duration in milliseconds to a human-readable string.
 *
 * @param {number} ms
 * @returns {string}
 */
function formatDuration(ms) {
  if (ms < 1)     return '< 1 ms';
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)} s`;
  return `${Math.round(ms)} ms`;
}

/**
 * Build a Markdown table from an array of two-element [label, value] pairs.
 * Column widths are padded to keep the source Markdown tidy.
 *
 * @param {[string, string][]} rows
 * @returns {string}
 */
function markdownTable(rows) {
  const colA = Math.max(8, ...rows.map(([k]) => k.length));
  const colB = Math.max(5, ...rows.map(([, v]) => String(v).length));

  const pad  = (s, n) => String(s).padEnd(n);
  const hr   = `|${'-'.repeat(colA + 2)}|${'-'.repeat(colB + 2)}|`;
  const head = `| ${pad('Property', colA)} | ${pad('Value', colB)} |`;
  const body = rows.map(([k, v]) => `| ${pad(k, colA)} | ${pad(v, colB)} |`);

  return [head, hr, ...body].join('\n');
}

/**
 * Build a right-aligned Markdown table (used for statistics).
 *
 * @param {[string, string|number][]} rows
 * @returns {string}
 */
function statsTable(rows) {
  const colA = Math.max(6, ...rows.map(([k])    => k.length));
  const colB = Math.max(5, ...rows.map(([, v])  => String(v).length));

  const padL = (s, n) => String(s).padEnd(n);
  const padR = (s, n) => String(s).padStart(n);
  const hr   = `|${'-'.repeat(colA + 2)}|${'-'.repeat(colB + 1)}:|`;
  const head = `| ${padL('Metric', colA)} | ${padR('Value', colB)} |`;
  const body = rows.map(([k, v]) => `| ${padL(k, colA)} | ${padR(v, colB)} |`);

  return [head, hr, ...body].join('\n');
}

// ---------------------------------------------------------------------------
// Section builders (private — one function per report section)
// ---------------------------------------------------------------------------

/** @param {string[]} out */
function sectionTitle(out) {
  out.push('# Project Analysis Report');
  out.push('');
  out.push('Generated by **Toren** — Codebase Onboarding Intelligence');
  out.push('');
  out.push('---');
}

/**
 * @param {string[]} out
 * @param {import('../scanner/scan.js').ScanResult} result
 * @param {string} relRoot
 */
function sectionSummary(out, result, relRoot) {
  const { projectType, flatFiles, totalFolders } = result;

  out.push('');
  out.push('## Project Summary');
  out.push('');
  out.push(markdownTable([
    ['Project Type', projectType],
    ['Scan Path',    relRoot],
    ['Total Files',  String(flatFiles.length)],
    ['Total Folders', String(totalFolders)],
  ]));
  out.push('');
  out.push('---');
}

/**
 * @param {string[]} out
 * @param {string[]} entryPoints
 */
function sectionEntryPoints(out, entryPoints) {
  out.push('');
  out.push('## Entry Points');
  out.push('');

  if (entryPoints.length === 0) {
    out.push('No entry points detected.');
  } else {
    for (const ep of entryPoints) {
      out.push(`- \`${ep}\``);
    }
  }

  out.push('');
  out.push('---');
}

/**
 * @param {string[]} out
 * @param {string[]} flatFiles
 * @param {string}   rootName
 */
function sectionFolderStructure(out, flatFiles, rootName) {
  out.push('');
  out.push('## Folder Structure');
  out.push('');

  if (flatFiles.length === 0) {
    out.push('No files scanned.');
  } else {
    const tree = buildTreeString(flatFiles, rootName);
    out.push('```text');
    out.push(tree);
    out.push('```');
  }

  out.push('');
  out.push('---');
}

/**
 * @param {string[]} out
 * @param {import('../scanner/scan.js').ScanResult} result
 */
function sectionStatistics(out, result) {
  const { flatFiles, totalFolders, scanDurationMs } = result;

  out.push('');
  out.push('## Statistics');
  out.push('');
  out.push(statsTable([
    ['Files',         flatFiles.length],
    ['Folders',       totalFolders],
    ['Scan Duration', formatDuration(scanDurationMs)],
  ]));
  out.push('');
  out.push('---');
}

/**
 * @param {string[]} out
 */
function sectionScanInfo(out) {
  out.push('');
  out.push('## Scan Information');
  out.push('');
  out.push('Generated by **Toren**');
  out.push('');
  out.push('Output Format: Markdown');
  out.push('');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Render a ScanResult as a GitHub-flavored Markdown report to stdout.
 *
 * All sections are built into an in-memory string array and joined once
 * at the end — a single `console.log` call keeps stdout writes atomic.
 *
 * @param {import('../scanner/scan.js').ScanResult} result
 * @param {{ cwd?: string }} [options]
 */
export function render(result, options = {}) {
  const { rootPath, entryPoints, flatFiles } = result;

  const cwd     = options.cwd ?? process.cwd();
  const relRoot  = path.relative(cwd, rootPath) || '.';
  const rootName = path.basename(rootPath) || relRoot;

  /** @type {string[]} */
  const out = [];

  sectionTitle(out);
  sectionSummary(out, result, relRoot);
  sectionEntryPoints(out, entryPoints);
  sectionFolderStructure(out, flatFiles, rootName);
  sectionStatistics(out, result);
  sectionScanInfo(out);

  console.log(out.join('\n'));
}
