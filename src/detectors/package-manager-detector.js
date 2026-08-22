/**
 * @fileoverview Toren — Package Manager Detector
 *
 * Identifies which package manager a project uses by inspecting the presence
 * of well-known lockfiles in the repository root.
 *
 * Design contract:
 *  - Pure function. Accepts only the already-scanned flatFiles array.
 *  - No filesystem I/O. No recursive rescan. No external dependencies.
 *  - Only root-level files are considered. A lockfile nested under a
 *    subdirectory (e.g. examples/app/package-lock.json) does NOT influence
 *    the result — it belongs to that sub-project, not the repository root.
 *  - Deterministic: same input always produces the same output.
 *  - Handles ambiguity explicitly: when multiple different package managers
 *    are detected at root, packageManager is set to null and ambiguous is true.
 *
 * Supported lockfiles → package manager:
 *  package-lock.json  → npm
 *  pnpm-lock.yaml     → pnpm
 *  yarn.lock          → yarn
 *  bun.lock           → bun
 *  bun.lockb          → bun
 *
 * @module detectors/package-manager-detector
 */

// ---------------------------------------------------------------------------
// Lockfile registry
// ---------------------------------------------------------------------------

/**
 * Maps a root-level lockfile basename to its package manager name.
 * Evaluation is case-sensitive — lockfile names are always lowercase on all
 * supported platforms.
 *
 * @type {Map<string, string>}
 */
const LOCKFILE_MAP = new Map([
  ['package-lock.json', 'npm'],
  ['pnpm-lock.yaml',    'pnpm'],
  ['yarn.lock',         'yarn'],
  ['bun.lock',          'bun'],
  ['bun.lockb',         'bun'],
]);

// ---------------------------------------------------------------------------
// Types (JSDoc — no TypeScript dependency required)
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} PackageManagerResult
 * @property {string|null}  packageManager  - Detected package manager name, or null
 *                                            when none or multiple are found.
 * @property {string[]}     packageManagers - Sorted list of all detected package managers.
 *                                            Empty when none detected.
 * @property {boolean}      ambiguous       - True when multiple different package managers
 *                                            are detected at root simultaneously.
 */

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Detect the package manager used by a project from its root lockfiles.
 *
 * Only root-level entries in `flatFiles` are examined. A POSIX-style path
 * with no '/' character is at the repository root (e.g. "yarn.lock").
 * Paths that contain '/' are nested files (e.g. "packages/app/yarn.lock")
 * and are intentionally ignored.
 *
 * @param {string[]} flatFiles - POSIX-relative file paths from the scanner.
 *                               Must not be null or undefined.
 * @returns {PackageManagerResult}
 */
export function detectPackageManager(flatFiles) {
  const detected = new Set();

  for (const file of flatFiles) {
    // Root-level only: a POSIX relative path with no '/' is at the root.
    // e.g. "package-lock.json"  ✓ root
    //      "apps/web/yarn.lock" ✗ nested — skip
    if (file.includes('/')) continue;

    const pm = LOCKFILE_MAP.get(file);
    if (pm !== undefined) {
      detected.add(pm);
    }
  }

  // Sort for deterministic output — order of detection must not vary between runs.
  const packageManagers = Array.from(detected).sort();

  if (packageManagers.length === 0) {
    return { packageManager: null, packageManagers: [], ambiguous: false };
  }

  if (packageManagers.length === 1) {
    return {
      packageManager:  packageManagers[0],
      packageManagers: packageManagers,
      ambiguous:       false,
    };
  }

  // Multiple different package managers at root — do not guess.
  return {
    packageManager:  null,
    packageManagers: packageManagers,
    ambiguous:       true,
  };
}
