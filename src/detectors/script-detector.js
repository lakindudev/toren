import fs from 'node:fs';
import path from 'node:path';

/**
 * Detects npm/package scripts from package.json in the project root.
 *
 * @param {string} rootPath - The absolute path of the scanned root
 * @returns {{ scripts: Array<{name: string, command: string}> }}
 */
export function detectScripts(rootPath) {
  const scripts = [];
  const pkgPath = path.join(rootPath, 'package.json');

  try {
    if (fs.existsSync(pkgPath)) {
      const content = fs.readFileSync(pkgPath, 'utf8');
      const pkg = JSON.parse(content);

      if (pkg.scripts && typeof pkg.scripts === 'object') {
        for (const [name, command] of Object.entries(pkg.scripts)) {
          if (typeof command === 'string') {
            scripts.push({ name, command });
          }
        }
      }
    }
  } catch (error) {
    // Return empty scripts on malformed or unreadable package.json
  }

  return { scripts };
}
