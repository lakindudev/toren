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
 * Build an in-memory nested tree from a flat list of relative file paths.
 *
 * @param {string[]} flatFiles - Relative file paths produced by scan()
 * @returns {{ type: string, children: Record<string, object> }}
 */
function buildInternalTree(flatFiles) {
  const root = { type: 'directory', children: {} };

  for (const filePath of flatFiles) {
    const parts = filePath.split(/[/\\]/).filter(Boolean);
    let node = root;

    for (let i = 0; i < parts.length; i++) {
      const part   = parts[i];
      const isLeaf = i === parts.length - 1;

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
 *
 * @param {object}   node
 * @param {string}   prefix
 * @param {boolean}  isLast
 * @param {string[]} lines
 * @param {number}   depth
 * @param {number}   maxDepth
 */
function serializeNode(node, prefix, isLast, lines, depth = 0, maxDepth = 5) {
  if (depth >= maxDepth) return;

  const connector = isLast ? '└── ' : '├── ';
  const childPad  = isLast ? '    ' : '│   ';
  const label     = node.type === 'directory' ? `${node.name}/` : node.name;

  lines.push(`${prefix}${connector}${label}`);

  if (node.type === 'directory') {
    const children = Object.values(node.children || {}).sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

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
 * Convert a flat file list into a plain-text tree string.
 *
 * @param {string[]} flatFiles
 * @param {string}   rootName
 * @returns {string}
 */
function buildTreeString(flatFiles, rootName) {
  if (flatFiles.length === 0) return 'No files scanned.';

  const root     = buildInternalTree(flatFiles);
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
// Utility helpers
// ---------------------------------------------------------------------------

/**
 * Escape a value for safe insertion into HTML text nodes and attributes.
 *
 * @param {unknown} value
 * @returns {string}
 */
function esc(value) {
  return String(value ?? '')
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#39;');
}

/**
 * Format a scan duration in milliseconds to a human-readable string.
 *
 * @param {number} ms
 * @returns {string}
 */
function formatDuration(ms) {
  if (ms < 1)     return '&lt; 1 ms';
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
function buildStyles() {
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
};

// ---------------------------------------------------------------------------
// Section builders (one function per report section)
// ---------------------------------------------------------------------------

/**
 * Render the gradient page header.
 *
 * @param {string} projectType
 * @param {string} relRoot
 * @returns {string}
 */
function renderHeader(projectType, relRoot) {
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
function renderSummaryCards(result) {
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
      value: formatDuration(scanDurationMs),
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
 * Render the entry points section.
 *
 * @param {string[]} entryPoints
 * @returns {string}
 */
function renderEntryPoints(entryPoints) {
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
  <div class="section">
    <div class="section-header">
      <div class="section-icon">${icon.door()}</div>
      <span class="section-title">Entry Points</span>
      ${countBadge}
    </div>
    <div class="section-body">${body}</div>
  </div>`;
}

/**
 * Render the folder structure section with a dark <pre><code> tree.
 *
 * @param {string[]} flatFiles
 * @param {string}   rootName
 * @returns {string}
 */
function renderFolderStructure(flatFiles, rootName) {
  const treeStr = buildTreeString(flatFiles, rootName);

  return `
  <div class="section">
    <div class="section-header">
      <div class="section-icon">${icon.tree()}</div>
      <span class="section-title">Folder Structure</span>
      ${flatFiles.length > 0 ? `<span class="section-count">${flatFiles.length} files</span>` : ''}
    </div>
    <div class="section-body">
      <div class="tree-wrap">
        <pre><code>${esc(treeStr)}</code></pre>
      </div>
    </div>
  </div>`;
}

/**
 * Render the statistics table.
 *
 * @param {import('../scanner/scan.js').ScanResult} result
 * @returns {string}
 */
function renderStats(result) {
  const { flatFiles, totalFolders, scanDurationMs } = result;

  const rows = [
    ['Files',         flatFiles.length,              true],
    ['Folders',       totalFolders,                  true],
    ['Scan Duration', formatDuration(scanDurationMs), false],
  ];

  const rowsHTML = rows.map(([metric, value, isNum]) => `
    <tr>
      <td>${esc(metric)}</td>
      <td class="${isNum ? 'val' : 'val-plain'}">${value}</td>
    </tr>`).join('');

  return `
  <div class="section">
    <div class="section-header">
      <div class="section-icon">${icon.bar()}</div>
      <span class="section-title">Statistics</span>
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
  </div>`;
}

/**
 * Render the scan provenance / metadata section.
 *
 * @returns {string}
 */
function renderScanInfo() {
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
  <div class="section">
    <div class="section-header">
      <div class="section-icon">${icon.info()}</div>
      <span class="section-title">Scan Information</span>
    </div>
    <div class="section-body">
      <table class="data-table">
        <tbody>${rowsHTML}</tbody>
      </table>
    </div>
  </div>`;
}

/**
 * Render the page footer.
 *
 * @returns {string}
 */
function renderFooter() {
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
export function render(result, options = {}) {
  const { rootPath, projectType, entryPoints, flatFiles } = result;

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
      ${renderEntryPoints(entryPoints)}
      ${renderFolderStructure(flatFiles, rootName)}
      ${renderStats(result)}
      ${renderScanInfo()}
    </main>

    ${renderFooter()}

  </div>
</body>
</html>`;

  console.log(html);
}
