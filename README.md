# Toren — Fast Repository Discovery CLI

> The fastest way to understand any project structure. A zero-dependency codebase scanner CLI for modern developers.

[![npm version](https://img.shields.io/npm/v/@lakindudev/toren.svg)](https://www.npmjs.com/package/@lakindudev/toren)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org)
[![Zero Dependencies](https://img.shields.io/badge/dependencies-zero-success.svg)](package.json)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## What is Toren?

**Toren** is a fast, lightweight **codebase analyzer CLI** and **project scanner tool** designed to generate instant onboarding intelligence reports. By recursively scanning any local directory, Toren detects the underlying project framework, identifies critical entry points, and visualizes the folder structure—all in milliseconds.

Built with zero external dependencies, this **Node.js repository explorer** is the ultimate **developer onboarding tool** to help you conquer the "first 5 minutes" of navigating an unfamiliar repository.

---

## Features

- **Recursive Project Scanning**: Fast directory traversal using native Node.js APIs.
- **Framework Detection**: Instantly identifies Node.js, React, Next.js, Vue, Nuxt, Angular, Svelte, Python, Go, Rust, Spring Boot, Ruby, PHP, Elixir and more.
- **Entry Point Detection**: Automatically pinpoints where execution begins (e.g., `index.js`, `main.ts`, `App.tsx`, `main.go`).
- **Project Structure Visualizer**: Generates clean, hierarchical file trees.
- **Project Health Diagnostics**: Provides observations and warnings for common project health issues.
- **Package Manager Detection**: Identifies whether a project uses npm, pnpm, yarn, bun, etc.
- **Multiple Output Formats**: Choose between `console` (default), `json`, `markdown`, or `html` reports.
- **Zero Dependencies**: A pure Node.js CLI tool with no external runtime packages. Lightning fast install, infinitely secure.
- **CLI Lifecycle Tools**: Native diagnostic and uninstallation tools (`--doctor`, `--uninstall`).

---

## Installation

Install Toren globally via npm to make the **repository inspection CLI** available anywhere on your machine:

```bash
npm install -g @lakindudev/toren
```

**Requirements:** Node.js 18.0.0 or higher.

---

## CLI Usage

Toren is designed to be simple and intuitive. Point it at any directory to generate an immediate intelligence report.

```bash
# Scan a specific path
toren /path/to/project

# Scan the current directory
toren .

# Export results in different formats
toren --format json
toren --format markdown
toren --format html

# Save output to a file
toren --format markdown > PROJECT_REPORT.md
toren --format html > report.html
toren --format json > scan.json

# Focused Output Modes (Mutually Exclusive)
toren --project-type
toren --frameworks
toren --entry-points
toren --structure
toren --configs
toren --scripts
toren --summary
toren --important-files
toren --health

# Lifecycle & Help Commands
toren --help
toren --version
toren --doctor
toren --uninstall
```

### CLI Reference

| Command / Flag | Description |
|----------------|-------------|
| `[path]` | Directory to scan. Defaults to the current directory (`.`). |
| `--project-type` | Show detected project type only. |
| `--frameworks` | Show detected frameworks only. |
| `--entry-points` | Show detected entry points only. |
| `--structure` | Show repository structure only. |
| `--configs` | Show detected project configuration files. |
| `--scripts` | Show available package scripts only. |
| `--summary` | Show project summary only. |
| `--important-files` | Show important files only. |
| `--health` | Show project health observations only. |
| `--format <type>` | Output format: `console` (default), `json`, `markdown`, `html`. |
| `--include-hidden` | Include hidden files and dot-directories in the scan. |
| `--max-files <n>` | Override the default 50,000-file scan limit. |
| `--help`, `-h` | Show usage and help message. |
| `--version`, `-v` | Print the installed version number. |
| `--doctor` | Diagnose the global installation health. |
| `--uninstall` | Safely remove Toren from the global npm environment. |

> **Note:** `--format md` is not a valid alias. Use `--format markdown` in full.
> **Note:** Focused output flags are mutually exclusive.

---

## Screenshots & Output Examples

### Console Output Example
The default `console` format renders a beautiful summary directly in your terminal:

```text
Toren v1.0.7  —  Fast Repository Discovery CLI

Project Summary
───────────────

Path:          ./my-react-app
Project type:  React
Total files:   32
Total folders: 6

Entry Points
────────────

src/main.tsx

Folder Structure  (first 20 files)
──────────────────────────────────

my-react-app/
├── public/
│   └── vite.svg
├── src/
│   ├── assets/
│   │   └── react.svg
│   ├── App.css
│   ├── App.tsx
│   ├── index.css
│   └── main.tsx
├── index.html
├── package.json
└── vite.config.ts
… and 21 more file(s) not shown

Scan completed in 4 ms
```

### Focused Output Examples
Sometimes you only need a specific piece of intelligence for use in a script or a quick lookup. Use the focused output flags to bypass the full report:

```bash
$ toren --project-type
Project Type
────────────

Node.js / JavaScript

$ toren --scripts
Package Scripts
───────────────

start  vite
test   vitest
```

### JSON Output Example
Generate machine-readable output for scripts, toolchains, or AI context windows by running `toren --format json`:

```json
{
  "meta": {
    "version": "1.0.7",
    "scanDurationMs": 4,
    "timestamp": "2026-08-29T23:51:00.000Z"
  },
  "project": {
    "name": "my-react-app",
    "path": "./my-react-app",
    "type": "React",
    "framework": "React",
    "packageManager": "npm"
  },
  "frameworks": [
    "React"
  ],
  "entryPoints": [
    "src/main.tsx"
  ],
  "configs": [
    "package.json",
    "vite.config.ts"
  ],
  "scripts": [
    {
      "name": "start",
      "command": "vite",
      "description": "Start the development server",
      "category": "development",
      "usage": "npm start"
    }
  ],
  "importantFiles": [
    {
      "path": "package.json",
      "reason": "Defines dependencies"
    }
  ],
  "health": [
    {
      "id": "readme",
      "status": "pass",
      "message": "README file is present"
    }
  ],
  "statistics": {
    "totalFiles": 32,
    "totalFolders": 6
  },
  "structure": [
    {
      "type": "folder",
      "name": "src",
      "children": [
        { "type": "file", "name": "App.tsx" },
        { "type": "file", "name": "main.tsx" }
      ]
    },
    { "type": "file", "name": "package.json" }
  ],
  "summary": {
    "totalFiles": 32,
    "totalFolders": 6,
    "scanDurationMs": 4
  }
}
```

*Note: You can also generate rich, GitHub-flavored Markdown (`--format markdown`) or self-contained HTML reports (`--format html`) for documentation purposes!*

---

## Release Notes

### v1.0.7 - Intelligence Upgrade
- **Project Intelligence Upgrade**: Added Package Manager detection, project metadata extraction (name, language, runtime, architecture), and important file detection.
- **Project Health Checks**: New `--health` flag to evaluate repository health (checking for README, License, linting, tests, docker files).
- **Richer Output Formats**: Expanded HTML and Markdown renderers to include the newly extracted project details, ensuring a highly readable and comprehensive project overview.
- **Enhanced JSON schema**: Output JSON schema has been substantially updated to support these rich data properties in a deterministic order.

### v1.0.6 - CLI Experience Update
- **Redesigned CLI Output**: Completely revamped the console layout to use minimal typography, bold section titles, and dynamic divider lines matching the title width.
- **Improved Error Handling**: Transformed raw exceptions into user-friendly error messages outlining the issue and potential fixes, ensuring consistent exit codes.
- **Enhanced Focused Modes**: Focused output flags (`--configs`, `--entry-points`, `--structure`, etc.) now strictly mirror the design tokens of the full console renderer, providing identical spacing and layouts.
- **Streamlined Help & Version**: The `--help` interface was fully redesigned for faster reading, and `-v` / `--version` flags were added to output the exact binary version directly from `package.json`.
- **Accurate Timing Metrics**: Scan duration logic was improved to utilize native timing APIs, precisely measuring execution and printing results natively as "Scan completed in X ms" without clogging the project summary.

---

## Architecture

Toren's internal architecture emphasizes modular design, separation of concerns, and a strict **zero dependency** philosophy.

- **`bin/toren.js`** — The CLI entry point. Handles argument parsing, option validation, and orchestrates the scanning and rendering phases.
- **`src/scanner/scan.js`** — The core scanning engine. Safely traverses the file system, executes framework detection heuristics, and extracts entry points.
- **`src/renderers/`** — The output formatting system. A highly decoupled registry of formatters (`console`, `json`, `html`, `markdown`). Each renderer consumes the raw scan data and formats it independently.
- **`src/lifecycle.js`** — Dedicated install/uninstall diagnostic tools (`--doctor`, `--uninstall`) to ensure the global CLI binary remains healthy.

---

## Why Toren Exists

Modern software development moves fast, but **onboarding into large codebases is slow**.

When developers join a new team, review a complex pull request, or audit an open-source project, they waste valuable time manually clicking through folders and reading `package.json` files just to understand the basic structure.

**Toren solves the "first 5 minutes of any repo" problem.**

As a dedicated **developer onboarding tool**, Toren automates the initial discovery phase. In a single command, it tells you exactly what the project is, where the code starts executing, and how the folders are structured. By eliminating the manual guesswork of repository inspection, Toren drastically improves developer productivity.

---

## Roadmap (Future Improvements)

- `.torenignore` configuration file support
- Dependency graph analysis and visualization
- Plugin system for custom renderer injection
- AI-generated natural language project summaries

---

## Contributing

Contributions to improve this codebase analyzer CLI are always welcome!

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

*Please ensure all new features maintain the strict zero-dependency architecture rule.*

---

## Maintainer: Releasing a New Version

Toren uses **automated npm publishing via GitHub Actions** and [npm Trusted Publishing (OIDC)](https://docs.npmjs.com/generating-provenance-statements).  
**Do not run `npm publish` manually** — GitHub Actions owns the publish step.

### Release checklist

```text
1. Implement changes on a feature branch.

2. Update the version in package.json:
       "version": "1.0.8"

3. Run tests and lint locally:
       npm test
       npm run lint

4. Commit the version bump and any other changes:
       git commit -m "chore: release v1.0.8"

5. Open a Pull Request → merge to main.

6. On GitHub, create a new Release:
       Tag:   v1.0.8        ← must match package.json exactly (with leading v)
       Title: v1.0.8
       Body:  paste CHANGELOG.md entry

7. Click "Publish Release".

8. GitHub Actions runs automatically:
       ✔ npm ci
       ✔ npm test  (all 233+ tests must pass)
       ✔ npm run lint
       ✔ tag format validated  (vX.Y.Z)
       ✔ tag v1.0.8 == package.json 1.0.8
       ✔ npm pack --dry-run
       ✔ npm publish --access public --provenance

9. @lakindudev/toren@1.0.8 is live on npmjs.com.
```

### If the workflow fails

| Failure step | Cause | Fix |
|---|---|---|
| Run tests | A test is failing | Fix the test, push, re-create release |
| Run lint | Syntax error in source | Fix lint error, push, re-create release |
| Validate tag format | Tag is not `vX.Y.Z` | Delete the release, re-create with correct tag |
| Verify version matches | `package.json` not bumped | Update `package.json`, push, re-create release |
| Verify package contents | `files` array misconfigured | Fix `package.json`, push, re-create release |
| Publish to npm | Trusted Publisher not configured | Follow the npm Trusted Publisher setup in `.github/workflows/publish.yml` header |

---

## License

Distributed under the MIT License. See `LICENSE` for more information.

---

## Author

Built with by **[Lakindu Perera](https://github.com/lakindudev)**.
