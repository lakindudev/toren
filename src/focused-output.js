/**
 * @fileoverview Focused output modes handling for Toren CLI.
 */

import { renderStructure } from './renderers/console-renderer.js';

export const FOCUSED_FLAGS = [
  '--project-type',
  '--frameworks',
  '--entry-points',
  '--structure',
  '--configs',
  '--scripts'
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
      title: 'Conflicting options',
      message: 'Focused output flags are mutually exclusive.',
      detailLabel: 'Provided flags',
      detailValue: activeFlags.join(', ')
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
      
    case '--configs':
      console.log('Configuration Files');
      console.log('───────────────────\n');
      if (!result.configs || result.configs.length === 0) {
        console.log('No configuration files detected.');
      } else {
        result.configs.forEach(c => console.log(`✓ ${c}`));
      }
      break;

    case '--scripts':
      console.log('Available Scripts\n');
      if (!result.scripts || result.scripts.length === 0) {
        console.log('No scripts found');
      } else {
        const maxNameLen = Math.max(...result.scripts.map(s => s.name.length));
        result.scripts.forEach(s => {
          const paddedName = s.name.padEnd(maxNameLen + 6, ' ');
          console.log(`${paddedName}${s.command}`);
        });
      }
      break;
  }
}
