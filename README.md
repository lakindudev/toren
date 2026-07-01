# Toren

> Understand any codebase in seconds.

[![npm version](https://img.shields.io/npm/v/toren.svg)](https://www.npmjs.com/package/toren)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org)
[![Zero Dependencies](https://img.shields.io/badge/dependencies-zero-success.svg)](package.json)

---

## What is Toren?

**Toren** is a lightweight, zero-dependency CLI tool that scans a software project and gives you an instant, structured overview — without reading a single line of code.

Drop it into any unfamiliar repository and immediately see:

- What technology stack the project uses
- Where the application starts (entry points)
- How many files and folders exist
- A visual preview of the directory structure

Whether you've just cloned an open-source project, joined a new team, or are reviewing a client's codebase, Toren cuts through the noise and gets you oriented fast.

---

## Features

- ⚡ **Fast scanning** — recursively walks a project in milliseconds
- 📦 **Zero external dependencies** — pure Node.js stdlib only
- 🧠 **Framework detection** — identifies React, Next.js, Vue, Angular, Go, Rust, Python, and more
- 🚪 **Entry point detection** — pinpoints `index.js`, `main.ts`, `App.tsx`, `Application.java`, and other common entry files
- 🌲 **File tree preview** — visual directory structure, up to 4 levels deep
- 🎨 **Beautiful terminal output** — ANSI-styled, readable at a glance
- 🔧 **JSON output** — machine-readable format for scripting and tooling integration
- 🙈 **Smart ignore rules** — skips `node_modules`, `.git`, `dist`, `build`, `.venv`, and more
- 🔌 **Extensible renderer architecture** — add new output formats without touching core logic

---

## Installation

Install globally with npm:

```bash
npm install -g toren
```

Or run without installing:

```bash
npx toren
```

**Requirements:** Node.js 18.0.0 or higher.

---

## Quick Start

Scan the current directory:

```bash
toren
```

Scan a specific path:

```bash
toren .
toren ../my-project
toren /path/to/any/repo
```

Output results as JSON:

```bash
toren --json
```

Check your global installation:

```bash
toren --doctor
```

---

## Example Output

```
  Toren v1.0.0  —  Codebase Onboarding Intelligence

🔍  Project Summary
────────────────────────────────────────────────────────────────────────────────
  Path:          ./my-app
  Project type:  Next.js
  Total files:   48
  Total folders: 11
  Scan duration: 3 ms

🚪  Entry Points
────────────────────────────────────────────────────────────────────────────────
  →  src/app/page.tsx
  →  src/app/layout.tsx

📁  Folder Structure  (first 20 files)
────────────────────────────────────────────────────────────────────────────────
my-app/
├── public/
│   └── favicon.ico
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   ├── Header.tsx
│   │   └── Footer.tsx
│   └── lib/
│       └── utils.ts
├── .eslintrc.json
├── next.config.js
├── package.json
└── tsconfig.json
  … and 28 more file(s) not shown

────────────────────────────────────────────────────────────────────────────────
  ✅  Scan complete.
```

---

## JSON Output

Use `toren --json` to get a machine-readable result suitable for piping into other tools:

```json
{
  "project": {
    "path": "./my-app",
    "type": "Next.js",
    "framework": "Next.js"
  },
  "summary": {
    "totalFiles": 48,
    "totalFolders": 11,
    "scanDurationMs": 3
  },
  "entryPoints": [
    "src/app/page.tsx",
    "src/app/layout.tsx"
  ],
  "structure": [
    {
      "type": "folder",
      "name": "src",
      "children": [
        {
          "type": "folder",
          "name": "app",
          "children": [
            { "type": "file", "name": "layout.tsx" },
            { "type": "file", "name": "page.tsx" }
          ]
        }
      ]
    },
    { "type": "file", "name": "package.json" },
    { "type": "file", "name": "next.config.js" }
  ]
}
```

---

## Supported Project Types

Toren detects the following project types automatically:

| Marker File                          | Detected Type              |
|--------------------------------------|----------------------------|
| `package.json`                       | Node.js / JavaScript       |
| `package.json` + `next` dep          | Next.js                    |
| `package.json` + `react` dep         | React                      |
| `package.json` + `vue` dep           | Vue.js                     |
| `package.json` + `@angular/core` dep | Angular                    |
| `package.json` + `svelte` dep        | Svelte                     |
| `package.json` + `express` dep       | Node.js / Express          |
| `package.json` + `fastify` dep       | Node.js / Fastify          |
| `package.json` + `koa` dep           | Node.js / Koa              |
| `package.json` + `typescript` dep    | Node.js / TypeScript       |
| `requirements.txt`                   | Python                     |
| `Pipfile`                            | Python (Pipenv)            |
| `pyproject.toml`                     | Python (pyproject)         |
| `go.mod`                             | Go                         |
| `Cargo.toml`                         | Rust                       |
| `pom.xml`                            | Java / Spring Boot         |
| `build.gradle`                       | Java / Gradle              |
| `composer.json`                      | PHP / Composer             |
| `Gemfile`                            | Ruby                       |
| `mix.exs`                            | Elixir                     |

If no marker is found, Toren reports `Unknown` without failing.

---

## CLI Reference

| Command              | Description                                      |
|----------------------|--------------------------------------------------|
| `toren`              | Scan the current directory                       |
| `toren [path]`       | Scan a specific directory or file path           |
| `toren --json`       | Output scan results as formatted JSON            |
| `toren --version`    | Print the installed version number               |
| `toren --help`       | Show usage information                           |
| `toren --doctor`     | Diagnose the global installation health          |
| `toren --uninstall`  | Guided removal of the global installation        |

---

## Project Structure

```
toren/
├── bin/
│   └── toren.js          # CLI entry point — argument parsing and orchestration
├── src/
│   ├── lifecycle.js      # --doctor and --uninstall command implementations
│   ├── scanner/
│   │   └── scan.js       # Core scanning engine — file walker, type detection, entry point detection
│   └── renderers/
│       ├── console-renderer.js   # ANSI-styled terminal output
│       ├── json-renderer.js      # Machine-readable JSON output
│       └── tree-renderer.js      # Standalone flat-file tree formatter (utility)
└── package.json
```

---

## How It Works

### 1. Scanner

`src/scanner/scan.js` is the core engine. It takes a target path and recursively walks the file system using Node's `fs.readdirSync`, collecting every file and directory while skipping entries in the ignore list (`node_modules`, `.git`, `dist`, `build`, etc.).

The result is an in-memory tree of `DirNode` and `FileNode` objects, along with a flat list of all relative file paths.

### 2. Framework Detection

After walking the directory, the scanner checks for known marker files at the project root (e.g. `package.json`, `go.mod`, `Cargo.toml`). For `package.json`, it reads the file and inspects `dependencies`, `devDependencies`, and `peerDependencies` to determine the specific framework (React, Next.js, Vue, Angular, etc.).

### 3. Entry Point Detection

During the walk, each filename is checked against a known set of entry points: `index.js`, `index.ts`, `main.py`, `App.tsx`, `Application.java`, `page.tsx`, `layout.tsx`, etc. All matches are collected and surfaced in the output.

### 4. Renderer

The scan result — a plain JavaScript object — is passed to a renderer. Renderers are completely decoupled from the scanner; they only read data and produce output.

### 5. Output

The CLI selects the appropriate renderer based on flags (`--json` → JSON renderer; default → console renderer). Errors are caught and formatted consistently in both modes.

---

## Architecture

```
CLI (bin/toren.js)
        │
        ▼
  Argument Parser
        │
        ▼
   Scanner (scan.js)
        │
        ├── Directory Walker
        ├── Ignore Filter
        ├── Framework Detector
        └── Entry Point Detector
        │
        ▼
   ScanResult (plain object)
        │
        ├──────────────────┐
        ▼                  ▼
Console Renderer      JSON Renderer
(ANSI terminal)    (stdout / pipe)
```

Adding a new output format is as simple as creating a new file in `src/renderers/` and importing it in `bin/toren.js`.

---

## Why Toren?

When you encounter a new codebase, the usual approach is to start opening files, guessing at folder names, and reading `package.json` manually. This works — but it's slow and inconsistent.

Toren automates that first pass. In one command, you get a structured summary of what the project is, where it starts, and what's inside. This is especially useful when:

- **Onboarding to a new job** — quickly orient yourself before your first meeting
- **Reviewing a pull request or open-source repo** — understand the scope at a glance
- **Auditing a legacy codebase** — know what you're dealing with before diving in
- **Building tooling** — use `--json` to feed project metadata into scripts or AI tools

---

## Roadmap

- [x] Console renderer
- [x] JSON renderer
- [x] Framework detection (11+ project types)
- [x] Entry point detection
- [x] `--doctor` install health check
- [x] `--uninstall` guided removal
- [ ] Markdown renderer (`--format md`)
- [ ] HTML renderer (`--format html`)
- [ ] YAML output
- [ ] `.torenignore` configuration file
- [ ] Plugin / custom renderer system
- [ ] Dependency graph analysis
- [ ] AI-generated project summary
- [ ] Project health score
- [ ] Architecture visualisation layer

---

## Contributing

Contributions are welcome and appreciated.

1. **Fork** this repository
2. **Create** a feature branch: `git checkout -b feature/my-feature`
3. **Commit** your changes: `git commit -m "feat: add my feature"`
4. **Push** to your branch: `git push origin feature/my-feature`
5. **Open** a pull request

For bugs or feature requests, please [open an issue](https://github.com/your-username/toren/issues). Try to include a clear description and, for bugs, the output of `toren --doctor`.

**Code style notes:**
- Zero external runtime dependencies — keep it that way
- No TypeScript compilation step — plain ES modules only
- Keep scanner and renderers strictly decoupled
- Document public functions with JSDoc

---

## License

[MIT](LICENSE) — free to use, modify, and distribute.

---

*If Toren saves you time, consider starring the repository — it helps others discover the project.* ⭐
