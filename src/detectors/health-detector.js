/**
 * Detect project health observations.
 */
export function detectHealth({
  flatFiles,
  configs,
  importantFiles,
  scripts,
  projectType
}) {
  const health = [];
  const fileSet = new Set(flatFiles);

  // README
  if (fileSet.has('README.md') || fileSet.has('README') || fileSet.has('readme.md')) {
    health.push({ id: 'readme', status: 'pass', message: 'README found' });
  } else {
    health.push({ id: 'readme', status: 'warning', message: 'README not found' });
  }

  // LICENSE
  if (fileSet.has('LICENSE') || fileSet.has('LICENSE.md') || fileSet.has('LICENSE.txt')) {
    health.push({ id: 'license', status: 'pass', message: 'LICENSE found' });
  } else {
    health.push({ id: 'license', status: 'warning', message: 'LICENSE not found' });
  }

  // ENVIRONMENT EXAMPLE
  if (fileSet.has('.env.example') || fileSet.has('.env.sample')) {
    health.push({ id: 'env-example', status: 'pass', message: 'Environment example found' });
  }

  // TESTS
  const hasTestFiles = flatFiles.some(f => 
    f.startsWith('test/') || 
    f.startsWith('tests/') || 
    f.startsWith('__tests__/') || 
    f.includes('.test.') || 
    f.includes('.spec.')
  );
  const hasTestScripts = (scripts || []).some(s => s.category === 'testing' || s.name === 'test');
  if (hasTestFiles || hasTestScripts) {
    health.push({ id: 'tests', status: 'pass', message: 'Tests detected' });
  }

  // LINTER
  const hasLinter = (configs || []).some(c => 
    c.includes('eslint') || 
    c.includes('biome') || 
    c.includes('stylelint')
  ) || (scripts || []).some(s => s.category === 'quality' || s.name === 'lint');
  if (hasLinter) {
    health.push({ id: 'lint', status: 'pass', message: 'Linter detected' });
  }

  // TYPESCRIPT
  if (fileSet.has('tsconfig.json')) {
    health.push({ id: 'typescript', status: 'pass', message: 'TypeScript configuration found' });
  }

  // GIT
  if (fileSet.has('.gitignore')) {
    health.push({ id: 'git', status: 'info', message: '.gitignore found' });
  }

  // DOCKER
  if (fileSet.has('Dockerfile') || fileSet.has('docker-compose.yml') || fileSet.has('compose.yml')) {
    health.push({ id: 'docker', status: 'info', message: 'Docker configuration found' });
  }

  return { health };
}
