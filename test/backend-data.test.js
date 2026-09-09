/**
 * @fileoverview Toren v1.1.0 — Step 5: Backend + Data Intelligence Tests
 *
 * Covers all backend framework, database, and ORM detection rules.
 *
 * Backend frameworks:
 *   Node.js: Express, Fastify, NestJS, Koa, Hapi
 *   Python:  Django, Flask, FastAPI
 *   Java:    Spring Boot
 *   PHP:     Laravel
 *   Ruby:    Rails
 *
 * Databases:
 *   PostgreSQL, MySQL, MariaDB, SQLite, MongoDB, Redis
 *
 * ORM / data-access:
 *   Prisma, Drizzle, TypeORM, Sequelize, Mongoose, Knex,
 *   SQLAlchemy, Hibernate, Django ORM, Eloquent, Active Record
 *
 * Guards tested:
 *   - .env files are NEVER read (no DATABASE_URL / credentials evidence)
 *   - Database not inferred from ORM and vice versa (independent rules)
 *   - False-positive directory names do NOT trigger detection
 *   - All returned technologies have confidence ≥ 0.60
 */

import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { detectTechnologyStack } from '../dist/detectors/technology-stack-detector.js';
import { scan }                  from '../dist/scanner/scan.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function makeDir(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'toren-bd-'));
  for (const [name, content] of Object.entries(files)) {
    const fullPath = path.join(dir, name);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content);
  }
  return dir;
}

const find = (result, name) => result.technologies.find(t => t.name === name);

// ---------------------------------------------------------------------------
// ── EXPRESS ──────────────────────────────────────────────────────────────────
// ---------------------------------------------------------------------------

describe('Backend: Express', () => {

  test('express in dependencies → detected at 0.60', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { dependencies: { express: '^4.18.0' } },
    }));
    const tech = find(result, 'Express');
    assert.ok(tech, 'Express must be detected from dependency');
    assert.equal(tech.category, 'backend');
    assert.ok(tech.confidence >= 0.60);
    assert.ok(tech.evidence.some(e => e.type === 'dependency' && e.value === 'express'));
  });

  test('express in devDependencies → detected', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { devDependencies: { express: '^4.18.0' } },
    }));
    assert.ok(find(result, 'Express'), 'Express must be detected from devDependency');
  });

  test('dep + devDep → detected once, merged evidence', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: {
        dependencies:    { express: '^4.18.0' },
        devDependencies: { express: '^4.18.0' },
      },
    }));
    const entries = result.technologies.filter(t => t.name === 'Express');
    assert.equal(entries.length, 1, 'Express must appear exactly once');
  });

});

// ---------------------------------------------------------------------------
// ── FASTIFY ───────────────────────────────────────────────────────────────────
// ---------------------------------------------------------------------------

describe('Backend: Fastify', () => {

  test('fastify in dependencies → detected', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { dependencies: { fastify: '^4.0.0' } },
    }));
    const tech = find(result, 'Fastify');
    assert.ok(tech, 'Fastify must be detected');
    assert.equal(tech.category, 'backend');
    assert.ok(tech.confidence >= 0.60);
  });

  test('fastify in devDependencies → detected', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { devDependencies: { fastify: '^4.0.0' } },
    }));
    assert.ok(find(result, 'Fastify'));
  });

});

// ---------------------------------------------------------------------------
// ── NESTJS ───────────────────────────────────────────────────────────────────
// ---------------------------------------------------------------------------

describe('Backend: NestJS', () => {

  test('@nestjs/core in dependencies → NestJS detected', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { dependencies: { '@nestjs/core': '^10.0.0' } },
    }));
    const tech = find(result, 'NestJS');
    assert.ok(tech, 'NestJS must be detected from @nestjs/core dependency');
    assert.equal(tech.category, 'backend');
    assert.ok(tech.confidence >= 0.60);
  });

  test('@nestjs/core in devDependencies → NestJS detected', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { devDependencies: { '@nestjs/core': '^10.0.0' } },
    }));
    assert.ok(find(result, 'NestJS'));
  });

  test('nest-cli.json detected as config evidence', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { dependencies: { '@nestjs/core': '^10.0.0' } },
      flatFiles: ['nest-cli.json'],
    }));
    const tech = find(result, 'NestJS');
    assert.ok(tech, 'NestJS must be detected');
    assert.ok(tech.evidence.some(e => e.type === 'config' && e.value === 'nest-cli.json'),
      'nest-cli.json must appear as config evidence');
  });

  test('@nestjs/core dep + nest-cli.json → confidence 0.85', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { dependencies: { '@nestjs/core': '^10.0.0' } },
      flatFiles: ['nest-cli.json'],
    }));
    const tech = find(result, 'NestJS');
    // dep(0.60) + config(0.25) = 0.85
    assert.equal(tech.confidence, 0.85,
      `dep+config should be 0.85, got ${tech.confidence}`);
  });

  test('nest-cli.json alone (no dep) → below threshold, suppressed', () => {
    const result = detectTechnologyStack(emptyCtx({
      flatFiles: ['nest-cli.json'],
    }));
    // config alone = 0.25 < 0.60
    assert.equal(find(result, 'NestJS'), undefined,
      'nest-cli.json alone must be below threshold');
  });

});

// ---------------------------------------------------------------------------
// ── KOA ──────────────────────────────────────────────────────────────────────
// ---------------------------------------------------------------------------

describe('Backend: Koa', () => {

  test('koa in dependencies → detected', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { dependencies: { koa: '^2.15.0' } },
    }));
    const tech = find(result, 'Koa');
    assert.ok(tech, 'Koa must be detected');
    assert.equal(tech.category, 'backend');
    assert.ok(tech.confidence >= 0.60);
  });

  test('koa in devDependencies → detected', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { devDependencies: { koa: '^2.15.0' } },
    }));
    assert.ok(find(result, 'Koa'));
  });

});

// ---------------------------------------------------------------------------
// ── HAPI ─────────────────────────────────────────────────────────────────────
// ---------------------------------------------------------------------------

describe('Backend: Hapi', () => {

  test('@hapi/hapi in dependencies → Hapi detected', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { dependencies: { '@hapi/hapi': '^21.0.0' } },
    }));
    const tech = find(result, 'Hapi');
    assert.ok(tech, 'Hapi must be detected');
    assert.equal(tech.category, 'backend');
    assert.ok(tech.confidence >= 0.60);
    assert.ok(tech.evidence.some(e => e.value === '@hapi/hapi'));
  });

  test('@hapi/hapi in devDependencies → detected', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { devDependencies: { '@hapi/hapi': '^21.0.0' } },
    }));
    assert.ok(find(result, 'Hapi'));
  });

});

// ---------------------------------------------------------------------------
// ── DJANGO ────────────────────────────────────────────────────────────────────
// ---------------------------------------------------------------------------

describe('Backend: Django', () => {

  test('manage.py at root → Django detected at ≥ 0.60', () => {
    const result = detectTechnologyStack(emptyCtx({
      flatFiles: ['manage.py', 'requirements.txt'],
    }));
    const tech = find(result, 'Django');
    assert.ok(tech, 'Django must be detected from manage.py');
    assert.equal(tech.category, 'backend');
    assert.ok(tech.confidence >= 0.60);
    assert.ok(tech.evidence.some(e => e.value === 'manage.py'));
  });

  test('manage.py alone (no requirements.txt) → Django detected', () => {
    const result = detectTechnologyStack(emptyCtx({
      flatFiles: ['manage.py'],
    }));
    // manage.py is manifest-level (0.60) — crosses threshold alone
    const tech = find(result, 'Django');
    assert.ok(tech, 'manage.py alone must detect Django at 0.60');
  });

  test('settings.py provides additional supporting evidence', () => {
    const result = detectTechnologyStack(emptyCtx({
      flatFiles: ['manage.py', 'myapp/settings.py'],
    }));
    const tech = find(result, 'Django');
    assert.ok(tech, 'Django must be detected');
    // manifest(0.60) + file(0.15) = 0.75
    assert.ok(tech.confidence >= 0.75,
      `manage.py + settings.py should give ≥ 0.75, got ${tech.confidence}`);
    assert.ok(tech.evidence.some(e => e.type === 'file' && e.value === 'settings.py'));
  });

  test('settings.py in subdirectory also fires the rule', () => {
    const result = detectTechnologyStack(emptyCtx({
      flatFiles: ['manage.py', 'config/settings.py'],
    }));
    const tech = find(result, 'Django');
    assert.ok(tech?.evidence.some(e => e.value === 'settings.py'));
  });

  test('settings.py alone (no manage.py) → Django NOT detected', () => {
    const result = detectTechnologyStack(emptyCtx({
      flatFiles: ['settings.py'],
    }));
    // file alone = 0.15 < threshold
    assert.equal(find(result, 'Django'), undefined,
      'settings.py alone must be below threshold');
  });

});

// ---------------------------------------------------------------------------
// ── FLASK ─────────────────────────────────────────────────────────────────────
// ---------------------------------------------------------------------------

describe('Backend: Flask', () => {

  test('app.py + requirements.txt → Flask detected at 0.60', () => {
    const result = detectTechnologyStack(emptyCtx({
      flatFiles: ['app.py', 'requirements.txt'],
    }));
    const tech = find(result, 'Flask');
    assert.ok(tech, 'Flask must be detected from app.py + requirements.txt');
    assert.equal(tech.category, 'backend');
    assert.ok(tech.confidence >= 0.60);
    assert.ok(tech.evidence.some(e => e.value === 'app.py'));
  });

  test('app.py + pyproject.toml → Flask detected', () => {
    const result = detectTechnologyStack(emptyCtx({
      flatFiles: ['app.py', 'pyproject.toml'],
    }));
    assert.ok(find(result, 'Flask'), 'Flask must be detected with pyproject.toml');
  });

  test('app.py + Pipfile → Flask detected', () => {
    const result = detectTechnologyStack(emptyCtx({
      flatFiles: ['app.py', 'Pipfile'],
    }));
    assert.ok(find(result, 'Flask'), 'Flask must be detected with Pipfile');
  });

  test('app.py alone (no Python manifest) → Flask NOT detected', () => {
    const result = detectTechnologyStack(emptyCtx({
      flatFiles: ['app.py'],
    }));
    assert.equal(find(result, 'Flask'), undefined,
      'app.py alone without a Python manifest must NOT detect Flask');
  });

  test('wsgi.py provides supporting evidence', () => {
    const result = detectTechnologyStack(emptyCtx({
      flatFiles: ['app.py', 'requirements.txt', 'wsgi.py'],
    }));
    const tech = find(result, 'Flask');
    assert.ok(tech, 'Flask must be detected');
    // manifest(0.60) + file(0.15) = 0.75
    assert.ok(tech.confidence >= 0.75,
      `app.py + wsgi.py should give ≥ 0.75, got ${tech.confidence}`);
    assert.ok(tech.evidence.some(e => e.value === 'wsgi.py'));
  });

  test('[FALSE-POSITIVE GUARD] app.py in non-Flask project (no Python manifest) → NOT detected', () => {
    // A Node.js project that happens to have a file called app.py
    const result = detectTechnologyStack(emptyCtx({
      flatFiles: ['app.py', 'package.json'],
      packageManifest: { dependencies: { express: '^4.18.0' } },
    }));
    // app.py without requirements.txt/pyproject.toml/Pipfile = no Flask
    assert.equal(find(result, 'Flask'), undefined,
      'app.py without a Python manifest must NOT detect Flask');
  });

});

// ---------------------------------------------------------------------------
// ── FASTAPI ───────────────────────────────────────────────────────────────────
// ---------------------------------------------------------------------------

describe('Backend: FastAPI', () => {

  test('main.py + requirements.txt → FastAPI detected at 0.60', () => {
    const result = detectTechnologyStack(emptyCtx({
      flatFiles: ['main.py', 'requirements.txt'],
    }));
    const tech = find(result, 'FastAPI');
    assert.ok(tech, 'FastAPI must be detected from main.py + requirements.txt');
    assert.equal(tech.category, 'backend');
    assert.ok(tech.confidence >= 0.60);
    assert.ok(tech.evidence.some(e => e.value === 'main.py'));
  });

  test('main.py + pyproject.toml → FastAPI detected', () => {
    const result = detectTechnologyStack(emptyCtx({
      flatFiles: ['main.py', 'pyproject.toml'],
    }));
    assert.ok(find(result, 'FastAPI'));
  });

  test('main.py alone (no Python manifest) → FastAPI NOT detected', () => {
    const result = detectTechnologyStack(emptyCtx({
      flatFiles: ['main.py'],
    }));
    assert.equal(find(result, 'FastAPI'), undefined,
      'main.py alone without a Python manifest must NOT detect FastAPI');
  });

  test('routers/ directory provides additional supporting evidence', () => {
    const result = detectTechnologyStack(emptyCtx({
      flatFiles: ['main.py', 'requirements.txt', 'routers/users.py', 'routers/items.py'],
    }));
    const tech = find(result, 'FastAPI');
    assert.ok(tech, 'FastAPI must be detected');
    // manifest(0.60) + directory(0.15) = 0.75
    assert.ok(tech.confidence >= 0.75,
      `main.py + routers/ should give ≥ 0.75, got ${tech.confidence}`);
    assert.ok(tech.evidence.some(e => e.type === 'directory' && e.value.includes('routers/')));
  });

  test('app/routers/ also fires the directory rule', () => {
    const result = detectTechnologyStack(emptyCtx({
      flatFiles: ['main.py', 'requirements.txt', 'app/routers/users.py'],
    }));
    const tech = find(result, 'FastAPI');
    assert.ok(tech?.evidence.some(e => e.type === 'directory'));
  });

  test('[FALSE-POSITIVE GUARD] main.py without Python manifest → NOT detected', () => {
    const result = detectTechnologyStack(emptyCtx({
      flatFiles: ['main.py', 'package.json'],
      packageManifest: { dependencies: { express: '^4.18.0' } },
    }));
    assert.equal(find(result, 'FastAPI'), undefined);
  });

});

// ---------------------------------------------------------------------------
// ── SPRING BOOT ───────────────────────────────────────────────────────────────
// ---------------------------------------------------------------------------

describe('Backend: Spring Boot', () => {

  test('pom.xml → Spring Boot detected at 0.25 (below threshold alone)', () => {
    const result = detectTechnologyStack(emptyCtx({
      configs: ['pom.xml'],
    }));
    // config alone = 0.25 < 0.60 → suppressed
    assert.equal(find(result, 'Spring Boot'), undefined,
      'pom.xml alone (0.25) must be below threshold');
  });

  test('pom.xml + Application.java = 0.40 → below threshold, NOT detected alone', () => {
    // config(0.25) + file(0.15) = 0.40 — still below the 0.60 threshold.
    // Spring Boot requires additional signals to be confidently detected.
    const result = detectTechnologyStack(emptyCtx({
      configs:   ['pom.xml'],
      flatFiles: ['src/main/java/com/example/MyApplication.java'],
    }));
    // Correctly below threshold with only pom.xml + Application.java
    assert.equal(find(result, 'Spring Boot'), undefined,
      'pom.xml + Application.java = 0.40 — correctly below threshold');
  });

  test('pom.xml alone is suppressed (0.25 < threshold)', () => {
    const result = detectTechnologyStack(emptyCtx({
      configs: ['pom.xml'],
    }));
    assert.equal(find(result, 'Spring Boot'), undefined,
      'pom.xml alone (0.25) must be suppressed');
  });

  test('build.gradle → Spring Boot below threshold alone', () => {
    const result = detectTechnologyStack(emptyCtx({
      configs: ['build.gradle'],
    }));
    assert.equal(find(result, 'Spring Boot'), undefined,
      'build.gradle alone (0.25) must be suppressed');
  });

  test('pom.xml + build.gradle + Application.java → Spring Boot detected', () => {
    // config(0.25) + config(0.25) + file(0.15) = 0.65 ≥ 0.60
    const result = detectTechnologyStack(emptyCtx({
      configs:   ['pom.xml', 'build.gradle'],
      flatFiles: ['src/main/java/com/example/DemoApplication.java'],
    }));
    const tech = find(result, 'Spring Boot');
    assert.ok(tech, 'Spring Boot must be detected with pom.xml + build.gradle + Application.java');
    assert.ok(tech.confidence >= 0.60,
      `confidence should be ≥ 0.60, got ${tech.confidence}`);
    assert.ok(tech.evidence.some(e => e.type === 'config' && e.value === 'pom.xml'));
    assert.ok(tech.evidence.some(e => e.type === 'file' && e.value === 'Application.java'));
  });

  test('build.gradle.kts + pom.xml + Application.java → Spring Boot detected', () => {
    // config(0.25 for build.gradle.kts) + config(0.25 for pom.xml) + file(0.15) = 0.65 ≥ 0.60
    const result = detectTechnologyStack(emptyCtx({
      configs:   ['build.gradle.kts', 'pom.xml'],
      flatFiles: ['src/main/java/com/example/MainApplication.java'],
    }));
    const tech = find(result, 'Spring Boot');
    assert.ok(tech, 'Spring Boot must be detected with build.gradle.kts + pom.xml + Application.java');
    assert.ok(tech.evidence.some(e => e.value === 'build.gradle.kts'));
  });

  test('Application.java provides file evidence', () => {
    const result = detectTechnologyStack(emptyCtx({
      configs:   ['pom.xml', 'build.gradle'],
      flatFiles: ['src/main/java/com/example/MyDemoApplication.java'],
    }));
    const tech = find(result, 'Spring Boot');
    assert.ok(tech, 'Spring Boot must be detected');
    assert.ok(tech.evidence.some(e => e.type === 'file' && e.value === 'Application.java'));
  });

});

// ---------------------------------------------------------------------------
// ── LARAVEL ───────────────────────────────────────────────────────────────────
// ---------------------------------------------------------------------------

describe('Backend: Laravel', () => {

  test('artisan at root → Laravel detected at 0.60', () => {
    const result = detectTechnologyStack(emptyCtx({
      flatFiles: ['artisan', 'composer.json'],
    }));
    const tech = find(result, 'Laravel');
    assert.ok(tech, 'Laravel must be detected from artisan');
    assert.equal(tech.category, 'backend');
    assert.ok(tech.confidence >= 0.60);
    assert.ok(tech.evidence.some(e => e.value === 'artisan'));
  });

  test('artisan alone → Laravel detected at 0.60', () => {
    const result = detectTechnologyStack(emptyCtx({
      flatFiles: ['artisan'],
    }));
    // artisan is manifest-level (0.60) — crosses threshold alone
    const tech = find(result, 'Laravel');
    assert.ok(tech, 'artisan alone must detect Laravel at 0.60');
  });

  test('composer.json provides additional file evidence', () => {
    const result = detectTechnologyStack(emptyCtx({
      flatFiles: ['artisan', 'composer.json'],
    }));
    const tech = find(result, 'Laravel');
    assert.ok(tech, 'Laravel must be detected');
    // manifest(0.60) + file(0.15) = 0.75
    assert.ok(tech.confidence >= 0.75,
      `artisan + composer.json should give ≥ 0.75, got ${tech.confidence}`);
    assert.ok(tech.evidence.some(e => e.value === 'composer.json'));
  });

  test('[FALSE-POSITIVE GUARD] composer.json alone (no artisan) → NOT detected', () => {
    // A PHP project without Laravel
    const result = detectTechnologyStack(emptyCtx({
      flatFiles: ['composer.json', 'public/index.php'],
    }));
    // file(0.15) alone < threshold
    assert.equal(find(result, 'Laravel'), undefined,
      'composer.json alone must not detect Laravel (below threshold)');
  });

});

// ---------------------------------------------------------------------------
// ── RAILS ─────────────────────────────────────────────────────────────────────
// ---------------------------------------------------------------------------

describe('Backend: Rails', () => {

  test('Gemfile at root → Rails detected at 0.60', () => {
    const result = detectTechnologyStack(emptyCtx({
      flatFiles: ['Gemfile', 'config/routes.rb'],
    }));
    const tech = find(result, 'Rails');
    assert.ok(tech, 'Rails must be detected from Gemfile');
    assert.equal(tech.category, 'backend');
    assert.ok(tech.confidence >= 0.60);
    assert.ok(tech.evidence.some(e => e.value === 'Gemfile'));
  });

  test('Gemfile alone → Rails detected at 0.60 (manifest-level)', () => {
    const result = detectTechnologyStack(emptyCtx({
      flatFiles: ['Gemfile'],
    }));
    const tech = find(result, 'Rails');
    assert.ok(tech, 'Gemfile alone must detect Rails at 0.60');
  });

  test('config/routes.rb provides additional file evidence', () => {
    const result = detectTechnologyStack(emptyCtx({
      flatFiles: ['Gemfile', 'config/routes.rb', 'app/controllers/application_controller.rb'],
    }));
    const tech = find(result, 'Rails');
    assert.ok(tech, 'Rails must be detected');
    // manifest(0.60) + file(0.15) = 0.75
    assert.ok(tech.confidence >= 0.75,
      `Gemfile + config/routes.rb should give ≥ 0.75, got ${tech.confidence}`);
    assert.ok(tech.evidence.some(e => e.value === 'config/routes.rb'));
  });

});

// ---------------------------------------------------------------------------
// ── POSTGRESQL ────────────────────────────────────────────────────────────────
// ---------------------------------------------------------------------------

describe('Database: PostgreSQL', () => {

  test('pg in dependencies → PostgreSQL detected', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { dependencies: { pg: '^8.11.0' } },
    }));
    const tech = find(result, 'PostgreSQL');
    assert.ok(tech, 'PostgreSQL must be detected from pg dependency');
    assert.equal(tech.category, 'database');
    assert.ok(tech.confidence >= 0.60);
  });

  test('pg in devDependencies → PostgreSQL detected', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { devDependencies: { pg: '^8.11.0' } },
    }));
    assert.ok(find(result, 'PostgreSQL'));
  });

  test('postgres package → PostgreSQL detected', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { dependencies: { postgres: '^3.4.0' } },
    }));
    assert.ok(find(result, 'PostgreSQL'), 'postgres package must detect PostgreSQL');
  });

  test('@neondatabase/serverless → PostgreSQL detected', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { dependencies: { '@neondatabase/serverless': '^0.9.0' } },
    }));
    assert.ok(find(result, 'PostgreSQL'), '@neondatabase/serverless must detect PostgreSQL');
  });

});

// ---------------------------------------------------------------------------
// ── MYSQL ─────────────────────────────────────────────────────────────────────
// ---------------------------------------------------------------------------

describe('Database: MySQL', () => {

  test('mysql2 in dependencies → MySQL detected', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { dependencies: { mysql2: '^3.6.0' } },
    }));
    const tech = find(result, 'MySQL');
    assert.ok(tech, 'MySQL must be detected from mysql2');
    assert.equal(tech.category, 'database');
    assert.ok(tech.confidence >= 0.60);
  });

  test('mysql (v1) in dependencies → MySQL detected', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { dependencies: { mysql: '^2.18.0' } },
    }));
    assert.ok(find(result, 'MySQL'), 'mysql package must detect MySQL');
  });

  test('mysql2 in devDependencies → MySQL detected', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { devDependencies: { mysql2: '^3.6.0' } },
    }));
    assert.ok(find(result, 'MySQL'));
  });

  test('[FALSE-POSITIVE GUARD] MySQL not detected without mysql/mysql2 dependency', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { dependencies: { pg: '^8.11.0' } },
    }));
    assert.equal(find(result, 'MySQL'), undefined,
      'MySQL must not be detected from PostgreSQL pg package');
  });

});

// ---------------------------------------------------------------------------
// ── MARIADB ───────────────────────────────────────────────────────────────────
// ---------------------------------------------------------------------------

describe('Database: MariaDB', () => {

  test('mariadb in dependencies → MariaDB detected', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { dependencies: { mariadb: '^3.3.0' } },
    }));
    const tech = find(result, 'MariaDB');
    assert.ok(tech, 'MariaDB must be detected');
    assert.equal(tech.category, 'database');
    assert.ok(tech.confidence >= 0.60);
  });

  test('mariadb in devDependencies → MariaDB detected', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { devDependencies: { mariadb: '^3.3.0' } },
    }));
    assert.ok(find(result, 'MariaDB'));
  });

});

// ---------------------------------------------------------------------------
// ── SQLITE ────────────────────────────────────────────────────────────────────
// ---------------------------------------------------------------------------

describe('Database: SQLite', () => {

  test('sqlite3 in dependencies → SQLite detected', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { dependencies: { sqlite3: '^5.1.0' } },
    }));
    const tech = find(result, 'SQLite');
    assert.ok(tech, 'SQLite must be detected from sqlite3');
    assert.equal(tech.category, 'database');
    assert.ok(tech.confidence >= 0.60);
  });

  test('better-sqlite3 in dependencies → SQLite detected', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { dependencies: { 'better-sqlite3': '^9.0.0' } },
    }));
    assert.ok(find(result, 'SQLite'), 'better-sqlite3 must detect SQLite');
  });

  test('better-sqlite3 in devDependencies → SQLite detected', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { devDependencies: { 'better-sqlite3': '^9.0.0' } },
    }));
    assert.ok(find(result, 'SQLite'));
  });

  test('@libsql/client → SQLite detected', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { dependencies: { '@libsql/client': '^0.5.0' } },
    }));
    assert.ok(find(result, 'SQLite'), '@libsql/client must detect SQLite');
  });

  test('*.db file provides supporting evidence', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { dependencies: { 'better-sqlite3': '^9.0.0' } },
      flatFiles: ['data/app.db'],
    }));
    const tech = find(result, 'SQLite');
    assert.ok(tech, 'SQLite must be detected');
    // dep(0.60) + file(0.15) = 0.75
    assert.ok(tech.confidence >= 0.75,
      `better-sqlite3 + *.db file should give ≥ 0.75, got ${tech.confidence}`);
    assert.ok(tech.evidence.some(e => e.type === 'file' && e.value.includes('.db')));
  });

  test('*.sqlite file provides supporting evidence', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { dependencies: { sqlite3: '^5.1.0' } },
      flatFiles: ['db/database.sqlite'],
    }));
    const tech = find(result, 'SQLite');
    assert.ok(tech?.evidence.some(e => e.type === 'file'));
  });

  test('[FALSE-POSITIVE GUARD] .db file alone (no dep) → SQLite NOT detected', () => {
    // file alone = 0.15 < threshold
    const result = detectTechnologyStack(emptyCtx({
      flatFiles: ['local.db'],
    }));
    assert.equal(find(result, 'SQLite'), undefined,
      '*.db file alone must be below threshold');
  });

});

// ---------------------------------------------------------------------------
// ── MONGODB ───────────────────────────────────────────────────────────────────
// ---------------------------------------------------------------------------

describe('Database: MongoDB', () => {

  test('mongodb in dependencies → MongoDB detected', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { dependencies: { mongodb: '^6.3.0' } },
    }));
    const tech = find(result, 'MongoDB');
    assert.ok(tech, 'MongoDB must be detected');
    assert.equal(tech.category, 'database');
    assert.ok(tech.confidence >= 0.60);
  });

  test('mongodb in devDependencies → MongoDB detected', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { devDependencies: { mongodb: '^6.3.0' } },
    }));
    assert.ok(find(result, 'MongoDB'));
  });

});

// ---------------------------------------------------------------------------
// ── REDIS ─────────────────────────────────────────────────────────────────────
// ---------------------------------------------------------------------------

describe('Database: Redis', () => {

  test('redis in dependencies → Redis detected', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { dependencies: { redis: '^4.6.0' } },
    }));
    const tech = find(result, 'Redis');
    assert.ok(tech, 'Redis must be detected');
    assert.equal(tech.category, 'database');
    assert.ok(tech.confidence >= 0.60);
  });

  test('ioredis in dependencies → Redis detected', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { dependencies: { ioredis: '^5.3.0' } },
    }));
    assert.ok(find(result, 'Redis'), 'ioredis must detect Redis');
  });

  test('ioredis in devDependencies → Redis detected', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { devDependencies: { ioredis: '^5.3.0' } },
    }));
    assert.ok(find(result, 'Redis'));
  });

  test('redis + ioredis in same project → Redis detected once', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: {
        dependencies: { redis: '^4.6.0', ioredis: '^5.3.0' },
      },
    }));
    const entries = result.technologies.filter(t => t.name === 'Redis');
    assert.equal(entries.length, 1, 'Redis must appear exactly once after deduplication');
    // dep(0.60) + dep(0.60) = 1.0 capped
    assert.equal(entries[0].confidence, 1.0);
  });

});

// ---------------------------------------------------------------------------
// ── ORM: PRISMA ───────────────────────────────────────────────────────────────
// ---------------------------------------------------------------------------

describe('ORM: Prisma', () => {

  test('@prisma/client in dependencies → Prisma detected', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { dependencies: { '@prisma/client': '^5.0.0' } },
    }));
    const tech = find(result, 'Prisma');
    assert.ok(tech, 'Prisma must be detected from @prisma/client dependency');
    assert.equal(tech.category, 'orm');
    assert.ok(tech.confidence >= 0.60);
  });

  test('prisma in devDependencies → Prisma detected', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { devDependencies: { prisma: '^5.0.0' } },
    }));
    assert.ok(find(result, 'Prisma'));
  });

  test('@prisma/client in devDependencies → Prisma detected', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { devDependencies: { '@prisma/client': '^5.0.0' } },
    }));
    assert.ok(find(result, 'Prisma'));
  });

  test('prisma/schema.prisma file provides additional evidence', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: {
        dependencies:    { '@prisma/client': '^5.0.0' },
        devDependencies: { prisma: '^5.0.0' },
      },
      flatFiles: ['prisma/schema.prisma'],
    }));
    const tech = find(result, 'Prisma');
    assert.ok(tech, 'Prisma must be detected');
    assert.ok(tech.evidence.some(e => e.type === 'file' && e.value.includes('schema.prisma')),
      'schema.prisma must appear in evidence');
    assert.equal(tech.confidence, 1.0, 'Prisma with all signals should be capped at 1.0');
  });

  test('schema.prisma alone (no dep) → Prisma NOT detected', () => {
    // file alone = 0.15 < threshold
    const result = detectTechnologyStack(emptyCtx({
      flatFiles: ['prisma/schema.prisma'],
    }));
    assert.equal(find(result, 'Prisma'), undefined,
      'schema.prisma alone must be below threshold');
  });

  test('[INDEPENDENCE] Prisma detected without PostgreSQL also being detected', () => {
    // Prisma can work with SQLite, MySQL, etc. Detecting Prisma must NOT auto-detect PostgreSQL.
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: {
        dependencies:    { '@prisma/client': '^5.0.0' },
        devDependencies: { prisma: '^5.0.0' },
      },
      flatFiles: ['prisma/schema.prisma'],
    }));
    assert.ok(find(result, 'Prisma'), 'Prisma must be detected');
    assert.equal(find(result, 'PostgreSQL'), undefined,
      'PostgreSQL must NOT be detected just because Prisma is present');
  });

});

// ---------------------------------------------------------------------------
// ── ORM: DRIZZLE ──────────────────────────────────────────────────────────────
// ---------------------------------------------------------------------------

describe('ORM: Drizzle', () => {

  test('drizzle-orm in dependencies → Drizzle detected', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { dependencies: { 'drizzle-orm': '^0.30.0' } },
    }));
    const tech = find(result, 'Drizzle');
    assert.ok(tech, 'Drizzle must be detected');
    assert.equal(tech.category, 'orm');
    assert.ok(tech.confidence >= 0.60);
  });

  test('drizzle-kit in devDependencies contributes additional evidence', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: {
        dependencies:    { 'drizzle-orm': '^0.30.0' },
        devDependencies: { 'drizzle-kit': '^0.20.0' },
      },
    }));
    const tech = find(result, 'Drizzle');
    assert.ok(tech, 'Drizzle must be detected');
    // dep(0.60) + devDep(0.60) = 1.0 capped
    assert.equal(tech.confidence, 1.0);
  });

});

// ---------------------------------------------------------------------------
// ── ORM: TYPEORM ──────────────────────────────────────────────────────────────
// ---------------------------------------------------------------------------

describe('ORM: TypeORM', () => {

  test('typeorm in dependencies → TypeORM detected', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { dependencies: { typeorm: '^0.3.0' } },
    }));
    const tech = find(result, 'TypeORM');
    assert.ok(tech, 'TypeORM must be detected');
    assert.equal(tech.category, 'orm');
    assert.ok(tech.confidence >= 0.60);
  });

  test('typeorm in devDependencies → TypeORM detected', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { devDependencies: { typeorm: '^0.3.0' } },
    }));
    assert.ok(find(result, 'TypeORM'));
  });

});

// ---------------------------------------------------------------------------
// ── ORM: SEQUELIZE ────────────────────────────────────────────────────────────
// ---------------------------------------------------------------------------

describe('ORM: Sequelize', () => {

  test('sequelize in dependencies → Sequelize detected', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { dependencies: { sequelize: '^6.35.0' } },
    }));
    const tech = find(result, 'Sequelize');
    assert.ok(tech, 'Sequelize must be detected');
    assert.equal(tech.category, 'orm');
    assert.ok(tech.confidence >= 0.60);
  });

  test('sequelize in devDependencies → Sequelize detected', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { devDependencies: { sequelize: '^6.35.0' } },
    }));
    assert.ok(find(result, 'Sequelize'));
  });

});

// ---------------------------------------------------------------------------
// ── ORM: MONGOOSE ────────────────────────────────────────────────────────────
// ---------------------------------------------------------------------------

describe('ORM: Mongoose', () => {

  test('mongoose in dependencies → Mongoose detected', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { dependencies: { mongoose: '^8.1.0' } },
    }));
    const tech = find(result, 'Mongoose');
    assert.ok(tech, 'Mongoose must be detected');
    assert.equal(tech.category, 'orm');
    assert.ok(tech.confidence >= 0.60);
  });

  test('mongoose in devDependencies → Mongoose detected', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { devDependencies: { mongoose: '^8.1.0' } },
    }));
    assert.ok(find(result, 'Mongoose'));
  });

  test('[INDEPENDENCE] Mongoose detected without MongoDB also being detected', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { dependencies: { mongoose: '^8.1.0' } },
    }));
    assert.ok(find(result, 'Mongoose'), 'Mongoose must be detected');
    assert.equal(find(result, 'MongoDB'), undefined,
      'MongoDB must NOT be auto-detected just because Mongoose is present');
  });

  test('MongoDB + Mongoose together both detected independently', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: {
        dependencies: { mongodb: '^6.3.0', mongoose: '^8.1.0' },
      },
    }));
    assert.ok(find(result, 'MongoDB'), 'MongoDB must be detected');
    assert.ok(find(result, 'Mongoose'), 'Mongoose must be detected independently');
    // Verify they are in different categories
    assert.equal(find(result, 'MongoDB').category,  'database');
    assert.equal(find(result, 'Mongoose').category, 'orm');
  });

});

// ---------------------------------------------------------------------------
// ── ORM: KNEX ────────────────────────────────────────────────────────────────
// ---------------------------------------------------------------------------

describe('ORM: Knex', () => {

  test('knex in dependencies → Knex detected', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { dependencies: { knex: '^3.1.0' } },
    }));
    const tech = find(result, 'Knex');
    assert.ok(tech, 'Knex must be detected');
    assert.equal(tech.category, 'orm');
    assert.ok(tech.confidence >= 0.60);
  });

});

// ---------------------------------------------------------------------------
// ── ORM: SQLALCHEMY ───────────────────────────────────────────────────────────
// ---------------------------------------------------------------------------

describe('ORM: SQLAlchemy', () => {

  test('alembic.ini + requirements.txt → SQLAlchemy detected at ≥ 0.60', () => {
    const result = detectTechnologyStack(emptyCtx({
      flatFiles: ['alembic.ini', 'requirements.txt'],
    }));
    const tech = find(result, 'SQLAlchemy');
    assert.ok(tech, 'SQLAlchemy must be detected from alembic.ini + requirements.txt');
    assert.equal(tech.category, 'orm');
    assert.ok(tech.confidence >= 0.60);
  });

  test('alembic.ini + pyproject.toml → SQLAlchemy detected', () => {
    const result = detectTechnologyStack(emptyCtx({
      flatFiles: ['alembic.ini', 'pyproject.toml'],
    }));
    assert.ok(find(result, 'SQLAlchemy'));
  });

  test('alembic.ini + Pipfile → SQLAlchemy detected', () => {
    const result = detectTechnologyStack(emptyCtx({
      flatFiles: ['alembic.ini', 'Pipfile'],
    }));
    assert.ok(find(result, 'SQLAlchemy'));
  });

  test('alembic.ini alone (no Python manifest) → SQLAlchemy NOT detected (below threshold)', () => {
    // config(0.25) alone < threshold
    const result = detectTechnologyStack(emptyCtx({
      flatFiles: ['alembic.ini'],
    }));
    assert.equal(find(result, 'SQLAlchemy'), undefined,
      'alembic.ini alone must be below threshold (0.25 < 0.60)');
  });

});

// ---------------------------------------------------------------------------
// ── ORM: HIBERNATE ────────────────────────────────────────────────────────────
// ---------------------------------------------------------------------------

describe('ORM: Hibernate', () => {

  test('pom.xml + persistence.xml → Hibernate detected', () => {
    const result = detectTechnologyStack(emptyCtx({
      configs:   ['pom.xml'],
      flatFiles: ['src/main/resources/META-INF/persistence.xml'],
    }));
    const tech = find(result, 'Hibernate');
    assert.ok(tech, 'Hibernate must be detected from pom.xml + persistence.xml');
    assert.equal(tech.category, 'orm');
    assert.ok(tech.confidence >= 0.60);
    assert.ok(tech.evidence.some(e => e.value === 'persistence.xml'));
  });

  test('build.gradle + persistence.xml → Hibernate detected', () => {
    const result = detectTechnologyStack(emptyCtx({
      configs:   ['build.gradle'],
      flatFiles: ['src/main/resources/META-INF/persistence.xml'],
    }));
    assert.ok(find(result, 'Hibernate'), 'Hibernate must be detected with build.gradle + persistence.xml');
  });

  test('pom.xml + hibernate.cfg.xml → Hibernate detected', () => {
    const result = detectTechnologyStack(emptyCtx({
      configs:   ['pom.xml'],
      flatFiles: ['src/main/resources/hibernate.cfg.xml'],
    }));
    const tech = find(result, 'Hibernate');
    assert.ok(tech, 'Hibernate must be detected from hibernate.cfg.xml');
    assert.ok(tech.evidence.some(e => e.value === 'hibernate.cfg.xml'));
  });

  test('persistence.xml alone (no pom.xml) → Hibernate NOT detected', () => {
    const result = detectTechnologyStack(emptyCtx({
      flatFiles: ['src/main/resources/META-INF/persistence.xml'],
    }));
    assert.equal(find(result, 'Hibernate'), undefined,
      'persistence.xml without a Java build file must not detect Hibernate');
  });

});

// ---------------------------------------------------------------------------
// ── ORM: DJANGO ORM ──────────────────────────────────────────────────────────
// ---------------------------------------------------------------------------

describe('ORM: Django ORM', () => {

  test('manage.py + models.py → Django ORM detected', () => {
    const result = detectTechnologyStack(emptyCtx({
      flatFiles: ['manage.py', 'myapp/models.py'],
    }));
    const tech = find(result, 'Django ORM');
    assert.ok(tech, 'Django ORM must be detected from manage.py + models.py');
    assert.equal(tech.category, 'orm');
    assert.ok(tech.confidence >= 0.60);
    assert.ok(tech.evidence.some(e => e.value === 'models.py'));
  });

  test('models.py at root also fires the rule', () => {
    const result = detectTechnologyStack(emptyCtx({
      flatFiles: ['manage.py', 'models.py'],
    }));
    assert.ok(find(result, 'Django ORM'));
  });

  test('models.py without manage.py → Django ORM NOT detected', () => {
    const result = detectTechnologyStack(emptyCtx({
      flatFiles: ['myapp/models.py'],
    }));
    assert.equal(find(result, 'Django ORM'), undefined,
      'models.py without manage.py must not detect Django ORM');
  });

  test('Django and Django ORM detected together in same project', () => {
    const result = detectTechnologyStack(emptyCtx({
      flatFiles: ['manage.py', 'myapp/models.py', 'myapp/settings.py'],
    }));
    assert.ok(find(result, 'Django'),     'Django must be detected');
    assert.ok(find(result, 'Django ORM'), 'Django ORM must also be detected');
  });

});

// ---------------------------------------------------------------------------
// ── ORM: ELOQUENT ────────────────────────────────────────────────────────────
// ---------------------------------------------------------------------------

describe('ORM: Eloquent', () => {

  test('artisan + app/Models/ → Eloquent detected', () => {
    const result = detectTechnologyStack(emptyCtx({
      flatFiles: ['artisan', 'composer.json', 'app/Models/User.php', 'app/Models/Post.php'],
    }));
    const tech = find(result, 'Eloquent');
    assert.ok(tech, 'Eloquent must be detected from artisan + app/Models/');
    assert.equal(tech.category, 'orm');
    assert.ok(tech.confidence >= 0.60);
    assert.ok(tech.evidence.some(e => e.value.includes('app/Models/')));
  });

  test('artisan without app/Models/ → Eloquent NOT detected', () => {
    const result = detectTechnologyStack(emptyCtx({
      flatFiles: ['artisan', 'app/Http/Controllers/UserController.php'],
    }));
    assert.equal(find(result, 'Eloquent'), undefined,
      'artisan without app/Models/ must not detect Eloquent');
  });

  test('Laravel and Eloquent detected together in same project', () => {
    const result = detectTechnologyStack(emptyCtx({
      flatFiles: ['artisan', 'composer.json', 'app/Models/User.php'],
    }));
    assert.ok(find(result, 'Laravel'),  'Laravel must be detected');
    assert.ok(find(result, 'Eloquent'), 'Eloquent must also be detected');
  });

});

// ---------------------------------------------------------------------------
// ── ORM: ACTIVE RECORD ────────────────────────────────────────────────────────
// ---------------------------------------------------------------------------

describe('ORM: Active Record', () => {

  test('Gemfile + db/schema.rb → Active Record detected', () => {
    const result = detectTechnologyStack(emptyCtx({
      flatFiles: ['Gemfile', 'config/routes.rb', 'db/schema.rb'],
    }));
    const tech = find(result, 'Active Record');
    assert.ok(tech, 'Active Record must be detected from Gemfile + db/schema.rb');
    assert.equal(tech.category, 'orm');
    assert.ok(tech.confidence >= 0.60);
    assert.ok(tech.evidence.some(e => e.value === 'db/schema.rb'));
  });

  test('db/schema.rb without Gemfile → Active Record NOT detected', () => {
    const result = detectTechnologyStack(emptyCtx({
      flatFiles: ['db/schema.rb'],
    }));
    assert.equal(find(result, 'Active Record'), undefined,
      'db/schema.rb without Gemfile must not detect Active Record');
  });

  test('Rails, Active Record detected together in a Rails project', () => {
    const result = detectTechnologyStack(emptyCtx({
      flatFiles: ['Gemfile', 'config/routes.rb', 'db/schema.rb'],
    }));
    assert.ok(find(result, 'Rails'),         'Rails must be detected');
    assert.ok(find(result, 'Active Record'), 'Active Record must also be detected');
  });

});

// ---------------------------------------------------------------------------
// ── SAFETY: NO SECRET FILE READING ───────────────────────────────────────────
// ---------------------------------------------------------------------------

describe('Safety: .env files are never read (no DATABASE_URL evidence)', () => {

  test('.env file in flatFiles does NOT produce any database detection', () => {
    // If .env is in flatFiles, we must not read it and must not detect anything from it.
    const result = detectTechnologyStack(emptyCtx({
      flatFiles: ['.env', '.env.local', '.env.production'],
    }));
    // .env files alone → zero technologies detected (below threshold or no rules match)
    const dbTechs = result.technologies.filter(t => t.category === 'database');
    assert.equal(dbTechs.length, 0,
      '.env files in flatFiles must never produce database technology detections');
  });

  test('.env.production alone → no backend or database detected', () => {
    const result = detectTechnologyStack(emptyCtx({
      flatFiles: ['.env.production'],
    }));
    const totalTechs = result.technologies.filter(
      t => t.category === 'backend' || t.category === 'database' || t.category === 'orm',
    );
    assert.equal(totalTechs.length, 0,
      '.env files must never produce backend/database/ORM detections');
  });

  test('project with .env and package.json but no db dep → no database detected', () => {
    const result = detectTechnologyStack(emptyCtx({
      flatFiles: ['.env', 'package.json', 'src/index.ts'],
      packageManifest: { dependencies: { express: '^4.18.0' } },
    }));
    const dbTechs = result.technologies.filter(t => t.category === 'database');
    assert.equal(dbTechs.length, 0,
      'A project with .env but no database dep must not detect any database');
  });

});

// ---------------------------------------------------------------------------
// ── FALSE-POSITIVE DATABASE DETECTION ────────────────────────────────────────
// ---------------------------------------------------------------------------

describe('False-positive database detection guards', () => {

  test('directory named postgres/ alone does NOT detect PostgreSQL', () => {
    const result = detectTechnologyStack(emptyCtx({
      flatFiles: ['postgres/init.sql', 'postgres/README.md'],
    }));
    assert.equal(find(result, 'PostgreSQL'), undefined,
      'A directory named postgres/ alone must not detect PostgreSQL');
  });

  test('directory named mysql/ alone does NOT detect MySQL', () => {
    const result = detectTechnologyStack(emptyCtx({
      flatFiles: ['mysql/schema.sql'],
    }));
    assert.equal(find(result, 'MySQL'), undefined,
      'A directory named mysql/ alone must not detect MySQL');
  });

  test('directory named mongodb/ alone does NOT detect MongoDB', () => {
    const result = detectTechnologyStack(emptyCtx({
      flatFiles: ['mongodb/seed.js'],
    }));
    assert.equal(find(result, 'MongoDB'), undefined);
  });

  test('ORM not inferred from database: pg dep detected as PostgreSQL, not auto-adding an ORM', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { dependencies: { pg: '^8.11.0' } },
    }));
    assert.ok(find(result, 'PostgreSQL'), 'PostgreSQL must be detected');
    // No ORM package → no ORM should be detected
    const orms = result.technologies.filter(t => t.category === 'orm');
    assert.equal(orms.length, 0,
      'No ORM must be detected from a plain pg dependency alone');
  });

  test('Database not inferred from ORM: typeorm dep detected as TypeORM, not auto-adding a database', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: { dependencies: { typeorm: '^0.3.0' } },
    }));
    assert.ok(find(result, 'TypeORM'), 'TypeORM must be detected');
    const dbs = result.technologies.filter(t => t.category === 'database');
    assert.equal(dbs.length, 0,
      'No database must be auto-detected from a typeorm dependency alone');
  });

  test('all returned technologies have confidence ≥ 0.60', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: {
        dependencies: {
          express: '^4.18.0',
          pg: '^8.11.0',
          '@prisma/client': '^5.0.0',
          mongoose: '^8.1.0',
          redis: '^4.6.0',
        },
        devDependencies: {
          prisma: '^5.0.0',
          typescript: '^5.0.0',
        },
      },
      flatFiles: ['prisma/schema.prisma', 'tsconfig.json'],
      configs: ['tsconfig.json'],
    }));

    for (const tech of result.technologies) {
      assert.ok(tech.confidence >= 0.60,
        `${tech.name} has confidence ${tech.confidence} below 0.60 threshold`);
    }
  });

});

// ---------------------------------------------------------------------------
// ── CATEGORY ORDERING: BACKEND → DATABASE → ORM ──────────────────────────────
// ---------------------------------------------------------------------------

describe('Category ordering: backend → database → orm', () => {

  test('backend technologies appear before database technologies', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: {
        dependencies: {
          express: '^4.18.0',
          pg: '^8.11.0',
        },
      },
    }));
    const names = result.technologies.map(t => t.name);
    const expressIdx = names.indexOf('Express');
    const pgIdx      = names.indexOf('PostgreSQL');

    assert.ok(expressIdx !== -1, 'Express must be detected');
    assert.ok(pgIdx      !== -1, 'PostgreSQL must be detected');
    assert.ok(expressIdx < pgIdx,
      `Express (backend) must come before PostgreSQL (database). Got: ${names}`);
  });

  test('database technologies appear before orm technologies', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: {
        dependencies: {
          pg: '^8.11.0',
          '@prisma/client': '^5.0.0',
        },
        devDependencies: { prisma: '^5.0.0' },
      },
    }));
    const names = result.technologies.map(t => t.name);
    const pgIdx     = names.indexOf('PostgreSQL');
    const prismaIdx = names.indexOf('Prisma');

    assert.ok(pgIdx     !== -1, 'PostgreSQL must be detected');
    assert.ok(prismaIdx !== -1, 'Prisma must be detected');
    assert.ok(pgIdx < prismaIdx,
      `PostgreSQL (database) must come before Prisma (orm). Got: ${names}`);
  });

  test('full ordering: frontend → backend → database → orm', () => {
    const result = detectTechnologyStack(emptyCtx({
      packageManifest: {
        dependencies: {
          react: '^18.0.0',
          express: '^4.18.0',
          pg: '^8.11.0',
          '@prisma/client': '^5.0.0',
        },
        devDependencies: { prisma: '^5.0.0' },
      },
    }));

    const cats = result.technologies.map(t => t.category);
    const catOrder = ['language', 'runtime', 'package-manager', 'frontend', 'backend', 'styling', 'database', 'orm'];

    let lastSeen = -1;
    for (const tech of result.technologies) {
      const rank = catOrder.indexOf(tech.category);
      if (rank === -1) continue;
      assert.ok(rank >= lastSeen,
        `${tech.name} (${tech.category}) appears out of order`);
      lastSeen = rank;
    }
  });

});

// ---------------------------------------------------------------------------
// ── SCAN() INTEGRATION FIXTURES ──────────────────────────────────────────────
// ---------------------------------------------------------------------------

describe('scan() integration — backend fixtures', () => {

  test('Express project → Express detected in scan result', () => {
    const dir = makeDir({
      'package.json': JSON.stringify({
        name: 'my-express-app',
        dependencies: { express: '^4.18.0' },
      }),
      'package-lock.json': '{}',
      'src/index.js': 'const express = require("express"); const app = express();',
    });
    after(() => fs.rmSync(dir, { recursive: true, force: true }));

    const result = scan(dir);
    assert.ok(find(result.technologyStack, 'Express'), 'Express must appear in scan result');
    assert.equal(find(result.technologyStack, 'Express').category, 'backend');
  });

  test('NestJS project → NestJS detected in scan result', () => {
    const dir = makeDir({
      'package.json': JSON.stringify({
        name: 'my-nest-app',
        dependencies: { '@nestjs/core': '^10.0.0', '@nestjs/common': '^10.0.0' },
        devDependencies: { typescript: '^5.0.0' },
      }),
      'package-lock.json': '{}',
      'nest-cli.json': '{"collection":"@nestjs/schematics"}',
      'tsconfig.json': '{"compilerOptions":{}}',
      'src/main.ts': 'import { NestFactory } from "@nestjs/core";',
    });
    after(() => fs.rmSync(dir, { recursive: true, force: true }));

    const result = scan(dir);
    assert.ok(find(result.technologyStack, 'NestJS'), 'NestJS must appear in scan result');
  });

  test('Django project → Django detected in scan result', () => {
    const dir = makeDir({
      'manage.py': '#!/usr/bin/env python\nimport django',
      'requirements.txt': 'Django==4.2.0\npsycopg2==2.9.0\n',
      'myapp/settings.py': 'DEBUG = True',
      'myapp/models.py': 'from django.db import models',
    });
    after(() => fs.rmSync(dir, { recursive: true, force: true }));

    const result = scan(dir);
    assert.ok(find(result.technologyStack, 'Django'), 'Django must appear in scan result');
    assert.equal(find(result.technologyStack, 'Django').category, 'backend');
  });

  test('FastAPI project → FastAPI detected in scan result', () => {
    const dir = makeDir({
      'main.py': 'from fastapi import FastAPI\napp = FastAPI()',
      'requirements.txt': 'fastapi==0.108.0\nuvicorn==0.25.0\n',
      'routers/items.py': 'from fastapi import APIRouter\nrouter = APIRouter()',
    });
    after(() => fs.rmSync(dir, { recursive: true, force: true }));

    const result = scan(dir);
    assert.ok(find(result.technologyStack, 'FastAPI'), 'FastAPI must appear in scan result');
  });

  test('Spring Boot project → Spring Boot detected in scan result', () => {
    const dir = makeDir({
      'pom.xml': '<project><modelVersion>4.0.0</modelVersion></project>',
      'build.gradle': 'plugins { id "org.springframework.boot" version "3.2.0" }',
      'src/main/java/com/example/DemoApplication.java':
        'public class DemoApplication { public static void main(String[] args) {} }',
    });
    after(() => fs.rmSync(dir, { recursive: true, force: true }));

    const result = scan(dir);
    assert.ok(find(result.technologyStack, 'Spring Boot'), 'Spring Boot must appear in scan result');
  });

  test('Laravel project → Laravel + Eloquent detected in scan result', () => {
    const dir = makeDir({
      'artisan': '#!/usr/bin/env php',
      'composer.json': '{"require":{"laravel/framework":"^10.0"}}',
      'app/Models/User.php': '<?php namespace App\\Models; use Illuminate\\Database\\Eloquent\\Model;',
      'config/app.php': '<?php return [];',
    });
    after(() => fs.rmSync(dir, { recursive: true, force: true }));

    const result = scan(dir);
    assert.ok(find(result.technologyStack, 'Laravel'),  'Laravel must appear in scan result');
    assert.ok(find(result.technologyStack, 'Eloquent'), 'Eloquent must appear in scan result');
  });

  test('Rails project → Rails + Active Record detected in scan result', () => {
    const dir = makeDir({
      'Gemfile': 'source "https://rubygems.org"\ngem "rails", "~> 7.1.0"\n',
      'config/routes.rb': 'Rails.application.routes.draw do\nend',
      'db/schema.rb': 'ActiveRecord::Schema[7.1].define(version: 1) do\nend',
      'app/models/user.rb': 'class User < ApplicationRecord\nend',
    });
    after(() => fs.rmSync(dir, { recursive: true, force: true }));

    const result = scan(dir);
    assert.ok(find(result.technologyStack, 'Rails'),         'Rails must appear in scan result');
    assert.ok(find(result.technologyStack, 'Active Record'), 'Active Record must appear in scan result');
  });

  test('Prisma + PostgreSQL project → both detected in scan result', () => {
    const dir = makeDir({
      'package.json': JSON.stringify({
        name: 'prisma-pg-app',
        dependencies: { '@prisma/client': '^5.0.0', pg: '^8.11.0' },
        devDependencies: { prisma: '^5.0.0', typescript: '^5.0.0' },
      }),
      'package-lock.json': '{}',
      'tsconfig.json': '{"compilerOptions":{}}',
      'prisma/schema.prisma': 'datasource db { provider = "postgresql" url = env("DATABASE_URL") }',
    });
    after(() => fs.rmSync(dir, { recursive: true, force: true }));

    const result = scan(dir);
    assert.ok(find(result.technologyStack, 'Prisma'),     'Prisma must appear in scan result');
    assert.ok(find(result.technologyStack, 'PostgreSQL'), 'PostgreSQL must appear in scan result');
  });

  test('MongoDB + Mongoose project → both detected in scan result', () => {
    const dir = makeDir({
      'package.json': JSON.stringify({
        name: 'mongo-app',
        dependencies: { mongodb: '^6.3.0', mongoose: '^8.1.0', express: '^4.18.0' },
      }),
      'package-lock.json': '{}',
      'src/index.js': 'const mongoose = require("mongoose");',
    });
    after(() => fs.rmSync(dir, { recursive: true, force: true }));

    const result = scan(dir);
    assert.ok(find(result.technologyStack, 'MongoDB'),  'MongoDB must appear in scan result');
    assert.ok(find(result.technologyStack, 'Mongoose'), 'Mongoose must appear in scan result');
    assert.ok(find(result.technologyStack, 'Express'),  'Express must appear in scan result');
  });

  test('MySQL project → MySQL detected, PostgreSQL NOT detected', () => {
    const dir = makeDir({
      'package.json': JSON.stringify({
        name: 'mysql-app',
        dependencies: { mysql2: '^3.6.0', express: '^4.18.0' },
      }),
      'package-lock.json': '{}',
      'src/db.js': 'const mysql = require("mysql2");',
    });
    after(() => fs.rmSync(dir, { recursive: true, force: true }));

    const result = scan(dir);
    assert.ok(find(result.technologyStack, 'MySQL'), 'MySQL must appear in scan result');
    assert.equal(find(result.technologyStack, 'PostgreSQL'), undefined,
      'PostgreSQL must NOT be detected in a MySQL project');
  });

  test('Redis project → Redis detected', () => {
    const dir = makeDir({
      'package.json': JSON.stringify({
        name: 'redis-cache-app',
        dependencies: { redis: '^4.6.0', ioredis: '^5.3.0', express: '^4.18.0' },
      }),
      'package-lock.json': '{}',
      'src/cache.js': 'const { createClient } = require("redis");',
    });
    after(() => fs.rmSync(dir, { recursive: true, force: true }));

    const result = scan(dir);
    assert.ok(find(result.technologyStack, 'Redis'), 'Redis must appear in scan result');
    // redis + ioredis → single Redis entry
    assert.equal(
      result.technologyStack.technologies.filter(t => t.name === 'Redis').length, 1,
      'Redis must appear exactly once in scan result',
    );
  });

  test('no duplicate technologies in any scan result', () => {
    const dir = makeDir({
      'package.json': JSON.stringify({
        name: 'full-stack',
        dependencies: {
          react: '^18.0.0',
          express: '^4.18.0',
          pg: '^8.11.0',
          '@prisma/client': '^5.0.0',
          redis: '^4.6.0',
        },
        devDependencies: {
          typescript: '^5.0.0',
          prisma: '^5.0.0',
        },
      }),
      'package-lock.json': '{}',
      'tsconfig.json': '{}',
      'prisma/schema.prisma': 'datasource db { provider = "postgresql" }',
      'src/index.ts': 'import express from "express";',
    });
    after(() => fs.rmSync(dir, { recursive: true, force: true }));

    const result = scan(dir);
    const names  = result.technologyStack.technologies.map(t => t.name);
    const unique = new Set(names);
    assert.equal(unique.size, names.length,
      `Duplicate technologies found in scan result: ${names.filter((n, i) => names.indexOf(n) !== i)}`);
  });

  test('all technologies in scan result have confidence ≥ 0.60', () => {
    const dir = makeDir({
      'package.json': JSON.stringify({
        name: 'threshold-check',
        dependencies: { express: '^4.18.0', pg: '^8.11.0', mongoose: '^8.1.0' },
        devDependencies: { typescript: '^5.0.0' },
      }),
      'package-lock.json': '{}',
      'tsconfig.json': '{}',
    });
    after(() => fs.rmSync(dir, { recursive: true, force: true }));

    const result = scan(dir);
    for (const tech of result.technologyStack.technologies) {
      assert.ok(tech.confidence >= 0.60,
        `${tech.name} has confidence ${tech.confidence} below 0.60 threshold`);
    }
  });

});
