import { render as renderMarkdown } from '../dist/renderers/markdown-renderer.js';
import { render as renderConsole } from '../dist/renderers/console-renderer.js';

const flatFiles = [];
for (let i = 0; i < 50000; i++) {
  flatFiles.push(`src/components/button${i}/index.js`);
  flatFiles.push(`src/components/button${i}/style.css`);
}

const fakeResult = {
  rootPath: '/fake',
  projectType: 'Unknown',
  entryPoints: [],
  configs: [],
  scripts: [],
  tree: { type: 'directory', name: 'fake', children: [] },
  flatFiles,
  totalFolders: 100000,
  scanDurationMs: 100
};

console.time('markdown');
renderMarkdown(fakeResult);
console.timeEnd('markdown');

console.time('console');
renderConsole(fakeResult);
console.timeEnd('console');
