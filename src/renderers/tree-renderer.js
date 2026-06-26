/**
 * @fileoverview Toren — Tree Renderer
 * 
 * Formats a flat array of file paths into a clean CLI tree view.
 */

/**
 * Converts a flat file list into a hierarchical tree structure and renders it.
 *
 * @param {Array<string>} flatFiles - Array of relative file paths
 * @returns {{ output: string, totalFilesShown: number }}
 */
export function renderTree(flatFiles) {
  const root = { type: 'directory', children: {} };

  // 1. Build the tree structure
  for (const p of flatFiles) {
    const parts = p.split(/[/\\]/).filter(Boolean);
    
    let current = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isFile = i === parts.length - 1;
      
      if (!current.children[part]) {
        current.children[part] = isFile 
          ? { type: 'file', name: part }
          : { type: 'directory', name: part, children: {} };
      }
      current = current.children[part];
    }
  }

  const state = { output: [], filesCount: 0 };
  
  // 2. Traverse and format the tree (depth limit 4)
  function traverse(node, depth) {
    if (depth >= 4) return;
    
    const children = Object.values(node.children || {}).sort((a, b) => {
      // Directories first, then files
      if (a.type !== b.type) {
        return a.type === 'directory' ? -1 : 1;
      }
      // Alphabetical sort
      return a.name.localeCompare(b.name);
    });
    
    for (const child of children) {
      const indent = '  '.repeat(depth);
      if (child.type === 'directory') {
        state.output.push(`${indent}📁 ${child.name}`);
        traverse(child, depth + 1);
      } else {
        state.output.push(`${indent}└── ${child.name}`);
        state.filesCount++;
      }
    }
  }
  
  traverse(root, 0);
  
  return {
    output: state.output.join('\n'),
    totalFilesShown: state.filesCount
  };
}
