/**
 * @fileoverview Toren — Focused Output Mode Handler
 *
 * Handles the six focused output flags:
 *   --project-type  --frameworks  --entry-points
 *   --structure     --configs     --scripts
 *
 * Design contract:
 *  - Each flag renders exactly one section to stdout using the console visual
 *    style (ANSI colours, section header + divider).
 *  - Empty-state messages are canonical strings declared in EMPTY below.
 *    They must end with a period and stay in sync with console-renderer.js.
 *  - No business logic. All data comes from the ScanResult passed in.
 *  - Stateless: renderFocusedMode() may be called multiple times safely.
 */

import { renderStructure } from './renderers/console-renderer.js';

// ---------------------------------------------------------------------------
// Canonical empty-state messages
// Keep these in sync with the equivalent strings in console-renderer.js.
// ---------------------------------------------------------------------------

const EMPTY = {
  frameworks:  'No frameworks detected.',
  entryPoints: 'No entry points detected.',
  configs:     'No configuration files detected.',
  scripts:     'No package scripts detected.',
};

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
 * Print a bold-white section title followed by a dim matched-length divider
 * and a blank line — same visual pattern as console-renderer.js's section().
 *
 * @param {string} title
 */
function printSectionHeader(title) {
  console.log(`\x1b[1m\x1b[97m${title}\x1b[0m`);
  console.log(`\x1b[2m${'─'.repeat(title.length)}\x1b[0m`);
  console.log('');
}

/**
 * Print a focused section: header, then items or an empty-state message.
 *
 * @param {string}   title    - Section heading
 * @param {string[]} items    - Pre-formatted lines to print
 * @param {string}   emptyMsg - Canonical empty-state message (ends with '.')
 */
function section(title, items, emptyMsg) {
  printSectionHeader(title);

  if (!items || items.length === 0) {
    console.log(`\x1b[2m${emptyMsg}\x1b[0m`);
  } else {
    for (const item of items) {
      console.log(item);
    }
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
    case '--project-type': {
      // projectType is always a string; 'Unknown' when undetected.
      section('Project Type', [result.projectType], 'Unknown');
      break;
    }

    case '--frameworks': {
      const frameworks = (!result.projectType || result.projectType === 'Unknown')
        ? []
        : [result.projectType];
      section('Frameworks', frameworks, EMPTY.frameworks);
      break;
    }

    case '--entry-points': {
      section('Entry Points', result.entryPoints || [], EMPTY.entryPoints);
      break;
    }

    case '--structure': {
      renderStructure(result);
      break;
    }

    case '--configs': {
      section('Configuration Files', result.configs || [], EMPTY.configs);
      break;
    }

    case '--scripts': {
      const scriptsList = [];
      if (result.scripts && result.scripts.length > 0) {
        const maxNameLen = Math.max(...result.scripts.map(s => s.name.length));
        for (const s of result.scripts) {
          const paddedName = s.name.padEnd(maxNameLen, ' ');
          scriptsList.push(`\x1b[97m${paddedName}\x1b[0m  \x1b[2m${s.command}\x1b[0m`);
        }
      }
      section('Package Scripts', scriptsList, EMPTY.scripts);
      break;
    }
  }
}
