/**
 * @fileoverview Focused output modes handling for Toren CLI.
 */

import { renderStructure } from './renderers/console-renderer.js';

export const FOCUSED_FLAGS = [
  '--project-type',
  '--frameworks',
  '--entry-points',
  '--structure'
];

/**
 * Validates focused flags in the provided arguments.
 * 
 * @param {string[]} args Process arguments
 * @returns {{ error: boolean, message?: string, mode?: string|null }}
 */
export function getFocusedModeInfo(args) {
  const activeFlags = FOCUSED_FLAGS.filter(flag => args.includes(flag));
  
  if (activeFlags.length > 1) {
    return {
      error: true,
      message: '\x1b[31mError: focused output flags are mutually exclusive. Please use only one of:\x1b[0m\n' + 
               FOCUSED_FLAGS.map(f => `  ${f}`).join('\n') + '\n'
    };
  }

  return {
    error: false,
    mode: activeFlags[0] || null
  };
}

/**
 * Renders the scan result based on the active focused mode.
 * 
 * @param {string} mode Active focused mode flag
 * @param {import('./scanner/scan.js').ScanResult} result 
 */
export function renderFocusedMode(mode, result) {
  switch (mode) {
    case '--project-type':
      console.log(`Project Type: ${result.projectType}`);
      break;
      
    case '--frameworks':
      if (!result.projectType || result.projectType === 'Unknown') {
        console.log('Frameworks: None detected');
      } else {
        console.log('Frameworks:');
        console.log(`- ${result.projectType}`);
      }
      break;
      
    case '--entry-points':
      if (!result.entryPoints || result.entryPoints.length === 0) {
        console.log('Entry Points: None detected');
      } else {
        console.log('Entry Points:');
        result.entryPoints.forEach(ep => console.log(`- ${ep}`));
      }
      break;
      
    case '--structure':
      renderStructure(result);
      break;
  }
}
