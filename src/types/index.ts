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
