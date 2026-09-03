import fs from 'node:fs';
import path from 'node:path';
import type { ProjectInfo, PackageManager, ScriptInfo } from '../types/index.js';

interface DetectProjectInfoOptions {
  rootPath: string;
  projectType: string;
  flatFiles: string[];
  entryPoints: string[];
  packageManager: PackageManager | null;
  scripts: ScriptInfo[];
}

export function detectProjectInfo({
  rootPath,
  projectType,
  flatFiles,
  entryPoints,
  packageManager,
  scripts
}: DetectProjectInfoOptions): { projectInfo: ProjectInfo } {
  const fileSet = new Set(flatFiles);

  let name: string | null = null;
  const pkgPath = path.join(rootPath, 'package.json');
  try {
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      if (pkg && typeof pkg === 'object' && 'name' in pkg && typeof pkg.name === 'string') {
        name = pkg.name;
      }
    }
  } catch {}
  if (!name) {
    name = path.basename(rootPath) || null;
  }

  let runtime: string | null = null;
  const pt = projectType.toLowerCase();
  if (pt.includes('node') || fileSet.has('package.json')) runtime = 'Node.js';
  else if (pt.includes('python')) runtime = 'Python';
  else if (pt.includes('java') || pt.includes('spring')) runtime = 'JVM / Java';
  else if (pt.includes('go')) runtime = 'Go';
  else if (pt.includes('rust')) runtime = 'Rust';
  else if (pt.includes('ruby')) runtime = 'Ruby';
  else if (pt.includes('php') || pt.includes('composer')) runtime = 'PHP';
  else if (pt.includes('elixir') || pt.includes('phoenix')) runtime = 'Erlang / BEAM';

  let language: string | null = null;
  if (fileSet.has('tsconfig.json') || pt.includes('angular')) {
    language = 'TypeScript';
  } else if (fileSet.has('package.json') && !fileSet.has('tsconfig.json')) {
    language = 'JavaScript';
  } else if (pt.includes('python')) language = 'Python';
  else if (pt.includes('java') || pt.includes('spring')) language = 'Java';
  else if (pt.includes('go')) language = 'Go';
  else if (pt.includes('rust')) language = 'Rust';
  else if (pt.includes('ruby')) language = 'Ruby';
  else if (pt.includes('php')) language = 'PHP';
  else if (pt.includes('elixir')) language = 'Elixir';

  let framework: string | null = null;
  if (projectType && projectType !== 'Unknown') {
    framework = projectType;
  }

  let architecture: string | null = null;
  if (pt.includes('next')) {
    const hasApp = Array.from(fileSet).some(f => f.startsWith('app/'));
    const hasPages = Array.from(fileSet).some(f => f.startsWith('pages/'));
    if (hasApp && hasPages) architecture = 'Hybrid App/Pages Router';
    else if (hasApp) architecture = 'App Router';
    else if (hasPages) architecture = 'Pages Router';
  }

  const entryPoint = entryPoints.length > 0 ? entryPoints[0] : null;

  let sourceDirectory: string | null = null;
  if (entryPoint) {
    if (entryPoint.startsWith('src/')) sourceDirectory = 'src';
    else if (entryPoint.startsWith('app/')) sourceDirectory = 'app';
    else if (entryPoint.startsWith('pages/')) sourceDirectory = 'pages';
  }

  return {
    projectInfo: {
      name,
      projectType,
      runtime,
      language,
      framework,
      architecture,
      packageManager,
      entryPoint,
      sourceDirectory
    }
  };
}
