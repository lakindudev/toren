# Toren — Codebase Analyzer CLI

> The fastest way to understand any project structure. A zero-dependency codebase scanner CLI for modern developers.

[![npm version](https://img.shields.io/npm/v/@lakindu_perera/toren.svg)](https://www.npmjs.com/package/@lakindu_perera/toren)
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
- **Multiple Output Formats**: Choose between `console` (default), `json`, `markdown`, or `html` reports.
- **Zero Dependencies**: A pure Node.js CLI tool with no external runtime packages. Lightning fast install, infinitely secure.
- **CLI Lifecycle Tools**: Native diagnostic and uninstallation tools (`--doctor`, `--uninstall`).

---

## Installation

Install Toren globally via npm to make the **repository inspection CLI** available anywhere on your machine:

```bash
npm install -g @lakindu_perera/toren
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

# Lifecycle & Help Commands
toren --help
toren --version
toren --doctor
toren --uninstall
```

### All Flags

| Flag | Description |
|------|-------------|
| `[path]` | Directory to scan. Defaults to the current directory (`.`). |
| `--format <type>` | Output format: `console` (default), `json`, `markdown`, `html`. |
| `--include-hidden` | Include hidden files and dot-directories in the scan. |
| `--max-files <N>` | Override the default 50,000-file scan limit. |
| `--help` / `-h` | Show usage information. |
| `--version` / `-V` | Print the installed version number. |
| `--doctor` | Diagnose the global installation health. |
| `--uninstall` | Safely remove Toren from the global npm environment. |

> **Note:** `--format md` is not a valid alias. Use `--format markdown` in full.

---

## Output Examples

### Console Output Example
The default `console` format renders a beautiful summary directly in your terminal:

```text
  Toren v1.0.3  —  Codebase Onboarding Intelligence

🔍  Project Summary
────────────────────────────────────────────────────────────────────────────────
  Path:          ./my-react-app
  Project type:  React
  Total files:   32
  Total folders: 6
  Scan duration: 4 ms

🚪  Entry Points
────────────────────────────────────────────────────────────────────────────────
  →  src/main.tsx

📁  Folder Structure  (first 20 files)
────────────────────────────────────────────────────────────────────────────────
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

────────────────────────────────────────────────────────────────────────────────
  ✅  Scan complete.
```

### JSON Output Example
Generate machine-readable output for scripts, toolchains, or AI context windows by running `toren --format json`:

```json
{
  "project": {
    "path": "./my-react-app",
    "type": "React",
    "framework": "React"
  },
  "summary": {
    "totalFiles": 32,
    "totalFolders": 6,
    "scanDurationMs": 4
  },
  "entryPoints": [
    "src/main.tsx"
  ],
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
  ]
}
```

*Note: You can also generate rich, GitHub-flavored Markdown (`--format markdown`) or self-contained HTML reports (`--format html`) for documentation purposes!*

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

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

---

## 👨‍💻 Author

Built with by **[Lakindu Perera](https://github.com/lakindudev)**.
