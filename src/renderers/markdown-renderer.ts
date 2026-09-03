import type { ScanResult, DirNode, TreeNode, FileNode, ScriptInfo, ImportantFile, HealthObservation } from "../types/index.js";
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
function serializeNode(node: DirNode | FileNode | TreeNode, prefix: string, isLast: boolean, lines: string[], depth = 0, maxDepth = 5): void {
  if (depth >= maxDepth) return;

  const connector  = isLast ? '└── ' : '├── ';
  const childPad   = isLast ? '    ' : '│   ';
  const label      = node.type === 'directory' ? `${node.name}/` : node.name;

  lines.push(`${prefix}${connector}${label}`);

  if (node.type === 'directory') {
    const children = node.children || [];

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
 * Convert a ScanResult tree into a Markdown-safe tree string.
 *
 * @param {import('../scanner/scan.js').DirNode} tree
 * @param {string}   rootName - Display name for the root node (e.g. "my-app/")
 * @param {number}   totalFiles
 * @returns {string}
 */
function buildTreeString(tree: DirNode, rootName: string, totalFiles: number): string {
  if (totalFiles === 0) return '';

  const lines    = [`${rootName}/`];
  const children = tree.children || [];

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
function formatDuration(ms: number): string {
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
function markdownTable(rows: string[][]): string {
  const colA = Math.max(8, ...rows.map(([k]) => k.length));
  const colB = Math.max(5, ...rows.map(([, v]) => String(v).length));

  const pad  = (s: any, n: number) => String(s).padEnd(n);
  const hr   = `|${'-'.repeat(colA + 2)}|${'-'.repeat(colB + 2)}|`;
  const head = `| ${pad('Property', colA)} | ${pad('Value', colB)} |`;
  const body = rows.map(([k, v]) => `| ${pad(k, colA)} | ${pad(v, colB)} |`);

  return [head, hr, ...body].join('\n');
}

/**
 * Derive a frameworks array from the projectType string.
 * Returns [] when no specific framework is detected.
 * Mirrors the identical derivation in console-renderer.js and json-renderer.js.
 *
 * @param {string} projectType
 * @returns {string[]}
 */
function deriveFrameworks(projectType: string): string[] {
  if (!projectType || projectType === 'Unknown') return [];
  return [projectType];
}

/**
 * Build a right-aligned Markdown table (used for statistics).
 *
 * @param {[string, string|number][]} rows
 * @returns {string}
 */
function statsTable(rows: string[][]): string {
  const colA = Math.max(6, ...rows.map(([k])    => k.length));
  const colB = Math.max(5, ...rows.map(([, v])  => String(v).length));

  const padL = (s: any, n: number) => String(s).padEnd(n);
  const padR = (s: any, n: number) => String(s).padStart(n);
  const hr   = `|${'-'.repeat(colA + 2)}|${'-'.repeat(colB + 1)}:|`;
  const head = `| ${padL('Metric', colA)} | ${padR('Value', colB)} |`;
  const body = rows.map(([k, v]) => `| ${padL(k, colA)} | ${padR(v, colB)} |`);

  return [head, hr, ...body].join('\n');
}

// ---------------------------------------------------------------------------
// Section builders (private — one function per report section)
// ---------------------------------------------------------------------------

/** @param {string[]} out */
function sectionTitle(out: string[]): void {
  out.push('# Toren Report');
  out.push('');
  out.push('Generated by **Toren** — Codebase Onboarding Intelligence');
}

/**
 * @param {string[]} out
 * @param {import('../scanner/scan.js').ScanResult} result
 * @param {string} relRoot
 */
function sectionSummary(out: string[], result: ScanResult, relRoot: string): void {
  const { projectType, flatFiles, totalFolders, packageManager, projectInfo } = result;

  out.push('');
  out.push('## Project');
  out.push('');
  
  const rows = [];
  if (projectInfo && projectInfo.name) rows.push(['Name', projectInfo.name]);
  rows.push(['Project Type', projectType]);
  if (packageManager) rows.push(['Package Manager', packageManager]);
  if (projectInfo && projectInfo.runtime) rows.push(['Runtime', projectInfo.runtime]);
  if (projectInfo && projectInfo.language) rows.push(['Language', projectInfo.language]);
  if (projectInfo && projectInfo.architecture) rows.push(['Architecture', projectInfo.architecture]);
  if (projectInfo && projectInfo.framework) rows.push(['Framework', projectInfo.framework]);
  if (projectInfo && projectInfo.entryPoint) rows.push(['Entry Point', projectInfo.entryPoint]);
  if (projectInfo && projectInfo.sourceDirectory) rows.push(['Source Directory', projectInfo.sourceDirectory]);

  rows.push(['Scan Path', relRoot]);
  rows.push(['Total Files', String(flatFiles.length)]);
  rows.push(['Total Folders', String(totalFolders)]);

  out.push(markdownTable(rows));
}

/**
 * @param {string[]} out
 * @param {string}   projectType
 */
function sectionFrameworks(out: string[], projectType: string): void {
  const frameworks = deriveFrameworks(projectType);

  out.push('');
  out.push('## Frameworks');
  out.push('');

  if (frameworks.length === 0) {
    out.push('No frameworks detected.');
  } else {
    for (const fw of frameworks) {
      out.push(`- ${fw}`);
    }
  }
}

/**
 * @param {string[]} out
 * @param {string[]} configs
 */
function sectionConfigurationFiles(out: string[], configs: string[]): void {
  out.push('');
  out.push('## Configurations');
  out.push('');

  if (configs.length === 0) {
    out.push('No configuration files detected.');
  } else {
    for (const c of configs) {
      out.push(`- ${c}`);
    }
  }
}

/**
 * @param {string[]} out
 * @param {Array<{name: string, command: string, description: string, usage: string}>} scripts
 */
function sectionPackageScripts(out: string[], scripts: ScriptInfo[]): void {
  out.push('');
  out.push('## Scripts');
  out.push('');

  if (scripts.length === 0) {
    out.push('No package scripts detected.');
  } else {
    for (const s of scripts) {
      const usage = s.usage || `npm run ${s.name}`;
      out.push(`- **${usage}**`);
      if (s.description) {
        out.push(`  ${s.description}  `);
        out.push(`  \`${s.command}\``);
      } else {
        out.push(`  \`${s.command}\``);
      }
    }
  }
}

/**
 * @param {string[]} out
 * @param {Array<{path: string, reason: string}>} importantFiles
 */
function sectionImportantFiles(out: string[], importantFiles: ImportantFile[]): void {
  out.push('');
  out.push('## Important Files');
  out.push('');

  if (importantFiles.length === 0) {
    out.push('No important files detected.');
  } else {
    for (const f of importantFiles) {
      out.push(`- **${f.path}**  `);
      out.push(`  ${f.reason}`);
    }
  }
}

/**
 * @param {string[]} out
 * @param {Array<{id: string, status: string, message: string}>} health
 */
function sectionProjectHealth(out: string[], health: HealthObservation[]): void {
  out.push('');
  out.push('## Project Health');
  out.push('');

  if (health.length === 0) {
    out.push('No project health observations available.');
  } else {
    for (const h of health) {
      let icon = 'ℹ';
      if (h.status === 'pass') icon = '✓';
      else if (h.status === 'warning') icon = '⚠';
      out.push(`- ${icon} ${h.message}`);
    }
  }
}

/**
 * @param {string[]} out
 * @param {string[]} entryPoints
 */
function sectionEntryPoints(out: string[], entryPoints: string[]): void {
  out.push('');
  out.push('## Entry Points');
  out.push('');

  if (entryPoints.length === 0) {
    out.push('No entry points detected.');
  } else {
    for (const ep of entryPoints) {
      out.push(`- ${ep}`);
    }
  }
}

/**
 * @param {string[]} out
 * @param {import('../scanner/scan.js').DirNode} tree
 * @param {number} totalFiles
 * @param {string} rootName
 */
function sectionFolderStructure(out: string[], tree: DirNode, totalFiles: number, rootName: string): void {
  // Contract: omit section entirely when no files were scanned.
  if (totalFiles === 0) return;

  out.push('');
  out.push('## Structure');
  out.push('');

  const treeStr = buildTreeString(tree, rootName, totalFiles);
  out.push('```text');
  out.push(treeStr);
  out.push('```');
}

/**
 * @param {string[]} out
 * @param {import('../scanner/scan.js').ScanResult} result
 */
function sectionStatistics(out: string[], result: ScanResult): void {
  const { flatFiles, totalFolders, scanDurationMs } = result;

  out.push('');
  out.push('## Statistics');
  out.push('');
  out.push(statsTable([
    ['Files',         flatFiles.length.toString()],
    ['Folders',       totalFolders.toString()],
    ['Scan Duration', formatDuration(scanDurationMs)],
  ]));
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
export function render(result: ScanResult, options: { cwd?: string } = {}): void {
  const { rootPath, projectType, entryPoints, configs = [], scripts = [], flatFiles, tree, importantFiles = [], health = [] } = result;

  const cwd     = options.cwd ?? process.cwd();
  const relRoot  = path.relative(cwd, rootPath) || '.';
  const rootName = relRoot === '.' ? path.basename(rootPath) : relRoot;

  /** @type {string[]} */
  const out: string[] = [];

  sectionTitle(out);
  sectionSummary(out, result, relRoot);
  sectionProjectHealth(out, health);
  sectionImportantFiles(out, importantFiles);
  sectionFrameworks(out, projectType);
  sectionEntryPoints(out, entryPoints);
  sectionConfigurationFiles(out, configs);
  sectionPackageScripts(out, scripts);
  sectionStatistics(out, result);
  sectionFolderStructure(out, tree, flatFiles.length, rootName);

  console.log(out.join('\n'));
}
