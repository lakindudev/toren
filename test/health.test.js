import test, { describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { detectHealth } from '../dist/detectors/health-detector.js';

describe('detectHealth', () => {
  test('full healthy Node project', () => {
    const res = detectHealth({
      flatFiles: ['README.md', 'LICENSE', '.env.example', 'tests/index.test.js', '.eslintrc.json', 'tsconfig.json', '.gitignore', 'Dockerfile'],
      configs: ['.eslintrc.json', 'tsconfig.json'],
      importantFiles: [],
      scripts: [{ name: 'test', category: 'testing' }],
      projectType: 'Node.js'
    });
    const health = res.health;
    assert.ok(health.find(h => h.id === 'readme' && h.status === 'pass'));
    assert.ok(health.find(h => h.id === 'license' && h.status === 'pass'));
    assert.ok(health.find(h => h.id === 'env-example' && h.status === 'pass'));
    assert.ok(health.find(h => h.id === 'tests' && h.status === 'pass'));
    assert.ok(health.find(h => h.id === 'lint' && h.status === 'pass'));
    assert.ok(health.find(h => h.id === 'typescript' && h.status === 'pass'));
    assert.ok(health.find(h => h.id === 'git' && h.status === 'info'));
    assert.ok(health.find(h => h.id === 'docker' && h.status === 'info'));
  });

  test('README missing', () => {
    const res = detectHealth({ flatFiles: [] });
    assert.ok(res.health.find(h => h.id === 'readme' && h.status === 'warning'));
  });

  test('LICENSE missing', () => {
    const res = detectHealth({ flatFiles: [] });
    assert.ok(res.health.find(h => h.id === 'license' && h.status === 'warning'));
  });

  test('tests detected via scripts', () => {
    const res = detectHealth({
      flatFiles: [],
      scripts: [{ name: 'test', category: 'testing' }]
    });
    assert.ok(res.health.find(h => h.id === 'tests' && h.status === 'pass'));
  });

  test('lint detected via configs', () => {
    const res = detectHealth({
      flatFiles: [],
      configs: ['biome.json']
    });
    assert.ok(res.health.find(h => h.id === 'lint' && h.status === 'pass'));
  });

  test('minimal project', () => {
    const res = detectHealth({ flatFiles: ['index.js'] });
    const ids = res.health.map(h => h.id);
    assert.deepEqual(ids, ['readme', 'license']);
  });
});
