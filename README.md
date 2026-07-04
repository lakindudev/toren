# Toren — Codebase Intelligence CLI

> Understand any codebase in seconds.

[![npm version](https://img.shields.io/npm/v/@lakindu_perera/toren.svg)](https://www.npmjs.com/package/@lakindu_perera/toren)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org)
[![Zero Dependencies](https://img.shields.io/badge/dependencies-zero-success.svg)](package.json)

---

## What is Toren?

**Toren** is a powerful **codebase intelligence CLI** and **project analysis** tool designed to help developers understand unfamiliar repositories instantly. By running this lightweight **scanner**, you gain immediate insight into the architecture of any software project. It performs robust **framework detection**, identifies critical application start files through **entry point analysis**, and generates a clear **project structure visualization**—all without requiring you to read a single line of code.

Whether you are onboarding to a new team, auditing a complex repository, or looking for a fast **monorepo analyzer**, Toren cuts through the noise and gets you oriented fast.

---

## Features

Toren is built to deliver comprehensive repository insights efficiently:

- **Codebase Scanning**: Recursively walks any project in milliseconds to gather deep architectural insights.
- **Framework Detection**: Instantly identifies the underlying technologies powering the application.
- **Entry Point Analysis**: Automatically pinpoints where execution begins (e.g., `index.js`, `main.ts`, `App.tsx`, `Application.java`).
- **Project Structure Visualization**: Generates a beautiful, hierarchical directory tree right in your terminal.
- **Monorepo Support**: Gracefully handles complex, multi-package repositories without failing.
- **Zero Dependencies**: A pure Node.js CLI tool with zero external runtime packages.
- **Machine-Readable Output**: Full JSON support for seamless integration with other developer tools and AI agents.

---

## Installation

Install the **Toren CLI tool** globally via npm to use it across all your local projects:

```bash
npm install -g @lakindu_perera/toren
```

Alternatively, you can run it instantly without global installation:

```bash
npx @lakindu_perera/toren
```

**Requirements:** Node.js 18.0.0 or higher.

---

## Usage Examples

Navigate to your target project folder or point Toren directly to a repository.

Scan the current directory for an instant summary:

```bash
toren .
```

Scan and output the analysis in JSON format (ideal for toolchain integrations):

```bash
toren . --format json
```

Run a deep analysis on the codebase:

```bash
toren . --analyze
```

*Note: You can also point Toren to any absolute or relative path, e.g., `toren ../my-project`.*

---

## Supported Frameworks

Toren is equipped with highly accurate **framework detection** for modern development stacks. It automatically detects:

- **Next.js**
- **React**
- **Node.js** (including Express, Fastify, Koa, and TypeScript variants)
- **Spring Boot** (Java)
- **Python** (including Pipenv and pyproject.toml setups)
- **Go**
- **Rust**
- **Vue.js**
- **Angular**
- **Svelte**
- **PHP**
- **Ruby**
- **Elixir**

If a specific marker is not found, Toren intelligently falls back to structural heuristics to identify generic entry points, ensuring you always get meaningful project analysis.

---

## Example Output

```
  Toren v1.0.1  —  Codebase Onboarding Intelligence

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

## Contributing

Contributions to improve this **repository analyzer** and **developer tool** are welcome!

1. **Fork** this repository.
2. **Create** a feature branch: `git checkout -b feature/my-feature`.
3. **Commit** your changes: `git commit -m "feat: add my feature"`.
4. **Push** to your branch: `git push origin feature/my-feature`.
5. **Open** a Pull Request.

Please ensure any additions maintain the zero-dependency architecture. 

---

## License

[MIT](LICENSE) — free to use, modify, and distribute.

---

*If Toren saves you time during your codebase analysis, please consider starring the repository — it helps other developers discover this project.* ⭐
