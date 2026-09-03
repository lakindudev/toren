import type { ScanResult, DirNode, TreeNode, FileNode, ScriptInfo, ImportantFile, HealthObservation, ProjectInfo, PackageManager } from "../types/index.js";
/**
 * @fileoverview Toren — HTML Renderer
 *
 * Consumes a {@link ScanResult} and writes a complete, self-contained HTML5
 * report to stdout. The output is suitable for opening directly in a browser
 * or sharing as a static file:
 *
 *   toren --format html > report.html
 *
 * Design contract (mirrors all other renderers):
 *  - Accepts a ScanResult and an optional options object.
 *  - Never scans files or modifies the data it receives.
 *  - Produces a single HTML document with all CSS inlined — no CDN, no
 *    external assets, no runtime JavaScript required.
 *  - All output goes to stdout so users can redirect freely.
 *
 * Sections (in order):
 *  1. Header         — project title, path badge, type badge
 *  2. Summary cards  — project type, files, folders, scan duration
 *  3. Entry Points   — list of detected entry files
 *  4. Folder Structure — tree view inside a dark <pre><code> block
 *  5. Statistics     — metric table
 *  6. Scan Info      — provenance metadata
 *
 * @module renderers/html-renderer
 */

import path from 'node:path';

// ---------------------------------------------------------------------------
// Tree builder (plain-text, HTML-safe — same algorithm as markdown-renderer)
// ---------------------------------------------------------------------------


/**
 * Recursively serialise a tree node into classic tree-connector lines.
 *
 * @param {object}   node
 * @param {string}   prefix
 * @param {boolean}  isLast
 * @param {string[]} lines
 * @param {number}   depth
 * @param {number}   maxDepth
 */
function serializeNode(node: DirNode | FileNode | TreeNode, prefix: string, isLast: boolean, lines: string[], depth = 0, maxDepth = 5): void {
  if (depth >= maxDepth) return;

  const connector = isLast ? '└── ' : '├── ';
  const childPad  = isLast ? '    ' : '│   ';
  const label     = node.type === 'directory' ? `${node.name}/` : node.name;

  lines.push(`${prefix}${connector}${label}`);

  if (node.type === 'directory') {
    const children = node.children || [];

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
 * Convert a ScanResult tree into a plain-text tree string.
 *
 * @param {import('../scanner/scan.js').DirNode} tree
 * @param {string}   rootName
 * @param {number}   totalFiles
 * @returns {string}
 */
function buildTreeString(tree: DirNode, rootName: string, totalFiles: number): string {
  if (totalFiles === 0) return 'No files scanned.';

  const lines    = [`${rootName}/`];
  const children = tree.children || [];

  for (let i = 0; i < children.length; i++) {
    serializeNode(children[i], '', i === children.length - 1, lines);
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

/**
 * Escape a value for safe insertion into HTML text nodes and attributes.
 *
 * @param {unknown} value
 * @returns {string}
 */
function esc(value: string | number | boolean | null | undefined): string {
  return String(value ?? '')
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#39;');
}

/**
 * Format a scan duration in milliseconds to a human-readable string.
 * Returns plain text only — callers are responsible for HTML-escaping via esc().
 *
 * @param {number} ms
 * @returns {string}
 */
function formatDuration(ms: number): string {
  if (ms < 1)     return '< 1 ms';
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)} s`;
  return `${Math.round(ms)} ms`;
}

// ---------------------------------------------------------------------------
// CSS (inlined — zero external dependencies)
// ---------------------------------------------------------------------------

/**
 * Build the complete <style> block for the report.
 * All colours are driven by CSS custom properties so they are easy to theme.
 *
 * @returns {string}
 */
function buildStyles(): string {
  return `<style>
/* ── Reset ──────────────────────────────────────────────────── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

/* ── Design tokens ──────────────────────────────────────────── */
:root {
  --bg:           #f1f5f9;
  --surface:      #ffffff;
  --border:       #e2e8f0;
  --text:         #0f172a;
  --muted:        #64748b;
  --accent:       #4f46e5;
  --accent-light: #eef2ff;
  --accent-2:     #818cf8;
  --success:      #10b981;
  --success-bg:   #ecfdf5;
  --code-bg:      #0f172a;
  --code-text:    #e2e8f0;
  --code-comment: #64748b;
  --radius-sm:    6px;
  --radius:       12px;
  --radius-lg:    16px;
  --shadow-sm:    0 1px 2px rgba(0,0,0,.06);
  --shadow:       0 1px 3px rgba(0,0,0,.08), 0 4px 16px rgba(0,0,0,.05);
  --shadow-lg:    0 4px 6px rgba(0,0,0,.07), 0 10px 30px rgba(0,0,0,.08);
}

/* ── Base ────────────────────────────────────────────────────── */
html { scroll-behavior: smooth; }

body {
  font-family: system-ui, -apple-system, BlinkMacSystemFont,
               'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  background: var(--bg);
  color: var(--text);
  line-height: 1.65;
  padding: 0 1.25rem 4rem;
  -webkit-font-smoothing: antialiased;
}

/* ── Page wrapper ────────────────────────────────────────────── */
.page {
  max-width: 980px;
  margin: 0 auto;
}

/* ── Header ──────────────────────────────────────────────────── */
.header {
  background: linear-gradient(135deg, #1e1b4b 0%, #312e81 55%, #4338ca 100%);
  color: #fff;
  border-radius: 0 0 var(--radius-lg) var(--radius-lg);
  padding: 2.75rem 2.5rem 2.25rem;
  margin-bottom: 2rem;
  position: relative;
  overflow: hidden;
}

/* Subtle grid texture */
.header::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(255,255,255,.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,.03) 1px, transparent 1px);
  background-size: 32px 32px;
  pointer-events: none;
}

.header-top {
  position: relative;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1.25rem;
  flex-wrap: wrap;
}

.header-brand {
  display: flex;
  align-items: center;
  gap: .65rem;
  font-size: .78rem;
  font-weight: 600;
  letter-spacing: .08em;
  text-transform: uppercase;
  color: rgba(255,255,255,.5);
  margin-bottom: .65rem;
}

.header-logo {
  width: 20px;
  height: 20px;
  background: var(--accent-2);
  border-radius: 5px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: .7rem;
}

.header h1 {
  font-size: 1.9rem;
  font-weight: 800;
  letter-spacing: -.03em;
  line-height: 1.15;
  color: #fff;
}

.header-subtitle {
  margin-top: .45rem;
  color: rgba(255,255,255,.6);
  font-size: .95rem;
  font-weight: 400;
}

/* Project-type badge (top-right) */
.type-badge {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: .5rem;
  background: rgba(255,255,255,.12);
  border: 1px solid rgba(255,255,255,.2);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  color: #fff;
  font-size: .82rem;
  font-weight: 600;
  padding: .45rem 1rem;
  border-radius: 99px;
  white-space: nowrap;
  flex-shrink: 0;
}

.type-badge-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--accent-2);
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: .4; }
}

/* Scan path pill */
.path-pill {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: .55rem;
  margin-top: 1.5rem;
  background: rgba(0,0,0,.3);
  border: 1px solid rgba(255,255,255,.1);
  border-radius: var(--radius-sm);
  padding: .45rem 1rem;
  font-family: ui-monospace, 'Cascadia Code', 'Fira Code', Consolas, monospace;
  font-size: .83rem;
  color: rgba(255,255,255,.75);
  letter-spacing: .01em;
}

.path-pill svg { flex-shrink: 0; opacity: .6; }

/* ── Summary Cards ───────────────────────────────────────────── */
.cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 1.4rem 1.6rem;
  box-shadow: var(--shadow);
  transition: box-shadow .2s ease, transform .2s ease;
}

.card:hover {
  box-shadow: var(--shadow-lg);
  transform: translateY(-1px);
}

.card-label {
  display: flex;
  align-items: center;
  gap: .45rem;
  font-size: .72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .07em;
  color: var(--muted);
  margin-bottom: .65rem;
}

.card-icon {
  width: 22px;
  height: 22px;
  border-radius: 5px;
  background: var(--accent-light);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: .65rem;
  color: var(--accent);
  flex-shrink: 0;
}

.card-value {
  font-size: 2rem;
  font-weight: 800;
  line-height: 1;
  letter-spacing: -.04em;
  color: var(--text);
  font-variant-numeric: tabular-nums;
}

.card-value.is-text {
  font-size: 1.2rem;
  font-weight: 700;
  letter-spacing: -.02em;
  color: var(--accent);
}

.card-sub {
  font-size: .78rem;
  color: var(--muted);
  margin-top: .35rem;
  font-weight: 500;
}

/* ── Sections ────────────────────────────────────────────────── */
.section {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  margin-bottom: 1.5rem;
  overflow: hidden;
}

.section-header {
  display: flex;
  align-items: center;
  gap: .75rem;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid var(--border);
  background: #fafafa;
}

.section-icon {
  width: 30px;
  height: 30px;
  border-radius: var(--radius-sm);
  background: var(--accent-light);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: .9rem;
  flex-shrink: 0;
}

.section-title {
  font-size: .95rem;
  font-weight: 700;
  color: var(--text);
  letter-spacing: -.01em;
}

.section-count {
  margin-left: auto;
  background: var(--accent-light);
  color: var(--accent);
  font-size: .72rem;
  font-weight: 700;
  padding: .2rem .55rem;
  border-radius: 99px;
  letter-spacing: .03em;
}

.section-body { padding: 1.5rem; }

/* ── Entry Points ────────────────────────────────────────────── */
.entry-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: .5rem;
}

.entry-item {
  display: flex;
  align-items: center;
  gap: .75rem;
  padding: .6rem .9rem;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-family: ui-monospace, 'Cascadia Code', 'Fira Code', Consolas, monospace;
  font-size: .85rem;
  color: var(--text);
  transition: border-color .15s ease, background .15s ease;
}

.entry-item:hover {
  border-color: var(--accent-2);
  background: var(--accent-light);
}

.entry-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--success);
  flex-shrink: 0;
  box-shadow: 0 0 0 3px var(--success-bg);
}

.empty-msg {
  color: var(--muted);
  font-style: italic;
  font-size: .9rem;
  padding: .25rem 0;
}

/* ── Tree view ───────────────────────────────────────────────── */
.tree-wrap {
  background: var(--code-bg);
  border-radius: var(--radius-sm);
  overflow: auto;
  max-height: 520px;
}

.tree-wrap pre {
  padding: 1.4rem 1.6rem;
  margin: 0;
  overflow: visible;
}

.tree-wrap code {
  font-family: ui-monospace, 'Cascadia Code', 'Fira Code', Consolas, monospace;
  font-size: .82rem;
  line-height: 1.8;
  color: var(--code-text);
  white-space: pre;
  display: block;
}

/* ── Stats / Info Table ──────────────────────────────────────── */
.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: .9rem;
}

.data-table th,
.data-table td {
  padding: .8rem 1rem;
  text-align: left;
  border-bottom: 1px solid var(--border);
}

.data-table th {
  font-size: .72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .06em;
  color: var(--muted);
  background: #fafafa;
}

.data-table td { color: var(--text); }

.data-table td.val {
  text-align: right;
  font-weight: 700;
  color: var(--accent);
  font-variant-numeric: tabular-nums;
  font-family: ui-monospace, 'Cascadia Code', 'Fira Code', Consolas, monospace;
  font-size: .88rem;
}

.data-table td.val-plain {
  text-align: right;
  font-weight: 500;
  color: var(--muted);
}

.data-table tr:last-child td { border-bottom: none; }

/* ── Footer ──────────────────────────────────────────────────── */
.footer {
  text-align: center;
  padding: 2rem 1rem 0;
  font-size: .8rem;
  color: var(--muted);
}

.footer-brand {
  display: inline-flex;
  align-items: center;
  gap: .4rem;
  font-weight: 600;
  color: var(--accent);
}

/* ── Responsive ──────────────────────────────────────────────── */
@media (max-width: 640px) {
  body { padding: 0 .75rem 3rem; }
  .header { padding: 1.75rem 1.25rem 1.5rem; border-radius: 0 0 var(--radius) var(--radius); }
  .header h1 { font-size: 1.45rem; }
  .section-body { padding: 1.1rem; }
  .cards { grid-template-columns: repeat(2, 1fr); }
  .card { padding: 1.1rem 1.2rem; }
  .card-value { font-size: 1.6rem; }
}

/* ── Print ───────────────────────────────────────────────────── */
@media print {
  body { background: white; padding: 0; font-size: 11pt; }
  .header {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    border-radius: 0;
  }
  .card, .section {
    box-shadow: none;
    border: 1px solid #ccc;
    break-inside: avoid;
  }
  .tree-wrap { max-height: none; }
  .card:hover, .entry-item:hover { transform: none; }
}
</style>`;
}

// ---------------------------------------------------------------------------
// SVG icon helpers (zero external dependency)
// ---------------------------------------------------------------------------

/** @returns {string} */
const icon = {
  code:    () => `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`,
  folder:  () => `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`,
  file:    () => `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`,
  clock:   () => `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
  door:    () => `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2H3a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10"/><polyline points="17 8 22 12 17 16"/><line x1="22" y1="12" x2="11" y2="12"/></svg>`,
  tree:    () => `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`,
  bar:     () => `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,
  info:    () => `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
  terminal: () => `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>`,
};

// ---------------------------------------------------------------------------
// Section builders (one function per report section)
// ---------------------------------------------------------------------------

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
 * Render the gradient page header.
 *
 * @param {string} projectType
 * @param {string} relRoot
 * @returns {string}
 */
function renderHeader(projectType: string, relRoot: string): string {
  return `
  <header class="header">
    <div class="header-top">
      <div>
        <div class="header-brand">
          <span class="header-logo">T</span>
          Toren
        </div>
        <h1>Project Report</h1>
        <p class="header-subtitle">Generated automatically from codebase analysis</p>
      </div>
      <span class="type-badge">
        ${icon.code()}
        <span class="type-badge-dot"></span>
        ${esc(projectType || 'Unknown')}
      </span>
    </div>
    <div class="path-pill">
      ${icon.folder()}
      ${esc(relRoot)}
    </div>
  </header>`;
}

/**
 * Render the four summary stat cards.
 *
 * @param {import('../scanner/scan.js').ScanResult} result
 * @returns {string}
 */
function renderSummaryCards(result: ScanResult): string {
  const { projectType, flatFiles, totalFolders, scanDurationMs } = result;

  const cards = [
    {
      label: 'Project Type',
      icon:  icon.code(),
      value: esc(projectType || 'Unknown'),
      isText: true,
      sub:   'detected framework',
    },
    {
      label: 'Total Files',
      icon:  icon.file(),
      value: flatFiles.length,
      sub:   'source files',
    },
    {
      label: 'Total Folders',
      icon:  icon.folder(),
      value: totalFolders,
      sub:   'directories',
    },
    {
      label: 'Scan Duration',
      icon:  icon.clock(),
      value: esc(formatDuration(scanDurationMs)),
      isText: true,
      sub:   'wall-clock time',
    },
  ];

  const cardHTML = cards.map(c => `
    <div class="card">
      <div class="card-label">
        <span class="card-icon">${c.icon}</span>
        ${esc(c.label)}
      </div>
      <div class="card-value${c.isText ? ' is-text' : ''}">${c.value}</div>
      <div class="card-sub">${esc(c.sub)}</div>
    </div>`).join('');

  return `<div class="cards">${cardHTML}</div>`;
}

/**
 * Render the frameworks section.
 *
 * @param {string} projectType
 * @returns {string}
 */
function renderFrameworks(projectType: string): string {
  const frameworks = deriveFrameworks(projectType);
  const count      = frameworks.length;

  const body = count === 0
    ? `<p class="empty-msg">No frameworks detected.</p>`
    : `<ul class="entry-list">
        ${frameworks.map(fw => `
          <li class="entry-item">
            <span class="entry-dot"></span>
            ${esc(fw)}
          </li>`).join('')}
       </ul>`;

  const countBadge = count > 0
    ? `<span class="section-count">${count} found</span>`
    : '';

  return `
  <section class="section">
    <div class="section-header">
      <div class="section-icon">${icon.code()}</div>
      <h2 class="section-title">Frameworks</h2>
      ${countBadge}
    </div>
    <div class="section-body">${body}</div>
  </section>`;
}

/**
 * Render the entry points section.
 *
 * @param {string[]} entryPoints
 * @returns {string}
 */
function renderEntryPoints(entryPoints: string[]): string {
  const count = entryPoints.length;

  const body = count === 0
    ? `<p class="empty-msg">No entry points detected.</p>`
    : `<ul class="entry-list">
        ${entryPoints.map(ep => `
          <li class="entry-item">
            <span class="entry-dot"></span>
            ${esc(ep)}
          </li>`).join('')}
       </ul>`;

  const countBadge = count > 0
    ? `<span class="section-count">${count} found</span>`
    : '';

  return `
  <section class="section">
    <div class="section-header">
      <div class="section-icon">${icon.door()}</div>
      <h2 class="section-title">Entry Points</h2>
      ${countBadge}
    </div>
    <div class="section-body">${body}</div>
  </section>`;
}

/**
 * Render the configuration files section.
 *
 * @param {string[]} configs
 * @returns {string}
 */
function renderConfigurationFiles(configs: string[]): string {
  const count = configs.length;

  const body = count === 0
    ? `<p class="empty-msg">No configuration files detected.</p>`
    : `<ul class="entry-list">
        ${configs.map(c => `
          <li class="entry-item">
            <span class="entry-dot"></span>
            ${esc(c)}
          </li>`).join('')}
       </ul>`;

  const countBadge = count > 0
    ? `<span class="section-count">${count} found</span>`
    : '';

  return `
  <section class="section">
    <div class="section-header">
      <div class="section-icon">${icon.file()}</div>
      <h2 class="section-title">Configuration Files</h2>
      ${countBadge}
    </div>
    <div class="section-body">${body}</div>
  </section>`;
}

/**
 * Render the package scripts section.
 *
 * @param {Array<{name: string, command: string}>} scripts
 * @returns {string}
 */
function renderProjectInfo(projectInfo: ProjectInfo | null, packageManager: PackageManager | null): string {
  const rows = [];
  if (projectInfo?.name) rows.push(['Name', projectInfo.name]);
  if (packageManager) rows.push(['Package Manager', packageManager]);
  if (projectInfo?.runtime) rows.push(['Runtime', projectInfo.runtime]);
  if (projectInfo?.language) rows.push(['Language', projectInfo.language]);
  if (projectInfo?.architecture) rows.push(['Architecture', projectInfo.architecture]);
  if (projectInfo?.framework) rows.push(['Framework', projectInfo.framework]);
  if (projectInfo?.entryPoint) rows.push(['Entry Point', projectInfo.entryPoint]);
  if (projectInfo?.sourceDirectory) rows.push(['Source Directory', projectInfo.sourceDirectory]);

  if (rows.length === 0) return '';

  const rowsHTML = rows.map(([prop, value]) => `
    <tr>
      <td>${esc(prop)}</td>
      <td class="val-plain">${esc(value)}</td>
    </tr>`).join('');

  return `
  <section class="section">
    <div class="section-header">
      <div class="section-icon">${icon.info()}</div>
      <h2 class="section-title">Project Info</h2>
    </div>
    <div class="section-body" style="padding:0">
      <table class="data-table">
        <thead>
          <tr>
            <th>Property</th>
            <th style="text-align:right">Value</th>
          </tr>
        </thead>
        <tbody>${rowsHTML}</tbody>
      </table>
    </div>
  </section>`;
}

function renderImportantFiles(importantFiles: ImportantFile[]): string {
  const count = importantFiles.length;

  const body = count === 0
    ? `<p class="empty-msg" style="padding: 1.5rem">No important files detected.</p>`
    : `<table class="data-table">
        <thead>
          <tr>
            <th>Path</th>
            <th>Reason</th>
          </tr>
        </thead>
        <tbody>
          ${importantFiles.map(f => `
            <tr>
              <td><code>${esc(f.path)}</code></td>
              <td class="val-plain">${esc(f.reason)}</td>
            </tr>`).join('')}
        </tbody>
       </table>`;

  const countBadge = count > 0
    ? `<span class="section-count">${count} found</span>`
    : '';

  return `
  <section class="section">
    <div class="section-header">
      <div class="section-icon">${icon.file()}</div>
      <h2 class="section-title">Important Files</h2>
      ${countBadge}
    </div>
    <div class="section-body" style="padding:0">
      ${body}
    </div>
  </section>`;
}

function renderProjectHealth(health: HealthObservation[]): string {
  const count = health.length;

  const body = count === 0
    ? `<p class="empty-msg" style="padding: 1.5rem">No project health observations available.</p>`
    : `<ul class="entry-list">
        ${health.map(h => {
          let emoji = 'ℹ';
          if (h.status === 'pass') emoji = '✓';
          else if (h.status === 'warning') emoji = '⚠';
          return `
          <li class="entry-item">
            <span>${esc(emoji)}</span>
            ${esc(h.message)}
          </li>`;
        }).join('')}
       </ul>`;

  const countBadge = count > 0
    ? `<span class="section-count">${count} observations</span>`
    : '';

  return `
  <section class="section">
    <div class="section-header">
      <div class="section-icon">${icon.info()}</div>
      <h2 class="section-title">Project Health</h2>
      ${countBadge}
    </div>
    <div class="section-body">
      ${body}
    </div>
  </section>`;
}

function renderPackageScripts(scripts: ScriptInfo[]): string {
  const count = scripts.length;

  const body = count === 0
    ? `<p class="empty-msg" style="padding: 1.5rem">No package scripts detected.</p>`
    : `<table class="data-table">
        <thead>
          <tr>
            <th>Usage</th>
            <th>Description</th>
            <th>Command</th>
          </tr>
        </thead>
        <tbody>
          ${scripts.map(s => {
            const usage = s.usage || `npm run ${s.name}`;
            return `
            <tr>
              <td><code>${esc(usage)}</code></td>
              <td class="val-plain">${esc(s.description || '')}</td>
              <td class="val-plain"><code>${esc(s.command)}</code></td>
            </tr>`;
          }).join('')}
        </tbody>
       </table>`;

  const countBadge = count > 0
    ? `<span class="section-count">${count} found</span>`
    : '';

  return `
  <section class="section">
    <div class="section-header">
      <div class="section-icon">${icon.terminal()}</div>
      <h2 class="section-title">Package Scripts</h2>
      ${countBadge}
    </div>
    <div class="section-body" style="padding:0">
      ${body}
    </div>
  </section>`;
}

/**
 * Render the folder structure section.
 *
 * @param {import('../scanner/scan.js').DirNode} tree
 * @param {string[]} flatFiles
 * @param {string} rootName
 * @returns {string}
 */
function renderFolderStructure(tree: DirNode, flatFiles: string[], rootName: string): string {
  const treeStr = buildTreeString(tree, rootName, flatFiles.length);

  return `
  <section class="section">
    <div class="section-header">
      <div class="section-icon">${icon.tree()}</div>
      <h2 class="section-title">Folder Structure</h2>
      ${flatFiles.length > 0 ? `<span class="section-count">${flatFiles.length} files</span>` : ''}
    </div>
    <div class="section-body">
      <div class="tree-wrap">
        <pre><code>${esc(treeStr)}</code></pre>
      </div>
    </div>
  </section>`;
}

/**
 * Render the statistics table.
 *
 * @param {import('../scanner/scan.js').ScanResult} result
 * @returns {string}
 */
function renderStats(result: ScanResult): string {
  const { flatFiles, totalFolders, scanDurationMs } = result;

  const rows = [
    ['Files',         flatFiles.length,              true],
    ['Folders',       totalFolders,                  true],
    ['Scan Duration', formatDuration(scanDurationMs), false],
  ];

  const rowsHTML = rows.map(([metric, value, isNum]) => `
    <tr>
      <td>${esc(metric)}</td>
      <td class="${isNum ? 'val' : 'val-plain'}">${esc(value)}</td>
    </tr>`).join('');

  return `
  <section class="section">
    <div class="section-header">
      <div class="section-icon">${icon.bar()}</div>
      <h2 class="section-title">Statistics</h2>
    </div>
    <div class="section-body">
      <table class="data-table">
        <thead>
          <tr>
            <th>Metric</th>
            <th style="text-align:right">Value</th>
          </tr>
        </thead>
        <tbody>${rowsHTML}</tbody>
      </table>
    </div>
  </section>`;
}

/**
 * Render the scan provenance / metadata section.
 *
 * @returns {string}
 */
function renderScanInfo(): string {
  const rows = [
    ['Generated by', '<strong>Toren</strong> — Codebase Onboarding Intelligence'],
    ['Output format', 'HTML'],
  ];

  const rowsHTML = rows.map(([label, value]) => `
    <tr>
      <td>${esc(label)}</td>
      <td class="val-plain">${value}</td>
    </tr>`).join('');

  return `
  <section class="section">
    <div class="section-header">
      <div class="section-icon">${icon.info()}</div>
      <h2 class="section-title">Scan Information</h2>
    </div>
    <div class="section-body">
      <table class="data-table">
        <tbody>${rowsHTML}</tbody>
      </table>
    </div>
  </section>`;
}

/**
 * Render the page footer.
 *
 * @returns {string}
 */
function renderFooter(): string {
  return `
  <footer class="footer">
    <span class="footer-brand">${icon.code()} Toren</span>
    &nbsp;—&nbsp; Codebase Onboarding Intelligence
  </footer>`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Render a ScanResult as a self-contained HTML5 report to stdout.
 *
 * The entire document is assembled into a single string before writing —
 * one console.log call keeps stdout writes atomic and avoids partial output
 * if the process is terminated early.
 *
 * @param {import('../scanner/scan.js').ScanResult} result
 * @param {{ cwd?: string }} [options]
 */
export function render(result: ScanResult, options: { cwd?: string } = {}): void {
  const { rootPath, projectType, entryPoints, configs = [], scripts = [], flatFiles, tree, importantFiles = [], health = [], projectInfo, packageManager } = result;

  const cwd      = options.cwd ?? process.cwd();
  const relRoot  = path.relative(cwd, rootPath) || '.';
  const rootName = path.basename(rootPath)      || relRoot;
  const title    = `Toren — ${esc(path.basename(rootPath) || relRoot)}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="Toren project analysis report for ${esc(relRoot)}">
  <meta name="generator" content="Toren">
  <title>${title}</title>
  ${buildStyles()}
</head>
<body>
  <div class="page">

    ${renderHeader(projectType, relRoot)}

    <main>
      ${renderSummaryCards(result)}
      ${renderProjectInfo(projectInfo, packageManager)}
      ${renderProjectHealth(health)}
      ${renderImportantFiles(importantFiles)}
      ${renderFrameworks(projectType)}
      ${renderEntryPoints(entryPoints)}
      ${renderConfigurationFiles(configs)}
      ${renderPackageScripts(scripts)}
      ${renderStats(result)}
      ${renderFolderStructure(tree, flatFiles, rootName)}
      ${renderScanInfo()}
    </main>

    ${renderFooter()}

  </div>
</body>
</html>`;

  console.log(html);
}
