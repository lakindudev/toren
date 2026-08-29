import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { detectImportantFiles } from '../src/detectors/important-files-detector.js';
import { scan } from '../src/scanner/scan.js';

describe('detectImportantFiles', () => {
  test('returns empty array when no important files exist', () => {
    const result = detectImportantFiles({
      flatFiles: ['src/random.js'],
      projectType: 'Unknown',
      entryPoints: [],
      configs: [],
    });
    assert.deepEqual(result.importantFiles, []);
  });

  test('prioritizes package.json and README.md', () => {
    const result = detectImportantFiles({
      flatFiles: ['package.json', 'README.md', 'src/index.js'],
      projectType: 'Node.js',
      entryPoints: ['src/index.js'],
      configs: [],
    });
    const paths = result.importantFiles.map(f => f.path);
    assert.deepEqual(paths, ['package.json', 'README.md', 'src/index.js']);
  });

  test('handles Next.js App Router specific files', () => {
    const result = detectImportantFiles({
      flatFiles: ['next.config.js', 'app/layout.tsx', 'app/page.tsx', 'package.json'],
      projectType: 'Next.js',
      entryPoints: [],
      configs: [],
    });
    const paths = result.importantFiles.map(f => f.path);
    assert.ok(paths.includes('next.config.js'));
    assert.ok(paths.includes('app/layout.tsx'));
    assert.ok(paths.includes('app/page.tsx'));
    assert.ok(paths.includes('package.json'));
  });

  test('deduplicates and sorts correctly by priority', () => {
    const result = detectImportantFiles({
      flatFiles: ['Dockerfile', 'package.json', 'src/main.js'],
      projectType: 'React',
      entryPoints: ['src/main.js'],
      configs: [],
    });
    const priorities = result.importantFiles.map(f => f.priority);
    // Should be sorted descending
    assert.deepEqual(priorities, [...priorities].sort((a, b) => b - a));
  });
});
