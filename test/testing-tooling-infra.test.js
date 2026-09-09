import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { detectTechnologyStack } from '../dist/detectors/technology-stack-detector.js';
import { scan } from '../dist/scanner/scan.js';

function emptyCtx(overrides = {}) {
  return { flatFiles: [], configs: [], scripts: [], packageManager: null, projectType: 'Unknown', packageManifest: null, ...overrides };
}

function makeDir(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'toren-tti-'));
  for (const [name, content] of Object.entries(files)) {
    const fullPath = path.join(dir, name);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content);
  }
  return dir;
}

const find = (result, name) => result.technologies.find(t => t.name === name);

describe('Testing + Tooling + Infrastructure Detection', () => {

  // ── Testing ────────────────────────────────────────────────────────────

  test('Jest detection', () => {
    let res = detectTechnologyStack(emptyCtx({ packageManifest: { devDependencies: { jest: '^29.0.0' } } }));
    assert.ok(find(res, 'Jest'));
    
    res = detectTechnologyStack(emptyCtx({ configs: ['jest.config.js'] }));
    assert.ok(find(res, 'Jest'));

    res = detectTechnologyStack(emptyCtx({ scripts: [{ name: 'test', command: 'jest --watch' }] }));
    assert.equal(find(res, 'Jest'), undefined);
  });

  test('Vitest detection', () => {
    const res = detectTechnologyStack(emptyCtx({ packageManifest: { devDependencies: { vitest: '^1.0.0' } } }));
    assert.ok(find(res, 'Vitest'));
  });

  test('Mocha detection', () => {
    const res = detectTechnologyStack(emptyCtx({ configs: ['.mocharc.yml'] }));
    assert.ok(find(res, 'Mocha'));
  });

  test('Playwright detection', () => {
    const res = detectTechnologyStack(emptyCtx({ packageManifest: { devDependencies: { '@playwright/test': '^1.0.0' } } }));
    assert.ok(find(res, 'Playwright'));
  });

  test('Cypress detection', () => {
    const res = detectTechnologyStack(emptyCtx({ configs: ['cypress.config.js'] }));
    assert.ok(find(res, 'Cypress'));
  });

  test('Testing Library detection', () => {
    const res = detectTechnologyStack(emptyCtx({ packageManifest: { devDependencies: { '@testing-library/react': '^14.0.0' } } }));
    assert.ok(find(res, 'Testing Library'));
  });

  test('Pytest detection', () => {
    const res = detectTechnologyStack(emptyCtx({ flatFiles: ['pytest.ini', 'requirements.txt'] }));
    assert.ok(find(res, 'Pytest'));
  });

  test('JUnit detection', () => {
    const res = detectTechnologyStack(emptyCtx({ configs: ['pom.xml'], flatFiles: ['src/test/java/MyTest.java'] }));
    assert.ok(find(res, 'JUnit'));
  });

  // ── Build ──────────────────────────────────────────────────────────────

  test('Vite detection', () => {
    const res = detectTechnologyStack(emptyCtx({ configs: ['vite.config.ts'] }));
    assert.ok(find(res, 'Vite'));
  });

  test('Webpack detection', () => {
    const res = detectTechnologyStack(emptyCtx({ packageManifest: { devDependencies: { webpack: '^5.0.0' } } }));
    assert.ok(find(res, 'Webpack'));
  });

  test('Rollup detection', () => {
    const res = detectTechnologyStack(emptyCtx({ configs: ['rollup.config.js'] }));
    assert.ok(find(res, 'Rollup'));
  });

  test('esbuild detection', () => {
    const res = detectTechnologyStack(emptyCtx({ packageManifest: { devDependencies: { esbuild: '^0.19.0' } } }));
    assert.ok(find(res, 'esbuild'));
  });

  // ── Quality ────────────────────────────────────────────────────────────

  test('ESLint detection', () => {
    let res = detectTechnologyStack(emptyCtx({ configs: ['eslint.config.js'] }));
    assert.ok(find(res, 'ESLint'));

    res = detectTechnologyStack(emptyCtx({ flatFiles: ['.eslintrc.json'] }));
    assert.ok(find(res, 'ESLint'));
  });

  test('Prettier detection', () => {
    const res = detectTechnologyStack(emptyCtx({ flatFiles: ['.prettierrc'] }));
    assert.ok(find(res, 'Prettier'));
  });

  test('Biome detection', () => {
    const res = detectTechnologyStack(emptyCtx({ configs: ['biome.json'] }));
    assert.ok(find(res, 'Biome'));
  });

  test('Stylelint detection', () => {
    const res = detectTechnologyStack(emptyCtx({ flatFiles: ['stylelint.config.js'] }));
    assert.ok(find(res, 'Stylelint'));
  });

  // ── Container ──────────────────────────────────────────────────────────

  test('Docker detection', () => {
    let res = detectTechnologyStack(emptyCtx({ flatFiles: ['Dockerfile'] }));
    assert.ok(find(res, 'Docker'));

    res = detectTechnologyStack(emptyCtx({ flatFiles: ['docker/Dockerfile.dev'] }));
    assert.ok(find(res, 'Docker'));
    
    // Negative test: docker directory only
    res = detectTechnologyStack(emptyCtx({ flatFiles: ['docker/script.sh'] }));
    assert.equal(find(res, 'Docker'), undefined);
  });

  test('Docker Compose detection', () => {
    const res = detectTechnologyStack(emptyCtx({ flatFiles: ['docker-compose.yml'] }));
    assert.ok(find(res, 'Docker Compose'));
  });

  // ── Deployment ─────────────────────────────────────────────────────────

  test('Vercel detection', () => {
    const res = detectTechnologyStack(emptyCtx({ configs: ['vercel.json'] }));
    assert.ok(find(res, 'Vercel'));
  });

  test('Netlify detection', () => {
    const res = detectTechnologyStack(emptyCtx({ flatFiles: ['netlify.toml'] }));
    assert.ok(find(res, 'Netlify'));
  });

  test('Fly.io detection', () => {
    const res = detectTechnologyStack(emptyCtx({ flatFiles: ['fly.toml'] }));
    assert.ok(find(res, 'Fly.io'));
  });

  test('Railway detection', () => {
    const res = detectTechnologyStack(emptyCtx({ flatFiles: ['railway.json'] }));
    assert.ok(find(res, 'Railway'));
  });

  test('Render detection', () => {
    const res = detectTechnologyStack(emptyCtx({ flatFiles: ['render.yaml'] }));
    assert.ok(find(res, 'Render'));
  });

  test('Serverless Framework detection', () => {
    const res = detectTechnologyStack(emptyCtx({ flatFiles: ['serverless.yml'] }));
    assert.ok(find(res, 'Serverless Framework'));
  });

  test('AWS SAM detection', () => {
    const res = detectTechnologyStack(emptyCtx({ flatFiles: ['template.yaml'] }));
    assert.ok(find(res, 'AWS SAM'));
  });
  
  test('scan() integration', () => {
    const dir = makeDir({
      'package.json': JSON.stringify({
        devDependencies: {
          vitest: '^1.0.0',
          eslint: '^8.0.0',
          prettier: '^3.0.0'
        }
      }),
      'docker-compose.yml': 'version: "3"',
      'Dockerfile': 'FROM node:18'
    });
    after(() => fs.rmSync(dir, { recursive: true, force: true }));

    const result = scan(dir);
    const techStack = result.technologyStack;
    assert.ok(find(techStack, 'Vitest'));
    assert.ok(find(techStack, 'ESLint'));
    assert.ok(find(techStack, 'Prettier'));
    assert.ok(find(techStack, 'Docker'));
    assert.ok(find(techStack, 'Docker Compose'));
  });

  test('Category ordering', () => {
    const dir = makeDir({
      'package.json': JSON.stringify({
        devDependencies: {
          jest: '^29.0.0',
          webpack: '^5.0.0',
          eslint: '^8.0.0'
        }
      }),
      'Dockerfile': 'FROM node:18',
      'vercel.json': '{}'
    });
    after(() => fs.rmSync(dir, { recursive: true, force: true }));

    const result = scan(dir);
    const techs = result.technologyStack.technologies;
    
    const cats = techs.map(t => t.category);
    const testingIdx = cats.indexOf('testing');
    const buildIdx = cats.indexOf('build');
    const qualityIdx = cats.indexOf('quality');
    const containerIdx = cats.indexOf('container');
    const deployIdx = cats.indexOf('deployment');
    
    assert.ok(testingIdx < buildIdx);
    assert.ok(buildIdx < qualityIdx);
    assert.ok(qualityIdx < containerIdx);
    assert.ok(containerIdx < deployIdx);
  });
});
