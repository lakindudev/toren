/**
 * @fileoverview Toren CLI — Codebase Scanner (Core Logic)
 *
 * Responsibilities:
 *  - Recursively walk a project directory
 *  - Ignore irrelevant paths (node_modules, .git, dist, build, etc.)
 *  - Build an in-memory file-tree representation
 *  - Detect the project type from marker files
 *  - Identify known entry-point files
 *
 * This module is intentionally free of side-effects (no console.log).
 * All output concerns live in bin/toren.js.
 *
 * Designed to scale into:
 *  - Module / dependency graph analysis
 *  - Architecture visualisation layers
 *  - AI explanation integrations
 */

import fs from 'node:fs';
import path from 'node:path';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Directory / file names that are never walked.
 * Stored as a Set for O(1) membership checks.
 * @type {Set<string>}
 */
const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.cache',
  '.next',
  '.nuxt',
  'out',
  'coverage',
  '__pycache__',
  '.venv',
  'venv',
  '.idea',
  '.vscode',
]);

/**
 * Mapping from a marker filename to a human-readable project-type label.
 * Evaluated in iteration order — more specific entries should come first.
 * @type {Array<{ marker: string, label: string }>}
 */
const PROJECT_TYPE_MARKERS = [
  { marker: 'package.json',       label: 'Node.js / JavaScript'   },
  { marker: 'pom.xml',            label: 'Java / Spring Boot'      },
  { marker: 'build.gradle',       label: 'Java / Gradle'           },
  { marker: 'requirements.txt',   label: 'Python'                  },
  { marker: 'Pipfile',            label: 'Python (Pipenv)'         },
  { marker: 'pyproject.toml',     label: 'Python (pyproject)'      },
  { marker: 'go.mod',             label: 'Go'                      },
  { marker: 'Cargo.toml',         label: 'Rust'                    },
  { marker: 'composer.json',      label: 'PHP / Composer'          },
  { marker: 'Gemfile',            label: 'Ruby'                    },
  { marker: 'mix.exs',            label: 'Elixir'                  },
];

const ENTRY_POINT_EXACT = new Set([
  'index.js', 'index.ts', 'index.jsx', 'index.tsx',
  'main.js', 'main.ts', 'main.jsx', 'main.tsx', 'main.py',
  'app.js', 'app.ts', 'app.jsx', 'app.tsx', 'App.js', 'App.ts', 'App.jsx', 'App.tsx',
  'server.js', 'server.ts', 'server.jsx', 'server.tsx',
  'Application.java', 'Main.java',
  'page.js', 'page.ts', 'page.jsx', 'page.tsx',
  'layout.js', 'layout.ts', 'layout.jsx', 'layout.tsx',
  '_app.js', '_app.ts', '_app.jsx', '_app.tsx',
  '_document.js', '_document.ts', '_document.jsx', '_document.tsx'
]);

function isEntryPoint(filename) {
  if (ENTRY_POINT_EXACT.has(filename)) return true;
  if (filename.endsWith('Application.java')) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Types (JSDoc — no TypeScript dependency required)
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} FileNode
 * @property {'file'} type
 * @property {string} name      - Basename of the file
 * @property {string} fullPath  - Absolute path
 * @property {string} relPath   - Path relative to the scanned root
 */

/**
 * @typedef {Object} DirNode
 * @property {'directory'} type
 * @property {string} name      - Basename of the directory
 * @property {string} fullPath  - Absolute path
 * @property {string} relPath   - Path relative to the scanned root
 * @property {Array<FileNode|DirNode>} children
 */

/**
 * @typedef {Object} ScanResult
 * @property {string}              rootPath       - Absolute path that was scanned
 * @property {string}              projectType    - Detected project type label
 * @property {Array<string>}       entryPoints    - Relative paths of detected entry points
 * @property {DirNode}             tree           - Full in-memory file tree
 * @property {Array<string>}       flatFiles      - All relative file paths (flat list)
 * @property {number}              totalFolders   - Total number of directories walked
 * @property {number}              scanDurationMs - Wall-clock time of the scan in milliseconds
 */

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Determine whether a directory entry should be skipped.
 *
 * @param {string} name - Basename of the entry
 * @param {fs.Dirent} dirent
 * @returns {boolean}
 */
function shouldIgnore(name, dirent) {
  if (name.startsWith('.') && dirent.isDirectory()) return true;
  return IGNORED_DIRS.has(name);
}

/**
 * Recursively walk `dirPath`, building a DirNode tree.
 * Also populates `flatFiles` and `entryPoints` arrays by reference.
 *
 * @param {string} dirPath      - Absolute path of the current directory
 * @param {string} rootPath     - Absolute path of the scan root (for relative paths)
 * @param {Array<string>} flatFiles    - Accumulator for all relative file paths
 * @param {Array<string>} entryPoints  - Accumulator for entry-point relative paths
 * @returns {DirNode}
 */
function walkDirectory(dirPath, rootPath, flatFiles, entryPoints) {
  const name    = path.basename(dirPath);
  const relPath = path.relative(rootPath, dirPath) || '.';

  /** @type {DirNode} */
  const node = {
    type:     'directory',
    name,
    fullPath: dirPath,
    relPath,
    children: [],
  };

  let entries;
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    // Permission-denied or unreadable directory — skip silently.
    return node;
  }

  // Sort: directories first, then files — both alphabetically.
  entries.sort((a, b) => {
    const aIsDir = a.isDirectory() ? 0 : 1;
    const bIsDir = b.isDirectory() ? 0 : 1;
    if (aIsDir !== bIsDir) return aIsDir - bIsDir;
    return a.name.localeCompare(b.name);
  });

  for (const dirent of entries) {
    if (shouldIgnore(dirent.name, dirent)) continue;

    const childPath = path.join(dirPath, dirent.name);

    if (dirent.isDirectory()) {
      const childNode = walkDirectory(childPath, rootPath, flatFiles, entryPoints);
      node.children.push(childNode);
    } else if (dirent.isFile()) {
      const relFilePath = path.relative(rootPath, childPath);

      /** @type {FileNode} */
      const fileNode = {
        type:     'file',
        name:     dirent.name,
        fullPath: childPath,
        relPath:  relFilePath,
      };

      node.children.push(fileNode);
      flatFiles.push(relFilePath);

      if (isEntryPoint(dirent.name)) {
        entryPoints.push(relFilePath);
      }
    }
  }

  return node;
}

/**
 * Detect the project type by checking for known marker files in `rootPath`.
 *
 * Returns the label of the first matched marker, or `'Unknown'` if none match.
 *
 * @param {string} rootPath - Absolute path to the project root
 * @returns {string}
 */
function detectProjectType(rootPath) {
  for (const { marker, label } of PROJECT_TYPE_MARKERS) {
    const markerPath = path.join(rootPath, marker);
    if (fs.existsSync(markerPath)) {
      // Refine Node.js projects by inspecting package.json dependencies.
      if (marker === 'package.json') {
        return refineNodeProjectType(markerPath);
      }
      return label;
    }
  }
  return 'Unknown';
}

/**
 * Read `package.json` and return a more specific label when React / Next / Vue
 * etc. are listed as dependencies.
 *
 * @param {string} pkgPath - Absolute path to package.json
 * @returns {string}
 */
function refineNodeProjectType(pkgPath) {
  try {
    const raw  = fs.readFileSync(pkgPath, 'utf8');
    const pkg  = JSON.parse(raw);
    const deps = {
      ...pkg.dependencies,
      ...pkg.devDependencies,
      ...pkg.peerDependencies,
    };

    if (deps['next'])         return 'Next.js';
    if (deps['react'])        return 'React';
    if (deps['vue'])          return 'Vue.js';
    if (deps['@angular/core']) return 'Angular';
    if (deps['svelte'])       return 'Svelte';
    if (deps['express'])      return 'Node.js / Express';
    if (deps['fastify'])      return 'Node.js / Fastify';
    if (deps['koa'])          return 'Node.js / Koa';
    if (deps['typescript'])   return 'Node.js / TypeScript';
  } catch {
    // Malformed package.json — fall through.
  }
  return 'Node.js / JavaScript';
}

// ---------------------------------------------------------------------------
// Tree helpers
// ---------------------------------------------------------------------------

/**
 * Count the total number of directory nodes in a tree (including the root).
 *
 * @param {DirNode} node
 * @returns {number}
 */
function countFolders(node) {
  let count = 1; // count this directory
  for (const child of node.children ?? []) {
    if (child.type === 'directory') {
      count += countFolders(child);
    }
  }
  return count;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function scan(targetPath) {
  const rootPath = path.resolve(targetPath);

  // Validate target
  let stat;
  try {
    stat = fs.statSync(rootPath);
  } catch {
    throw new Error(`Path does not exist: ${rootPath}`);
  }

  /** @type {Array<string>} */
  const flatFiles   = [];
  /** @type {Array<string>} */
  const entryPoints = [];

  const startTime   = performance.now();
  let tree;
  let projectType = 'Unknown';
  let totalFolders = 0;

  if (stat.isDirectory()) {
    tree = walkDirectory(rootPath, rootPath, flatFiles, entryPoints);
    projectType = detectProjectType(rootPath);
    // Count all directory nodes in the tree (excluding root itself).
    totalFolders = countFolders(tree) - 1;
  } else if (stat.isFile()) {
    const relFilePath = path.basename(rootPath);
    tree = {
      type: 'directory',
      name: path.basename(path.dirname(rootPath)),
      fullPath: path.dirname(rootPath),
      relPath: '.',
      children: [{
        type: 'file',
        name: relFilePath,
        fullPath: rootPath,
        relPath: relFilePath
      }]
    };
    flatFiles.push(relFilePath);
    if (isEntryPoint(relFilePath)) {
      entryPoints.push(relFilePath);
    }
  } else {
    throw new Error(`Path is neither a file nor a directory: ${rootPath}`);
  }

  const scanDurationMs = performance.now() - startTime;

  return {
    rootPath,
    projectType,
    entryPoints,
    tree,
    flatFiles,
    totalFolders,
    scanDurationMs,
  };
}
