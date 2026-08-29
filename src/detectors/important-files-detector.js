/**
 * @fileoverview Toren — Important File Detector
 *
 * Identifies the most strategically significant files in a project, based
 * on the already-scanned flat file list and detected project context.
 *
 * Design contract:
 *  - Pure function. Uses only the data already produced by scan().
 *  - No filesystem I/O. No directory traversal.
 *  - Deterministic: same input always produces the same output.
 *  - No duplicates: each path appears at most once (highest priority wins).
 *  - Sorted: highest priority first; ties broken alphabetically by path.
 *  - Never returns null; importantFiles is always an array.
 *  - Framework-specific files are only marked important when they exist.
 *
 * Priority anchors:
 *  100 – Project manifest (package.json, pom.xml, Cargo.toml, …)
 *   95 – Primary documentation (README.md)
 *   90 – Primary detected entry point
 *   85 – Framework configuration (next.config.*, vite.config.*, …)
 *   82 – App-level framework files (root layout, root page, …)
 *   80 – Environment documentation (.env.example)
 *   78 – Secondary framework files (middleware, server entry)
 *   75 – TypeScript / language config
 *   72 – Project-specific config (routes, config/application)
 *   70 – Container (Dockerfile)
 *   68 – Container orchestration (docker-compose)
 *
 * @module detectors/important-files-detector
 */

// ---------------------------------------------------------------------------
// Types (JSDoc — no TypeScript dependency required)
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} ImportantFile
 * @property {string} path     - POSIX relative path from the project root
 * @property {string} type     - Semantic role: 'manifest' | 'documentation' |
 *                               'entry-point' | 'configuration' | 'environment' |
 *                               'container' | 'utility'
 * @property {string} reason   - Human-readable explanation of why this file matters
 * @property {number} priority - Sort weight; higher = more important
 */

// ---------------------------------------------------------------------------
// Static candidate tables — files important for every project type
// ---------------------------------------------------------------------------

/**
 * Files that are generically important regardless of project type.
 * Each entry is included only if the file actually exists in flatFiles.
 *
 * @type {ImportantFile[]}
 */
const GENERIC_CANDIDATES = [
  // ── Package manager manifests ─────────────────────────────────────────────
  {
    path:     'package.json',
    type:     'manifest',
    reason:   'Defines dependencies, scripts, and project metadata',
    priority: 100,
  },

  // ── Primary documentation ─────────────────────────────────────────────────
  {
    path:     'README.md',
    type:     'documentation',
    reason:   'Primary project documentation',
    priority: 95,
  },
  {
    path:     'README',
    type:     'documentation',
    reason:   'Primary project documentation',
    priority: 95,
  },

  // ── Environment documentation ─────────────────────────────────────────────
  {
    path:     '.env.example',
    type:     'environment',
    reason:   'Documents required environment variables',
    priority: 80,
  },
  {
    path:     '.env.sample',
    type:     'environment',
    reason:   'Documents required environment variables',
    priority: 80,
  },

  // ── TypeScript ────────────────────────────────────────────────────────────
  {
    path:     'tsconfig.json',
    type:     'configuration',
    reason:   'TypeScript compiler configuration',
    priority: 75,
  },

  // ── Container ─────────────────────────────────────────────────────────────
  {
    path:     'Dockerfile',
    type:     'container',
    reason:   'Container build configuration',
    priority: 70,
  },
  {
    path:     'docker-compose.yml',
    type:     'container',
    reason:   'Multi-container Docker configuration',
    priority: 68,
  },
  {
    path:     'docker-compose.yaml',
    type:     'container',
    reason:   'Multi-container Docker configuration',
    priority: 68,
  },
];

/**
 * Non-JS project manifests — same role as package.json for their ecosystems.
 * Checked unconditionally because they might be present in polyglot repos.
 *
 * @type {ImportantFile[]}
 */
const ECOSYSTEM_MANIFESTS = [
  {
    path:     'pom.xml',
    type:     'manifest',
    reason:   'Maven project descriptor and dependency manifest',
    priority: 100,
  },
  {
    path:     'build.gradle',
    type:     'manifest',
    reason:   'Gradle build script and dependency manifest',
    priority: 100,
  },
  {
    path:     'build.gradle.kts',
    type:     'manifest',
    reason:   'Gradle Kotlin DSL build script',
    priority: 100,
  },
  {
    path:     'Cargo.toml',
    type:     'manifest',
    reason:   'Rust package manifest and dependency configuration',
    priority: 100,
  },
  {
    path:     'composer.json',
    type:     'manifest',
    reason:   'PHP Composer dependency manifest',
    priority: 100,
  },
  {
    path:     'Gemfile',
    type:     'manifest',
    reason:   'Ruby gem dependency manifest',
    priority: 100,
  },
  {
    path:     'go.mod',
    type:     'manifest',
    reason:   'Go module definition and dependency manifest',
    priority: 100,
  },
  {
    path:     'pyproject.toml',
    type:     'manifest',
    reason:   'Python project configuration and dependency manifest',
    priority: 100,
  },
  {
    path:     'requirements.txt',
    type:     'manifest',
    reason:   'Python runtime dependency list',
    priority: 95,
  },
];

// ---------------------------------------------------------------------------
// Pattern-matching helpers (no filesystem access — operate on flatFiles array)
// ---------------------------------------------------------------------------

/**
 * Push a candidate entry if the exact path exists in the file set.
 *
 * @param {ImportantFile[]} out
 * @param {Set<string>}     fileSet
 * @param {string}          filePath
 * @param {string}          type
 * @param {string}          reason
 * @param {number}          priority
 */
function addExact(out, fileSet, filePath, type, reason, priority) {
  if (fileSet.has(filePath)) {
    out.push({ path: filePath, type, reason, priority });
  }
}

/**
 * Push candidates for all files whose path starts with the given prefix.
 * Used for patterns like 'vite.config.' (matches vite.config.js, .ts, .mjs …).
 *
 * @param {ImportantFile[]} out
 * @param {string[]}        flatFiles
 * @param {string}          prefix      - e.g. 'vite.config.'
 * @param {string}          type
 * @param {string}          reason
 * @param {number}          priority
 */
function addPrefix(out, flatFiles, prefix, type, reason, priority) {
  for (const f of flatFiles) {
    if (f.startsWith(prefix)) {
      out.push({ path: f, type, reason, priority });
    }
  }
}

/**
 * Push candidates for all files whose path ends with the given suffix.
 * Used for patterns like '*Application.java' (matches any depth).
 *
 * @param {ImportantFile[]} out
 * @param {string[]}        flatFiles
 * @param {string}          suffix      - e.g. 'Application.java'
 * @param {string}          type
 * @param {string}          reason
 * @param {number}          priority
 */
function addSuffix(out, flatFiles, suffix, type, reason, priority) {
  for (const f of flatFiles) {
    if (f.endsWith(suffix)) {
      out.push({ path: f, type, reason, priority });
    }
  }
}

/**
 * Push candidates for root-level files matching `stem.*`.
 * "Root-level" means the path contains no '/' after the stem.
 * Used for patterns like 'server.*', 'app.*' (root only, not src/server.*).
 *
 * @param {ImportantFile[]} out
 * @param {string[]}        flatFiles
 * @param {string}          stem        - e.g. 'server.' (note trailing dot)
 * @param {string}          type
 * @param {string}          reason
 * @param {number}          priority
 */
function addRootPrefix(out, flatFiles, stem, type, reason, priority) {
  for (const f of flatFiles) {
    // Must start with stem AND have no directory separator in the remainder
    if (f.startsWith(stem) && !f.slice(stem.length).includes('/')) {
      out.push({ path: f, type, reason, priority });
    }
  }
}

// ---------------------------------------------------------------------------
// Project-specific candidate builder
// ---------------------------------------------------------------------------

/**
 * Return framework-specific candidates based on detected project type.
 * Only files that exist in flatFiles are included (checked by callers via
 * addExact/addPrefix/addSuffix/addRootPrefix).
 *
 * @param {string}   projectType  - From ScanResult.projectType
 * @param {string[]} flatFiles    - All scanned file paths
 * @param {Set<string>} fileSet   - flatFiles as Set for O(1) lookup
 * @returns {ImportantFile[]}
 */
function getProjectCandidates(projectType, flatFiles, fileSet) {
  const out = [];
  const pt  = projectType.toLowerCase();

  // ── Framework build configs (apply to many ecosystems) ───────────────────
  addPrefix(out, flatFiles, 'vite.config.',   'configuration', 'Vite build and development configuration',     85);
  addPrefix(out, flatFiles, 'webpack.config.','configuration', 'Webpack bundler configuration',                85);

  // ── Next.js ───────────────────────────────────────────────────────────────
  if (pt.includes('next')) {
    // Framework config
    for (const f of ['next.config.js', 'next.config.mjs', 'next.config.ts']) {
      addExact(out, fileSet, f, 'configuration', 'Next.js framework configuration', 85);
    }
    // App Router
    for (const ext of ['js', 'jsx', 'ts', 'tsx']) {
      addExact(out, fileSet, `app/layout.${ext}`, 'entry-point', 'Root layout for the Next.js App Router', 82);
      addExact(out, fileSet, `app/page.${ext}`,   'entry-point', 'Root page for the Next.js App Router',   81);
    }
    // Edge middleware
    for (const f of ['middleware.js', 'middleware.ts']) {
      addExact(out, fileSet, f, 'configuration', 'Next.js edge middleware', 78);
    }
    // Pages Router
    addPrefix(out, flatFiles, 'pages/index.', 'entry-point', 'Home page for the Next.js Pages Router', 78);
  }

  // ── Nuxt.js ───────────────────────────────────────────────────────────────
  else if (pt.includes('nuxt')) {
    for (const f of ['nuxt.config.js', 'nuxt.config.ts', 'nuxt.config.mjs']) {
      addExact(out, fileSet, f, 'configuration', 'Nuxt.js framework configuration', 85);
    }
    for (const ext of ['js', 'vue', 'ts']) {
      addExact(out, fileSet, `app.${ext}`,        'entry-point', 'Nuxt application root',            82);
      addExact(out, fileSet, `pages/index.${ext}`, 'entry-point', 'Nuxt home page (Pages Router)', 78);
    }
  }

  // ── React (Vite / CRA) ───────────────────────────────────────────────────
  else if (pt.includes('react')) {
    addPrefix(out, flatFiles, 'src/main.', 'entry-point', 'Application entry point',      82);
    addPrefix(out, flatFiles, 'src/App.',  'entry-point', 'Root application component',   78);
    // CRA fallback
    addExact(out, fileSet, 'public/index.html', 'entry-point', 'Application HTML entry point', 76);
  }

  // ── Vue.js ────────────────────────────────────────────────────────────────
  else if (pt.includes('vue')) {
    for (const f of ['vue.config.js', 'vue.config.ts']) {
      addExact(out, fileSet, f, 'configuration', 'Vue CLI configuration', 85);
    }
    addPrefix(out, flatFiles, 'src/main.', 'entry-point', 'Application entry point',    82);
    addPrefix(out, flatFiles, 'src/App.',  'entry-point', 'Root application component', 78);
  }

  // ── Angular ───────────────────────────────────────────────────────────────
  else if (pt.includes('angular')) {
    addExact(out, fileSet, 'angular.json',        'configuration', 'Angular workspace configuration', 85);
    addPrefix(out, flatFiles, 'src/main.',        'entry-point',   'Angular bootstrap entry point',   82);
    addExact(out, fileSet, 'src/app/app.module.ts',  'entry-point', 'Angular root module',            80);
    addExact(out, fileSet, 'src/app/app.component.ts','entry-point','Angular root component',         78);
  }

  // ── Svelte ────────────────────────────────────────────────────────────────
  else if (pt.includes('svelte')) {
    for (const f of ['svelte.config.js', 'svelte.config.ts']) {
      addExact(out, fileSet, f, 'configuration', 'SvelteKit / Svelte configuration', 85);
    }
    addPrefix(out, flatFiles, 'src/routes/+page.', 'entry-point', 'SvelteKit home page route', 82);
    addPrefix(out, flatFiles, 'src/main.',          'entry-point', 'Svelte application entry point', 80);
    addPrefix(out, flatFiles, 'src/App.',           'entry-point', 'Svelte root component', 78);
  }

  // ── Express / Fastify / Koa (Node.js server frameworks) ──────────────────
  else if (pt.includes('express') || pt.includes('fastify') || pt.includes('koa')) {
    addRootPrefix(out, flatFiles, 'server.', 'entry-point', 'Server application entry point', 82);
    addRootPrefix(out, flatFiles, 'app.',    'entry-point', 'Application entry point',        80);
    addPrefix(out, flatFiles, 'src/server.', 'entry-point', 'Server application entry point', 80);
    addPrefix(out, flatFiles, 'src/app.',    'entry-point', 'Application entry point',        78);
    // Common conventions
    addExact(out, fileSet, 'src/index.js',  'entry-point', 'Application entry point', 76);
    addExact(out, fileSet, 'src/index.ts',  'entry-point', 'Application entry point', 76);
  }

  // ── Python ────────────────────────────────────────────────────────────────
  if (pt.includes('python')) {
    addExact(out, fileSet, 'main.py',    'entry-point',   'Main Python application entry point',  82);
    addExact(out, fileSet, 'manage.py',  'entry-point',   'Django project management CLI',         82);
    addExact(out, fileSet, 'app.py',     'entry-point',   'Flask / web framework application',     80);
    addExact(out, fileSet, 'wsgi.py',    'configuration', 'WSGI server entry point',               75);
    addExact(out, fileSet, 'asgi.py',    'configuration', 'ASGI server entry point',               75);
  }

  // ── Java / Spring Boot ────────────────────────────────────────────────────
  if (pt.includes('java') || pt.includes('spring')) {
    addExact(out, fileSet, 'pom.xml',          'manifest', 'Maven project descriptor and dependency manifest', 100);
    addExact(out, fileSet, 'build.gradle',     'manifest', 'Gradle build script and dependency manifest',      100);
    addExact(out, fileSet, 'build.gradle.kts', 'manifest', 'Gradle Kotlin DSL build script',                   100);
    addSuffix(out, flatFiles, 'Application.java', 'entry-point', 'Spring Boot application entry point',  82);
    addSuffix(out, flatFiles, 'Application.kt',   'entry-point', 'Spring Boot Kotlin application entry point', 82);
    // Main application properties
    addExact(out, fileSet, 'src/main/resources/application.properties', 'configuration',
      'Spring Boot application configuration', 78);
    addExact(out, fileSet, 'src/main/resources/application.yml', 'configuration',
      'Spring Boot application configuration', 78);
  }

  // ── Go ────────────────────────────────────────────────────────────────────
  if (pt === 'go') {
    addExact(out, fileSet, 'go.mod',   'manifest',   'Go module definition and dependency manifest', 100);
    addExact(out, fileSet, 'go.sum',   'manifest',   'Go module checksums',                           92);
    addExact(out, fileSet, 'main.go',  'entry-point','Main Go application entry point',              82);
    addExact(out, fileSet, 'Makefile', 'utility',    'Build and task automation',                     72);
  }

  // ── Rust ──────────────────────────────────────────────────────────────────
  if (pt.includes('rust')) {
    addExact(out, fileSet, 'Cargo.toml',   'manifest',   'Rust package manifest and dependency configuration', 100);
    addExact(out, fileSet, 'Cargo.lock',   'manifest',   'Rust dependency lockfile',                            92);
    addExact(out, fileSet, 'src/main.rs',  'entry-point','Binary crate entry point',                           82);
    addExact(out, fileSet, 'src/lib.rs',   'entry-point','Library crate root',                                 82);
  }

  // ── PHP / Laravel / Composer ──────────────────────────────────────────────
  if (pt.includes('php') || pt.includes('composer')) {
    addExact(out, fileSet, 'composer.json',   'manifest',   'PHP Composer dependency manifest',           100);
    addExact(out, fileSet, 'artisan',         'utility',    'Laravel CLI tool',                            82);
    addExact(out, fileSet, 'routes/web.php',  'configuration','Web route definitions',                    78);
    addExact(out, fileSet, 'routes/api.php',  'configuration','API route definitions',                    78);
    addExact(out, fileSet, 'public/index.php','entry-point', 'HTTP front controller (Laravel / PHP)',      76);
  }

  // ── Ruby / Rails ──────────────────────────────────────────────────────────
  if (pt.includes('ruby') || pt.includes('rails')) {
    addExact(out, fileSet, 'Gemfile',                  'manifest',     'Ruby gem dependency manifest',    100);
    addExact(out, fileSet, 'config/routes.rb',         'configuration','Rails route definitions',          78);
    addExact(out, fileSet, 'config/application.rb',    'configuration','Rails application configuration',  76);
    addExact(out, fileSet, 'config/environment.rb',    'configuration','Rails environment bootstrap',      74);
    addExact(out, fileSet, 'app/controllers/application_controller.rb', 'entry-point',
      'Rails base application controller', 72);
  }

  // ── Elixir / Phoenix ─────────────────────────────────────────────────────
  if (pt.includes('elixir') || pt.includes('phoenix')) {
    addExact(out, fileSet, 'mix.exs',   'manifest',  'Elixir Mix build and dependency manifest', 100);
    addExact(out, fileSet, 'mix.lock',  'manifest',  'Elixir Mix dependency lockfile',            92);
    addPrefix(out, flatFiles, 'lib/', 'entry-point', 'Elixir application module', 75);
  }

  return out;
}

// ---------------------------------------------------------------------------
// Deduplication and sort
// ---------------------------------------------------------------------------

/**
 * Merge a list of raw candidates into a deduplicated, sorted result.
 * When the same path appears with different priorities, the highest wins.
 * Ties in priority are broken by ascending alphabetical path order.
 *
 * @param {ImportantFile[]} rawCandidates
 * @returns {ImportantFile[]}
 */
function deduplicateAndSort(rawCandidates) {
  /** @type {Map<string, ImportantFile>} */
  const best = new Map();

  for (const candidate of rawCandidates) {
    const existing = best.get(candidate.path);
    if (!existing || candidate.priority > existing.priority) {
      best.set(candidate.path, candidate);
    }
  }

  return Array.from(best.values()).sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority; // higher first
    return a.path.localeCompare(b.path);                           // alpha on ties
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Detect strategically important files in a scanned project.
 *
 * Uses only data already produced by scan() — no new filesystem operations.
 *
 * @param {Object}   params
 * @param {string[]} params.flatFiles    - All relative POSIX file paths from the scanner
 * @param {string}   params.projectType  - Detected project type (e.g. 'React', 'Go')
 * @param {string[]} params.entryPoints  - Detected entry point paths
 * @param {string[]} params.configs      - Detected configuration file paths
 * @returns {{ importantFiles: ImportantFile[] }}
 */
export function detectImportantFiles({ flatFiles, projectType, entryPoints, configs }) {
  const fileSet = new Set(flatFiles);

  /** @type {ImportantFile[]} */
  const raw = [];

  // ── 1. Generic files (always check, any project type) ────────────────────
  for (const candidate of GENERIC_CANDIDATES) {
    if (fileSet.has(candidate.path)) {
      raw.push({ ...candidate });
    }
  }

  for (const candidate of ECOSYSTEM_MANIFESTS) {
    if (fileSet.has(candidate.path)) {
      raw.push({ ...candidate });
    }
  }

  // ── 2. Primary entry point ────────────────────────────────────────────────
  if (entryPoints.length > 0) {
    const primary = entryPoints[0];
    if (fileSet.has(primary)) {
      raw.push({
        path:     primary,
        type:     'entry-point',
        reason:   'Primary application entry point',
        priority: 90,
      });
    }
  }

  // ── 3. Project-specific candidates ───────────────────────────────────────
  const projectCandidates = getProjectCandidates(projectType, flatFiles, fileSet);
  for (const c of projectCandidates) {
    raw.push(c);
  }

  // ── 4. Deduplicate, resolve priority conflicts, and sort ──────────────────
  return { importantFiles: deduplicateAndSort(raw) };
}
