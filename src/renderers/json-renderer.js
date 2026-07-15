/**
 * @fileoverview Toren — JSON Renderer
 *
 * Consumes a ScanResult and produces a clean JSON object for programmatic use.
 */

import path from 'node:path';

function mapTree(node) {
  if (node.type === 'directory') {
    return {
      type: 'folder',
      name: node.name,
      children: (node.children || []).map(mapTree)
    };
  } else {
    return {
      type: 'file',
      name: node.name
    };
  }
}

export function render(result, options = {}) {
  const {
    rootPath,
    projectType,
    entryPoints,
    configs = [],
    tree,
    flatFiles,
    totalFolders,
    scanDurationMs,
  } = result;

  const cwd = options.cwd ?? process.cwd();
  const relRoot = path.relative(cwd, rootPath) || '.';

  const output = {
    project: {
      path: relRoot,
      type: projectType,
      framework: projectType,
    },
    summary: {
      totalFiles: flatFiles.length,
      totalFolders,
      scanDurationMs: Math.round(scanDurationMs),
    },
    entryPoints,
    configs,
    structure: (tree.children || []).map(mapTree)
  };

  console.log(JSON.stringify(output, null, 2));
}
