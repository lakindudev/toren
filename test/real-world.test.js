/**
 * @fileoverview Toren v1.1.1 — Real-World Validation Tests
 *
 * Verifies that the technology stack detector correctly handles
 * complex, real-world-like repository structures.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { detectTechnologyStack } from '../dist/detectors/technology-stack-detector.js';

function emptyCtx(overrides = {}) {
  return {
    flatFiles:       [],
    configs:         [],
    scripts:         [],
    packageManager:  null,
    projectType:     'Unknown',
    packageManifest: null,
    ...overrides,
  };
}

const find = (result, name) => result.technologies.find(t => t.name === name);

describe('Real-World Validation', () => {

  test('Complex full-stack monorepo (Next.js + NestJS + Postgres + Prisma + Docker)', () => {
    const ctx = emptyCtx({
      packageManifest: {
        dependencies: {
          'next': '^14.0.0',
          'react': '^18.0.0',
          'react-dom': '^18.0.0',
          '@nestjs/core': '^10.0.0',
          '@nestjs/common': '^10.0.0',
          '@prisma/client': '^5.0.0',
        },
        devDependencies: {
          'typescript': '^5.0.0',
          'tailwindcss': '^3.0.0',
          'jest': '^29.0.0',
          'eslint': '^8.0.0',
          'prettier': '^3.0.0',
          'prisma': '^5.0.0'
        }
      },
      configs: [
        'package.json',
        'tsconfig.json',
        'next.config.ts',
        'tailwind.config.ts',
        'nest-cli.json',
        '.eslintrc.json',
        '.prettierrc'
      ],
      flatFiles: [
        'apps/web/app/page.tsx',
        'apps/web/app/layout.tsx',
        'apps/api/src/main.ts',
        'apps/api/src/app.module.ts',
        'packages/database/prisma/schema.prisma',
        'docker-compose.yml',
        'apps/web/Dockerfile',
        'apps/api/Dockerfile'
      ]
    });

    const result = detectTechnologyStack(ctx);

    // Front-end
    assert.ok(find(result, 'React'), 'React must be detected');
    assert.ok(find(result, 'Next.js'), 'Next.js must be detected');
    assert.ok(find(result, 'Tailwind CSS'), 'Tailwind CSS must be detected');

    // Back-end
    assert.ok(find(result, 'NestJS'), 'NestJS must be detected');

    // Database / ORM
    assert.ok(find(result, 'Prisma'), 'Prisma must be detected');

    // Tooling
    assert.ok(find(result, 'TypeScript'), 'TypeScript must be detected');
    assert.ok(find(result, 'Jest'), 'Jest must be detected');
    assert.ok(find(result, 'ESLint'), 'ESLint must be detected');
    assert.ok(find(result, 'Prettier'), 'Prettier must be detected');

    // Infrastructure
    assert.ok(find(result, 'Docker'), 'Docker must be detected');
    assert.ok(find(result, 'Docker Compose'), 'Docker Compose must be detected');
  });

  test('Python Django + React setup', () => {
    const ctx = emptyCtx({
      packageManifest: {
        dependencies: {
          'react': '^18.0.0',
          'react-dom': '^18.0.0',
        },
        devDependencies: {
          'vite': '^5.0.0',
        }
      },
      configs: [
        'package.json',
        'vite.config.ts',
      ],
      flatFiles: [
        'manage.py',
        'requirements.txt',
        'my_project/settings.py',
        'frontend/src/main.tsx',
        'frontend/src/App.tsx',
        'Dockerfile'
      ]
    });

    const result = detectTechnologyStack(ctx);

    assert.ok(find(result, 'React'), 'React must be detected');
    assert.ok(find(result, 'Vite'), 'Vite must be detected');
    assert.ok(find(result, 'Django'), 'Django must be detected');
    assert.ok(find(result, 'Docker'), 'Docker must be detected');
  });

});
