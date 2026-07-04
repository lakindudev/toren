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
 * This module is intentionally free of side-effects (no console.log),
 * except for warnings about unreadable directories.
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
  '.svelte-kit',
  '.turbo',
  '.parcel-cache',
  '.DS_Store'
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

// ---------------------------------------------------------------------------
// Types (JSDoc — no TypeScript dependency required)
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} FileNode
 * @property {'file'} type
 * @property {string} name      - Basename of the file
 * @property {string} fullPath  - Absolute path
 * @property {string} relPath   - Path relative to the scanned root (POSIX style)
 */

/**
 * @typedef {Object} DirNode
 * @property {'directory'} type
 * @property {string} name      - Basename of the directory
 * @property {string} fullPath  - Absolute path
 * @property {string} relPath   - Path relative to the scanned root (POSIX style)
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
 * Normalize a path to use POSIX separators ('/').
 */
function toPosix(p) {
  return p.replace(/\\/g, '/');
}

/**
 * Determine whether a directory entry should be skipped.
 *
 * @param {string} name - Basename of the entry
 * @param {fs.Dirent} dirent
 * @param {boolean} includeHidden
 * @returns {boolean}
 */
function shouldIgnore(name, dirent, includeHidden) {
  if (!includeHidden && name.startsWith('.')) return true;
  return IGNORED_DIRS.has(name);
}

/**
 * Recursively walk `dirPath`, building a DirNode tree.
 * Also populates `flatFiles` array by reference.
 *
 * @param {string} dirPath      - Absolute path of the current directory
 * @param {string} rootPath     - Absolute path of the scan root (for relative paths)
 * @param {Array<string>} flatFiles - Accumulator for all relative file paths
 * @param {boolean} includeHidden - Whether to include hidden files
 * @param {number} maxFiles - Maximum number of files to scan before aborting
 * @returns {DirNode}
 */
function walkDirectory(dirPath, rootPath, flatFiles, includeHidden, maxFiles) {
  const name    = path.basename(dirPath);
  let rawRelPath = path.relative(rootPath, dirPath) || '.';
  const relPath = toPosix(rawRelPath);

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
  } catch (err) {
    // Permission-denied or unreadable directory — skip and log warnings instead of failing.
    console.warn(`[warn] Skipping ${dirPath} (permission denied)`);
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
    if (shouldIgnore(dirent.name, dirent, includeHidden)) continue;

    const childPath = path.join(dirPath, dirent.name);

    // Explicitly skip symbolic links to prevent infinite loops and unsafe traversals
    if (dirent.isSymbolicLink()) continue;

    if (dirent.isDirectory()) {
      const childNode = walkDirectory(childPath, rootPath, flatFiles, includeHidden, maxFiles);
      node.children.push(childNode);
    } else if (dirent.isFile()) {
      if (flatFiles.length >= maxFiles) {
        throw new Error(`Max file scan limit exceeded (${maxFiles} files). Use --max-files <number> to increase the limit.`);
      }
      const relFilePath = toPosix(path.relative(rootPath, childPath));

      /** @type {FileNode} */
      const fileNode = {
        type:     'file',
        name:     dirent.name,
        fullPath: childPath,
        relPath:  relFilePath,
      };

      node.children.push(fileNode);
      flatFiles.push(relFilePath);
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
// Entry Point Heuristics
// ---------------------------------------------------------------------------

const FALSE_POSITIVES = [
  '/internal/', '/renderer/', '/renderers/', '/dist/', '/build/', '/generated/', '/node_modules/'
];

function isFalsePositive(relPath) {
  const normalized = '/' + relPath + '/'; // relPath is already POSIX
  if (FALSE_POSITIVES.some(fp => normalized.includes(fp))) return true;
  if (relPath.includes('.test.') || relPath.includes('.spec.')) return true;
  // Exclude config files usually not entry points
  if (relPath.endsWith('.config.js') || relPath.endsWith('.config.ts')) return true;
  return false;
}

function findEntryPoints(projectType, flatFiles, rootPath) {
  let entries = [];
  const validFiles = flatFiles.filter(f => !isFalsePositive(f));
  const validSet = new Set(validFiles);
  
  if (projectType === 'Node.js / JavaScript' || projectType.startsWith('Node.js')) {
    try {
      const pkgPath = path.join(rootPath, 'package.json');
      if (fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        if (pkg.bin) {
          if (typeof pkg.bin === 'string') entries.push(pkg.bin);
          else Object.values(pkg.bin).forEach(b => entries.push(b));
        }
        if (pkg.main) entries.push(pkg.main);
      }
    } catch {}
    
    // Normalize and filter package.json entries to ensure they exist
    entries = entries.map(e => toPosix(e).replace(/^\.\//, '')).filter(e => validSet.has(e));
    
    if (entries.length === 0) {
      const fallbacks = ['src/index.ts', 'src/index.js', 'lib/index.js', 'index.js'];
      for (const f of fallbacks) {
        if (validSet.has(f)) { entries.push(f); break; }
      }
    }
  } else if (projectType === 'React' || projectType === 'Next.js' || projectType === 'Vue.js' || projectType === 'Angular' || projectType === 'Svelte') {
    const priorities = ['src/main.tsx', 'src/main.jsx', 'pages/_app.tsx', 'app/layout.tsx', 'src/App.tsx', 'index.html'];
    for (const p of priorities) {
      if (validSet.has(p)) { entries.push(p); break; }
    }
  } else if (projectType.includes('Java')) {
    const applicationJava = validFiles.filter(f => f.endsWith('Application.java'));
    if (applicationJava.length > 0) {
      entries.push(...applicationJava);
    } else {
      for (const f of validFiles) {
        if (f.endsWith('.java')) {
          try {
            const content = fs.readFileSync(path.join(rootPath, f), 'utf8');
            if (content.includes('public static void main')) {
              entries.push(f);
              break;
            }
          } catch {}
        }
      }
    }
  } else if (projectType.includes('Python')) {
    const priorities = ['main.py', 'app.py', '__main__.py'];
    for (const p of priorities) {
      if (validSet.has(p)) { entries.push(p); break; }
    }
    if (entries.length === 0) {
      for (const f of validFiles) {
        if (f.endsWith('.py')) {
          try {
            const content = fs.readFileSync(path.join(rootPath, f), 'utf8');
            if (content.includes('if __name__ == "__main__":') || content.includes("if __name__ == '__main__':")) {
              entries.push(f);
              break;
            }
          } catch {}
        }
      }
    }
  } else if (projectType === 'Go') {
    const priorities = ['main.go', 'cmd/main.go', 'cmd/api/main.go'];
    for (const p of priorities) {
      if (validSet.has(p)) { entries.push(p); break; }
    }
  } else if (projectType === 'Rust') {
    const priorities = ['src/main.rs', 'src/lib.rs'];
    for (const p of priorities) {
      if (validSet.has(p)) { entries.push(p); break; }
    }
  }
  
  if (entries.length === 0) {
    // Fallbacks for Unknown or missed projects
    let best = null;
    let maxScore = -1;
    for (const f of validFiles) {
      if (/^(src\/)?index\.[a-z]+$/.test(f)) {
        entries.push(f);
        break;
      }
    }
    if (entries.length === 0) {
      for (const f of validFiles) {
        if (f.match(/\.(js|ts|jsx|tsx|py|java|go|rs|rb|php)$/)) {
          try {
            const content = fs.readFileSync(path.join(rootPath, f), 'utf8');
            const score = (content.match(/import /g) || []).length + 
                          (content.match(/export /g) || []).length + 
                          (content.match(/require\(/g) || []).length;
            if (score > maxScore) {
              maxScore = score;
              best = f;
            }
          } catch {}
        }
      }
      if (best) entries.push(best);
    }
  }
  
  return Array.from(new Set(entries));
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

export function scan(targetPath, options = {}) {
  const rootPath = path.resolve(targetPath);
  const includeHidden = !!options.includeHidden;
  const maxFiles = options.maxFiles || 50000; // Default cap of 50k files for huge repos

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
  let entryPoints = [];

  const startTime   = performance.now();
  let tree;
  let projectType = 'Unknown';
  let totalFolders = 0;

  if (stat.isDirectory()) {
    tree = walkDirectory(rootPath, rootPath, flatFiles, includeHidden, maxFiles);
    projectType = detectProjectType(rootPath);
    // Count all directory nodes in the tree (excluding root itself).
    totalFolders = countFolders(tree) - 1;
    entryPoints = findEntryPoints(projectType, flatFiles, rootPath);
  } else if (stat.isFile()) {
    const relFilePath = toPosix(path.basename(rootPath));
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
    entryPoints = [relFilePath]; // A single file is its own entry point
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
