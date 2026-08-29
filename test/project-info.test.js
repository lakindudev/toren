import test, { describe, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { detectProjectInfo } from '../src/detectors/project-info-detector.js';

describe('detectProjectInfo', () => {
  function makeDir(files) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'toren-pi-'));
    for (const [name, content] of Object.entries(files)) {
      const fullPath = path.join(dir, name);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, content);
    }
    return dir;
  }

  test('Node CLI project', () => {
    const dir = makeDir({ 'package.json': '{"name": "my-cli"}', 'src/index.js': '' });
    after(() => fs.rmSync(dir, { recursive: true, force: true }));

    const res = detectProjectInfo({
      rootPath: dir,
      projectType: 'Node.js',
      flatFiles: ['package.json', 'src/index.js'],
      entryPoints: ['src/index.js'],
      packageManager: 'npm',
      scripts: []
    });

    assert.equal(res.projectInfo.name, 'my-cli');
    assert.equal(res.projectInfo.projectType, 'Node.js');
    assert.equal(res.projectInfo.runtime, 'Node.js');
    assert.equal(res.projectInfo.language, 'JavaScript');
    assert.equal(res.projectInfo.framework, 'Node.js');
    assert.equal(res.projectInfo.architecture, null);
    assert.equal(res.projectInfo.entryPoint, 'src/index.js');
    assert.equal(res.projectInfo.sourceDirectory, 'src');
  });

  test('Next App Router project', () => {
    const dir = makeDir({ 'package.json': '{"name": "next-app"}', 'app/page.tsx': '', 'tsconfig.json': '' });
    after(() => fs.rmSync(dir, { recursive: true, force: true }));

    const res = detectProjectInfo({
      rootPath: dir,
      projectType: 'Next.js',
      flatFiles: ['package.json', 'app/page.tsx', 'tsconfig.json'],
      entryPoints: ['app/page.tsx'],
      packageManager: 'npm',
      scripts: []
    });

    assert.equal(res.projectInfo.language, 'TypeScript');
    assert.equal(res.projectInfo.architecture, 'App Router');
    assert.equal(res.projectInfo.sourceDirectory, 'app');
  });

  test('Next Pages Router project', () => {
    const dir = makeDir({ 'pages/index.js': '' });
    after(() => fs.rmSync(dir, { recursive: true, force: true }));

    const res = detectProjectInfo({
      rootPath: dir,
      projectType: 'Next.js',
      flatFiles: ['pages/index.js'],
      entryPoints: ['pages/index.js'],
      packageManager: null,
      scripts: []
    });

    assert.equal(res.projectInfo.architecture, 'Pages Router');
    assert.equal(res.projectInfo.sourceDirectory, 'pages');
  });

  test('hybrid Next.js project', () => {
    const dir = makeDir({ 'app/page.js': '', 'pages/index.js': '' });
    after(() => fs.rmSync(dir, { recursive: true, force: true }));

    const res = detectProjectInfo({
      rootPath: dir,
      projectType: 'Next.js',
      flatFiles: ['app/page.js', 'pages/index.js'],
      entryPoints: ['app/page.js'],
      packageManager: null,
      scripts: []
    });

    assert.equal(res.projectInfo.architecture, 'Hybrid App/Pages Router');
  });

  test('Python project', () => {
    const dir = makeDir({ 'main.py': '' });
    after(() => fs.rmSync(dir, { recursive: true, force: true }));

    const res = detectProjectInfo({
      rootPath: dir,
      projectType: 'Python',
      flatFiles: ['main.py'],
      entryPoints: ['main.py'],
      packageManager: null,
      scripts: []
    });

    assert.equal(res.projectInfo.runtime, 'Python');
    assert.equal(res.projectInfo.language, 'Python');
    assert.equal(res.projectInfo.sourceDirectory, null);
  });

  test('unknown/minimal project', () => {
    const dir = makeDir({ 'random.txt': '' });
    after(() => fs.rmSync(dir, { recursive: true, force: true }));

    const res = detectProjectInfo({
      rootPath: dir,
      projectType: 'Unknown',
      flatFiles: ['random.txt'],
      entryPoints: [],
      packageManager: null,
      scripts: []
    });

    assert.ok(res.projectInfo.name); // from basename
    assert.equal(res.projectInfo.runtime, null);
    assert.equal(res.projectInfo.language, null);
    assert.equal(res.projectInfo.framework, null);
    assert.equal(res.projectInfo.architecture, null);
    assert.equal(res.projectInfo.entryPoint, null);
    assert.equal(res.projectInfo.sourceDirectory, null);
  });
});
