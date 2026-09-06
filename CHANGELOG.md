# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

