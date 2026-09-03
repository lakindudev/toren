export function detectConfigs(flatFiles: string[]): { configs: string[] } {
  const configPatterns: RegExp[] = [
    // Package
    /^package\.json$/,
    /^package-lock\.json$/,
    /^pnpm-lock\.yaml$/,
    /^yarn\.lock$/,
    /^bun\.lockb$/,

    // TypeScript
    /^tsconfig\.json$/,
    /^jsconfig\.json$/,

    // Frontend
    /^vite\.config\.[a-zA-Z0-9]+$/,
    /^next\.config\.[a-zA-Z0-9]+$/,
    /^nuxt\.config\.[a-zA-Z0-9]+$/,
    /^astro\.config\.[a-zA-Z0-9]+$/,
    /^angular\.json$/,

    // Build
    /^webpack\.config\.[a-zA-Z0-9]+$/,
    /^rollup\.config\.[a-zA-Z0-9]+$/,
    /^turbo\.json$/,
    /^nx\.json$/,

    // Styling
    /^tailwind\.config\.[a-zA-Z0-9]+$/,
    /^postcss\.config\.[a-zA-Z0-9]+$/,

    // Lint
    /^eslint\.config\.[a-zA-Z0-9]+$/,
    /^\.eslintrc.*$/,
    /^prettier\.config\.[a-zA-Z0-9]+$/,
    /^\.prettierrc.*$/,

    // Backend
    /^pom\.xml$/,
    /^build\.gradle$/,
    /^build\.gradle\.kts$/,

    // Languages
    /^requirements\.txt$/,
    /^pyproject\.toml$/,
    /^Cargo\.toml$/,
    /^go\.mod$/,

    // Deployment
    /^Dockerfile$/,
    /^docker-compose\.ya?ml$/
  ];

  const matchedSet = new Set<string>();

  for (const file of flatFiles) {
    if (file.includes('/')) continue;

    for (const pattern of configPatterns) {
      if (pattern.test(file)) {
        matchedSet.add(file);
        break;
      }
    }
  }

  const configs = Array.from(matchedSet).sort();
  return { configs };
}
