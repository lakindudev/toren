import type { ScanResult, CliOptions, ImportantFile, ScriptInfo, HealthObservation } from "./types/index.js";
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
  frameworks:     'No frameworks detected.',
  entryPoints:    'No entry points detected.',
  configs:        'No configuration files detected.',
  scripts:        'No package scripts detected.',
  importantFiles: 'No important files detected.',
  health:         'No project health observations available.',
  techStack:      'No technologies detected.',
};

export const FOCUSED_FLAGS = [
  '--stack',
  '--tech-stack',
  '--project-type',
  '--frameworks',
  '--entry-points',
  '--structure',
  '--configs',
  '--scripts',
  '--summary',
  '--important-files',
  '--health'
];

/**
 * Validates focused flags in the provided arguments.
 * 
 * @param {string[]} args Process arguments
 * @returns {{ error: boolean, message?: string, mode?: string|null }}
 */
type FocusedModeResult =
  | { error: true; title: string; message: string; detailLabel: string; detailValue: string }
  | { error: false; mode: string | null };

export function getFocusedModeInfo(args: string[]): FocusedModeResult {
  const activeFlags = FOCUSED_FLAGS.filter(flag => args.includes(flag));
  
  // Normalize --tech-stack alias to --stack
  const normalizedFlags = new Set(activeFlags.map(flag => flag === '--tech-stack' ? '--stack' : flag));

  if (normalizedFlags.size > 1) {
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
    mode: normalizedFlags.size > 0 ? Array.from(normalizedFlags)[0] : null
  };
}

/**
 * Print a bold-white section title followed by a dim matched-length divider
 * and a blank line — same visual pattern as console-renderer.js's section().
 *
 * @param {string} title
 */
function printSectionHeader(title: string): void {
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
function section(title: string, items: string[], emptyMsg: string): void {
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
export function renderFocusedMode(mode: string, result: ScanResult): void {
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

      case '--stack': {
    const stack = result.technologyStack;
    const STACK_CATEGORY_ORDER = [
      'language', 'runtime', 'frontend', 'backend', 'styling',
      'database', 'orm', 'testing', 'build', 'quality',
      'container', 'deployment', 'package-manager', 'other',
    ];
    const CATEGORY_LABELS: Record<string, string> = {
      'language':        'Language',
      'runtime':         'Runtime',
      'frontend':        'Frontend',
      'backend':         'Backend',
      'styling':         'Styling',
      'database':        'Database',
      'orm':             'ORM',
      'testing':         'Testing',
      'build':           'Build',
      'quality':         'Quality',
      'container':       'Container',
      'deployment':      'Deployment',
      'package-manager': 'Package Manager',
      'other':           'Other',
    };

    if (!stack || stack.technologies.length === 0) {
      printSectionHeader('Technology Stack');
      console.log(`\x1b[2m${EMPTY.techStack}\x1b[0m`);
      break;
    }

    const grouped = new Map<string, string[]>();
    for (const cat of STACK_CATEGORY_ORDER) {
      const techs = stack.technologies
        .filter(t => t.category === cat)
        .sort((a, b) => {
          const confDiff = b.confidence - a.confidence;
          return confDiff !== 0 ? confDiff : a.name.localeCompare(b.name);
        })
        .map(t => t.name);
      if (techs.length > 0) grouped.set(cat, techs);
    }

    const otherTechs = stack.technologies
      .filter(t => !STACK_CATEGORY_ORDER.includes(t.category))
      .map(t => t.name);
    if (otherTechs.length > 0) grouped.set('other', otherTechs);

    printSectionHeader('Technology Stack');

    for (const [cat, names] of grouped) {
      const label = CATEGORY_LABELS[cat] ?? cat;
      console.log(`\x1b[1m${label}\x1b[0m`);
      for (const name of names) {
        console.log(`  ${name}`);
      }
      console.log('');
    }
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
        for (const s of result.scripts) {
          const usage = s.usage || `npm run ${s.name}`;
          scriptsList.push(`\x1b[97m${usage}\x1b[0m`);
          if (s.description) {
            scriptsList.push(`  \x1b[2m${s.description}\x1b[0m\n`);
          } else {
            scriptsList.push(`  \x1b[2m${s.command}\x1b[0m\n`);
          }
        }
      }
      // Remove trailing newline from last element if it exists
      if (scriptsList.length > 0) {
        scriptsList[scriptsList.length - 1] = scriptsList[scriptsList.length - 1].replace(/\n$/, '');
      }
      section('Package Scripts', scriptsList, EMPTY.scripts);
      break;
    }

    case '--summary': {
      const p = result.projectInfo || {};
      const lines = [
        `Name             ${p.name || 'Unknown'}`,
        `Type             ${result.projectType || 'Unknown'}`,
      ];
      if (p.runtime) lines.push(`Runtime          ${p.runtime}`);
      if (p.language) lines.push(`Language         ${p.language}`);
      if (p.framework) lines.push(`Framework        ${p.framework}`);
      if (p.architecture) lines.push(`Architecture     ${p.architecture}`);
      if (result.packageManager) lines.push(`Package Manager  ${result.packageManager}`);
      if (p.entryPoint) lines.push(`Entry Point      ${p.entryPoint}`);
      if (p.sourceDirectory) lines.push(`Source Directory ${p.sourceDirectory}`);
      
      lines.push(`Files            ${result.flatFiles ? result.flatFiles.length : 0}`);
      lines.push(`Folders          ${result.totalFolders || 0}`);
      
      section('Project Summary', lines, 'No summary available.');
      break;
    }

    case '--important-files': {
      const items: string[] = [];
      if (result.importantFiles && result.importantFiles.length > 0) {
        const top10 = result.importantFiles.slice(0, 10);
        top10.forEach((f: ImportantFile, idx: number) => {
          items.push(`${idx + 1}. \x1b[97m${f.path}\x1b[0m`);
          items.push(`   \x1b[2m${f.reason}\x1b[0m\n`);
        });
        // Remove trailing newline
        if (items.length > 0) {
          items[items.length - 1] = items[items.length - 1].replace(/\n$/, '');
        }
      }
      section('Important Files', items, EMPTY.importantFiles);
      break;
    }

    case '--health': {
      const items: string[] = [];
      if (result.health && result.health.length > 0) {
        for (const h of result.health) {
          let icon = 'ℹ';
          if (h.status === 'pass') icon = '✓';
          else if (h.status === 'warning') icon = '⚠';
          
          let color = '\x1b[97m';
          if (h.status === 'pass') color = '\x1b[32m';
          else if (h.status === 'warning') color = '\x1b[33m';
          
          items.push(`${color}${icon}\x1b[0m ${h.message}`);
        }
      }
      section('Project Health', items, EMPTY.health);
      break;
    }
  }
}
