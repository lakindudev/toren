# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-09-09
### Added
- Technology Stack detector for Testing, Build, Quality, Container, and Deployment tools.
- `--tech-stack` CLI flag for focused technology breakdown.
- Technology Stack section included in JSON, Console, Markdown, and HTML outputs.
- **Backend Framework Detection**: Detects Node.js (Express, Fastify, NestJS, Koa, Hapi), Python (Django, Flask, FastAPI), Java (Spring Boot), PHP (Laravel), and Ruby (Rails) backends using package dependency and structural file evidence only.
- **Database Detection**: Detects PostgreSQL, MySQL, MariaDB, SQLite, MongoDB, and Redis from package dependencies and config/schema files. Never reads `.env` files or credentials.
- **ORM / Data-Access Detection**: Independently detects Prisma, Drizzle, TypeORM, Sequelize, Mongoose, Knex, SQLAlchemy, Hibernate, Django ORM, Eloquent, and Active Record. ORMs are never inferred from database type and vice-versa.
- **Safety Guarantees**: `.env`, `.env.*` secret files are never read or inspected. Database URLs and credentials are never used as evidence. All signals are structural (package names, file presence, config files).
- **128 new tests** covering all backend, database, ORM detectors plus false-positive guards, `.env` safety, category ordering, and `scan()` integration fixtures.

## [1.0.10] - 2026-09-06
### Added
- **Full Tree Output**: Added a new `--all` (or `-a`) flag to the CLI. This flag bypasses the default display limit and prints the complete directory tree without hiding any files or folders, making it easier to view, copy, or document the entire file structure.

## [1.0.9] - 2026-08-31
### Changed
- **TypeScript Foundation**: Completely migrated the entire Torén codebase from JavaScript to TypeScript.
- **Zero Runtime Dependencies**: The CLI continues to operate natively on Node.js without needing ts-node or any other runtime bundlers. Source code is compiled to `.js` files using ES2022 targets.
- **Build & CI Improvements**: Set up robust static type-checking and automated build steps using `tsc`.



## [1.0.7] - 2026-08-29
### Added
- **Project Intelligence Upgrade**: Added Package Manager detection, project metadata extraction (name, language, runtime, architecture), and important file detection.
- **Project Health Checks**: New `--health` flag to evaluate repository health (checking for README, License, linting, tests, docker files).
- **Richer Output Formats**: Expanded HTML and Markdown renderers to include the newly extracted project details, ensuring a highly readable and comprehensive project overview.
- **Enhanced JSON schema**: Output JSON schema has been substantially updated to support these rich data properties in a deterministic order.
- **New CLI flags**: `--summary`, `--important-files`, and `--health`.

### Changed
- Refactored `ScanResult` object with `packageManager`, `projectInfo`, `health`, and `importantFiles`.
- Updated test suite for new CLI flags and deterministic JSON output.

