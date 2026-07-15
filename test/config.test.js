import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { detectConfigs } from '../src/detectors/config-detector.js';

describe('Toren v1.0.5 - Configuration Discovery', () => {
  test('React project: package.json, vite.config.ts, tsconfig.json', () => {
    const files = [
      'src/App.tsx',
      'src/index.css',
      'package.json',
      'vite.config.ts',
      'tsconfig.json'
    ];
    const { configs } = detectConfigs(files);
    assert.deepEqual(configs, ['package.json', 'tsconfig.json', 'vite.config.ts']);
  });

  test('Spring project: pom.xml', () => {
    const files = [
      'src/main/java/com/example/App.java',
      'pom.xml'
    ];
    const { configs } = detectConfigs(files);
    assert.deepEqual(configs, ['pom.xml']);
  });

  test('Python project: requirements.txt, pyproject.toml', () => {
    const files = [
      'main.py',
      'requirements.txt',
      'pyproject.toml'
    ];
    const { configs } = detectConfigs(files);
    assert.deepEqual(configs, ['pyproject.toml', 'requirements.txt']);
  });

  test('Empty repository', () => {
    const files = [];
    const { configs } = detectConfigs(files);
    assert.deepEqual(configs, []);
  });

  test('Random files', () => {
    const files = [
      'image.png',
      'random.txt',
      'index.html',
      'src/components/Button.jsx'
    ];
    const { configs } = detectConfigs(files);
    assert.deepEqual(configs, []);
  });

  test('CLI: toren --configs', () => {
    // Run CLI on the root directory
    const output = execSync('node bin/toren.js . --configs', { encoding: 'utf-8' });
    assert.match(output, /Configuration Files/);
    assert.match(output, /package\.json/);
  });
});
