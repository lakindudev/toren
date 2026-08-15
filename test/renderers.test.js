import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { render as renderConsole } from '../src/renderers/console-renderer.js';
import { render as renderJson } from '../src/renderers/json-renderer.js';
import { render as renderMarkdown } from '../src/renderers/markdown-renderer.js';
import { render as renderHtml } from '../src/renderers/html-renderer.js';

// Helper to capture console.log output
function captureStdout(fn) {
  const originalLog = console.log;
  const logs = [];
  console.log = (...args) => {
    logs.push(args.join(' '));
  };
  try {
    fn();
  } finally {
    console.log = originalLog;
  }
  return logs.join('\n');
}

const normalRepo = {
  rootPath: '/path/to/project',
  projectType: 'Node.js / JavaScript',
  entryPoints: ['src/index.js'],
  configs: ['package.json'],
  scripts: [{ name: 'start', command: 'node src/index.js' }],
  tree: { type: 'directory', name: 'project', children: [] },
  flatFiles: ['src/index.js', 'package.json'],
  totalFolders: 1,
  scanDurationMs: 15,
};

const emptyRepo = {
  rootPath: '/empty',
  projectType: 'Unknown',
  entryPoints: [],
  configs: [],
  scripts: [],
  tree: { type: 'directory', name: 'empty', children: [] },
  flatFiles: [],
  totalFolders: 0,
  scanDurationMs: 1,
};

const noFrameworks = { ...normalRepo, projectType: 'Unknown' };
const noEntryPoints = { ...normalRepo, entryPoints: [] };
const noConfigs = { ...normalRepo, configs: [] };
const noScripts = { ...normalRepo, scripts: [] };
const multipleFrameworks = { ...normalRepo, projectType: 'React, Vue, and Svelte' };
const multipleConfigs = { ...normalRepo, configs: ['package.json', 'tsconfig.json', '.eslintrc'] };
const multipleScripts = { ...normalRepo, scripts: [
  { name: 'build', command: 'tsc' },
  { name: 'test', command: 'jest' }
] };
const specialChars = {
  ...normalRepo,
  entryPoints: ['src/a_b-c!@#.js'],
  flatFiles: ['src/a_b-c!@#.js', 'package.json']
};
const unicodeFilenames = {
  ...normalRepo,
  entryPoints: ['src/äöü.js', 'src/你好.js'],
  flatFiles: ['src/äöü.js', 'src/你好.js', 'package.json']
};
const htmlSensitive = {
  ...normalRepo,
  entryPoints: ['src/<script>alert("xss")</script>.js'],
  flatFiles: ['src/<script>alert("xss")</script>.js', 'package.json']
};

const cases = {
  'Normal repository': normalRepo,
  'Empty repository': emptyRepo,
  'No frameworks': noFrameworks,
  'No entry points': noEntryPoints,
  'No configs': noConfigs,
  'No scripts': noScripts,
  'Multiple frameworks': multipleFrameworks,
  'Multiple configs': multipleConfigs,
  'Multiple scripts': multipleScripts,
  'Special characters in filenames': specialChars,
  'Unicode filenames': unicodeFilenames,
  'Potential HTML-sensitive characters': htmlSensitive,
};

describe('Renderers Unit Tests', () => {
  for (const [name, data] of Object.entries(cases)) {
    test(`JSON: ${name}`, () => {
      const output = captureStdout(() => renderJson(data));
      assert.doesNotThrow(() => JSON.parse(output), 'Must be valid JSON');
      
      const parsed = JSON.parse(output);
      
      // Verify existing fields
      assert.ok('project' in parsed);
      assert.ok('frameworks' in parsed);
      assert.ok('entryPoints' in parsed);
      assert.ok('configs' in parsed);
      assert.ok('scripts' in parsed);
      assert.ok('statistics' in parsed);
      assert.ok('structure' in parsed);
      
      // Verify expected property types
      assert.equal(typeof parsed.project.type, 'string');
      assert.ok(Array.isArray(parsed.frameworks));
      assert.ok(Array.isArray(parsed.entryPoints));
      assert.ok(Array.isArray(parsed.configs));
      assert.ok(Array.isArray(parsed.scripts));
      assert.ok(Array.isArray(parsed.structure));
      assert.equal(typeof parsed.statistics.files, 'number');
    });

    test(`HTML: ${name}`, () => {
      const output = captureStdout(() => renderHtml(data));
      assert.match(output, /<html/i);
      
      if (name === 'Potential HTML-sensitive characters') {
        assert.doesNotMatch(output, /<script>alert/);
        assert.match(output, /&lt;script&gt;alert/);
      }
    });

    test(`Markdown: ${name}`, () => {
      const output = captureStdout(() => renderMarkdown(data));
      assert.match(output, /## Project/);
      assert.match(output, /## Frameworks/);
      assert.match(output, /## Entry Points/);
      assert.match(output, /## Configurations/);
      assert.match(output, /## Scripts/);
      assert.match(output, /## Statistics/);
      if (name !== 'Empty repository') {
        assert.match(output, /## Structure/);
      }
      
      if (name === 'Normal repository') {
        assert.match(output, /- src\/index\.js/);
        assert.match(output, /- package\.json/);
        assert.match(output, /- start: node src\/index\.js/);
      }
    });

    test(`Console: ${name}`, () => {
      const oldEnv = process.env.NO_COLOR;
      process.env.NO_COLOR = '1';
      const output = captureStdout(() => renderConsole(data));
      if (oldEnv === undefined) delete process.env.NO_COLOR;
      else process.env.NO_COLOR = oldEnv;
      
      assert.match(output, /Project Summary/);
      assert.match(output, /Frameworks/);
      assert.match(output, /Entry Points/);
      assert.match(output, /Configuration Files/);
      assert.match(output, /Package Scripts/);
      assert.match(output, /Folder Structure/);
      
      if (name === 'Empty repository') {
        assert.match(output, /No frameworks detected\./);
        assert.match(output, /No entry points detected\./);
        assert.match(output, /No configuration files detected\./);
        assert.match(output, /No package scripts detected\./);
      }
    });
  }
});
