export interface DirectoryNode {
  type: "directory";
  name: string;
  fullPath: string;
  relPath: string;
  children: TreeNode[];
}

export interface FileNode {
  type: "file";
  name: string;
  fullPath: string;
  relPath: string;
}

export type TreeNode = DirectoryNode | FileNode;
export type DirNode = DirectoryNode;

export interface ScriptInfo {
  name: string;
  command: string;
  usage: string | null;
  description: string | null;
  category: string | null;
}

export type PackageManager = "npm" | "pnpm" | "yarn" | "bun";

export type ImportantFileType =
  | "manifest"
  | "documentation"
  | "entry-point"
  | "configuration"
  | "environment"
  | "container"
  | "framework"
  | "build"
  | "testing"
  | "database";

export interface ImportantFile {
  path: string;
  type: ImportantFileType | string;
  reason: string;
  priority: number;
}

export interface ProjectInfo {
  name: string | null;
  projectType: string;
  runtime: string | null;
  language: string | null;
  framework: string | null;
  architecture: string | null;
  packageManager: PackageManager | null;
  entryPoint: string | null;
  sourceDirectory: string | null;
}

export type HealthStatus = "pass" | "warning" | "info" | "fail";

export interface HealthObservation {
  id: string;
  status: HealthStatus;
  message: string;
}

// ---------------------------------------------------------------------------
// Technology Stack Intelligence — v1.1.0
// ---------------------------------------------------------------------------

/**
 * Broad functional grouping for a detected technology.
 */
export type TechnologyCategory =
  | "language"
  | "runtime"
  | "frontend"
  | "backend"
  | "styling"
  | "database"
  | "orm"
  | "testing"
  | "build"
  | "quality"
  | "container"
  | "deployment"
  | "package-manager"
  | "other";

/**
 * The kind of signal that produced a technology detection.
 *
 * - "dependency"     — found in package.json `dependencies`
 * - "devDependency"  — found in package.json `devDependencies`
 * - "peerDependency" — found in package.json `peerDependencies`
 * - "config"         — a recognised configuration file (e.g. tailwind.config.ts)
 * - "file"           — a specific file present in the repository
 * - "directory"      — a specific directory present in the repository
 * - "script"         — a package.json script command keyword
 * - "manifest"       — a non-package.json manifest file (e.g. Dockerfile, go.mod)
 */
export type TechnologyEvidenceType =
  | "dependency"
  | "devDependency"
  | "peerDependency"
  | "config"
  | "file"
  | "directory"
  | "script"
  | "manifest";

/**
 * A single piece of evidence that led to a technology being detected.
 *
 * @example
 * { type: "dependency", value: "next" }
 * { type: "config",     value: "tailwind.config.ts" }
 */
export interface TechnologyEvidence {
  /** The kind of signal that provided evidence. */
  type: TechnologyEvidenceType;
  /** The raw value of the signal (package name, filename, etc.). */
  value: string;
}

/**
 * A single detected technology with its category, confidence score,
 * and the evidence that supports the detection.
 *
 * @example
 * {
 *   name: "Next.js",
 *   category: "frontend",
 *   confidence: 1,
 *   evidence: [{ type: "dependency", value: "next" }]
 * }
 */
export interface Technology {
  /** Human-readable technology name (e.g. "Next.js", "Tailwind CSS"). */
  name: string;
  /** Functional grouping used for rendering and filtering. */
  category: TechnologyCategory;
  /**
   * Detection confidence in the range [0, 1].
   * 1 = certain (e.g. direct dependency present).
   * 0 = speculative (e.g. heuristic only).
   */
  confidence: number;
  /** One or more signals that triggered this detection. */
  evidence: TechnologyEvidence[];
}

// ---------------------------------------------------------------------------
// Technology Stack Intelligence — v1.1.2: Relationships
// ---------------------------------------------------------------------------

/**
 * The kind of relationship between two detected technologies.
 *
 * - "built-with"    — technology A is a meta-framework/layer built on top of B
 *                     (e.g. Next.js built-with React, SvelteKit built-with Svelte)
 * - "runs-on"       — technology A requires runtime B to operate
 *                     (e.g. Express runs-on Node.js)
 * - "uses"          — technology A has a direct conceptual dependency on B
 *                     (e.g. Mongoose uses MongoDB, Docker Compose uses Docker)
 * - "styled-with"   — A UI framework or app uses B for styling
 *                     (e.g. Next.js styled-with Tailwind CSS)
 * - "stores-data-in"— an ORM or data layer targets B as its database
 *                     (e.g. Prisma stores-data-in PostgreSQL)
 * - "tested-with"   — A is commonly combined with testing utility B
 *                     (e.g. Jest tested-with Testing Library)
 * - "deployed-with" — the project is configured to deploy using platform B
 *                     (e.g. Next.js deployed-with Vercel)
 */
export type TechnologyRelationshipKind =
  | "built-with"
  | "runs-on"
  | "uses"
  | "styled-with"
  | "stores-data-in"
  | "tested-with"
  | "deployed-with";

/**
 * A directed association between two technologies that were both detected
 * in the same project.
 *
 * Relationships are NEVER inferred — both `from` and `to` must appear in
 * the `TechnologyStack.technologies` array for a relationship to be emitted.
 *
 * @example
 * { from: "Next.js",  to: "React",           relationship: "built-with"     }
 * { from: "Prisma",   to: "PostgreSQL",       relationship: "stores-data-in" }
 * { from: "Jest",     to: "Testing Library",  relationship: "tested-with"    }
 */
export interface TechnologyRelationship {
  /** The source technology name — must match a Technology.name in the stack. */
  from: string;
  /** The target technology name — must match a Technology.name in the stack. */
  to: string;
  /** The nature of the association between from and to. */
  relationship: TechnologyRelationshipKind;
}

/**
 * The complete technology stack detected for a project.
 * Always present on ScanResult; defaults to `{ technologies: [], relationships: [] }`.
 */
export interface TechnologyStack {
  technologies: Technology[];
  /**
   * Directed relationships between co-detected technologies.
   * Only populated when both the `from` and `to` technologies are present
   * in `technologies`. Empty array when no known relationships apply.
   */
  relationships: TechnologyRelationship[];
}

// ---------------------------------------------------------------------------
// Technology Stack Intelligence — v1.1.2: Stack Summary
// ---------------------------------------------------------------------------

/**
 * A deterministic, template-based summary of the detected project stack.
 *
 * All fields are optional — the summary gracefully degrades when information
 * is unavailable. No fields are ever null; missing categories produce empty
 * arrays and undefined string fields are simply omitted.
 */
export interface StackSummary {
  /**
   * A short, human-readable description of the project type.
   * Generated from detected language + stack shape.
   * Undefined when the stack is empty or too ambiguous to summarise.
   */
  headline?: string;
  /** Detected frontend / backend frameworks (sorted by category rank, then name). */
  frameworks: string[];
  /** Detected styling technologies. */
  styling: string[];
  /** Detected databases and ORM / data-access tools. */
  data: string[];
  /** Detected testing frameworks and utilities. */
  testing: string[];
}

export interface ScanResult {
  rootPath: string;
  projectType: string;
  entryPoints: string[];
  configs: string[];
  scripts: ScriptInfo[];
  tree: DirNode;
  flatFiles: string[];
  totalFolders: number;
  scanDurationMs: number;

  packageManager: PackageManager | null;
  importantFiles: ImportantFile[];
  projectInfo: ProjectInfo;
  health: HealthObservation[];
  technologyStack: TechnologyStack;
  technologyRelationships: TechnologyRelationship[];
  stackSummary: StackSummary;
}

export type OutputFormat = "console" | "json" | "markdown" | "html";

export interface CliOptions {
  targetPath: string;
  format: OutputFormat;
  maxFiles?: number;
  includeHidden?: boolean;

  projectTypeOnly?: boolean;
  frameworksOnly?: boolean;
  entryPointsOnly?: boolean;
  configsOnly?: boolean;
  structureOnly?: boolean;
  summaryOnly?: boolean;
  importantFilesOnly?: boolean;
  healthOnly?: boolean;
  scriptsOnly?: boolean;
}

declare global {
  interface Error {
    title?: string;
    detailLabel?: string;
    detailValue?: string;
  }
}
