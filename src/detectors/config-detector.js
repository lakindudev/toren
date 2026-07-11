/**
 * @fileoverview Configuration file detector
 */

/**
 * Detects common configuration files in the root of the repository.
 *
 * @param {string[]} flatFiles - Array of relative file paths from the scanner
 * @returns {{ configs: string[] }}
 */
export function detectConfigs(flatFiles) {
  const configPatterns = [
    /^package\.json$/,
    /^tsconfig\.json$/,
    /^jsconfig\.json$/,
    /^vite\.config\.[a-zA-Z0-9]+$/,
    /^next\.config\.[a-zA-Z0-9]+$/,
    /^nuxt\.config\.[a-zA-Z0-9]+$/,
    /^angular\.json$/,
    /^webpack\.config\.[a-zA-Z0-9]+$/,
    /^rollup\.config\.[a-zA-Z0-9]+$/,
    /^tailwind\.config\.[a-zA-Z0-9]+$/,
    /^eslint\.config\.[a-zA-Z0-9]+$/,
    /^prettier\.config\.[a-zA-Z0-9]+$/,
    /^babel\.config\.[a-zA-Z0-9]+$/,
    /^docker-compose\.yml$/,
    /^Dockerfile$/,
    /^pom\.xml$/,
    /^build\.gradle$/,
    /^requirements\.txt$/,
    /^pyproject\.toml$/,
    /^Cargo\.toml$/,
    /^go\.mod$/
  ];

  const configs = flatFiles.filter(file => {
    // Ensure we only match files at the root of the repository
    if (file.includes('/')) return false;

    return configPatterns.some(pattern => pattern.test(file));
  });

  return { configs };
}
