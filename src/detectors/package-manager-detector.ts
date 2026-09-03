import type { PackageManager } from '../types/index.js';

export interface PackageManagerResult {
  packageManager: PackageManager | null;
  packageManagers: PackageManager[];
  ambiguous: boolean;
}

const LOCKFILE_MAP: Map<string, PackageManager> = new Map([
  ['package-lock.json', 'npm'],
  ['pnpm-lock.yaml',    'pnpm'],
  ['yarn.lock',         'yarn'],
  ['bun.lock',          'bun'],
  ['bun.lockb',         'bun'],
]);

export function detectPackageManager(flatFiles: string[]): PackageManagerResult {
  const detected = new Set<PackageManager>();

  for (const file of flatFiles) {
    if (file.includes('/')) continue;

    const pm = LOCKFILE_MAP.get(file);
    if (pm !== undefined) {
      detected.add(pm);
    }
  }

  const packageManagers = Array.from(detected).sort();

  if (packageManagers.length === 0) {
    return { packageManager: null, packageManagers: [], ambiguous: false };
  }

  if (packageManagers.length === 1) {
    return {
      packageManager: packageManagers[0],
      packageManagers: packageManagers,
      ambiguous: false,
    };
  }

  return {
    packageManager: null,
    packageManagers: packageManagers,
    ambiguous: true,
  };
}
