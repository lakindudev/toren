import { render as renderConsole } from './console-renderer.js';
import { render as renderJson } from './json-renderer.js';
import { render as renderMarkdown } from './markdown-renderer.js';
import { render as renderHtml } from './html-renderer.js';
import type { ScanResult, OutputFormat } from '../types/index.js';

export type Renderer = (result: ScanResult, options?: { cwd?: string }) => void;

const renderers: Record<OutputFormat, Renderer> = {
  console: renderConsole,
  json: renderJson,
  markdown: renderMarkdown,
  html: renderHtml,
};

export default renderers;
