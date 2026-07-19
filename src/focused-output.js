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

function section(title, items, emptyMsg) {
  console.log(`\x1b[1m\x1b[97m${title}\x1b[0m`);
  console.log(`\x1b[2m${'─'.repeat(title.length)}\x1b[0m\n`);
  
  if (!items || items.length === 0) {
    console.log(`\x1b[2m${emptyMsg}\x1b[0m`);
  } else {
    items.forEach(item => console.log(item));
  }
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
      section('Project Type', [result.projectType], 'Unknown');
      break;
      
    case '--frameworks':
      const frameworks = (!result.projectType || result.projectType === 'Unknown') ? [] : [result.projectType];
      section('Frameworks', frameworks, 'None detected');
      break;
      
    case '--entry-points':
      section('Entry Points', result.entryPoints || [], 'No entry points detected');
      break;
      
    case '--structure':
      renderStructure(result);
      break;
      
    case '--configs':
      section('Configuration Files', result.configs || [], 'No configuration files detected');
      break;

    case '--scripts':
      const scriptsList = [];
      if (result.scripts && result.scripts.length > 0) {
        const maxNameLen = Math.max(...result.scripts.map(s => s.name.length));
        result.scripts.forEach(s => {
          const paddedName = s.name.padEnd(maxNameLen, ' ');
          scriptsList.push(`${paddedName}  \x1b[2m${s.command}\x1b[0m`);
        });
      }
      section('Package Scripts', scriptsList, 'No package scripts detected');
      break;
  }
}
