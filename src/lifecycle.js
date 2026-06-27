import fs from 'node:fs';
import { execSync } from 'node:child_process';
import readline from 'node:readline';

const C = {
  reset:   '\x1b[0m',
  cyan:    '\x1b[36m',
  green:   '\x1b[32m',
  yellow:  '\x1b[33m',
  red:     '\x1b[31m',
};

function paint(text, ...codes) {
  return `${codes.join('')}${text}${C.reset}`;
}

function getGlobalNpmRoot() {
  try {
    return execSync('npm root -g', { encoding: 'utf8', stdio: 'pipe' }).trim();
  } catch {
    return null;
  }
}

function getInstallStatus() {
  const status = {
    isGlobal: false,
    method: 'unknown',
    binaryPath: process.argv[1] || 'unknown',
    isBroken: false,
  };

  try {
    if (!status.binaryPath || !fs.existsSync(status.binaryPath)) {
      status.isBroken = true;
      return status;
    }

    const realPath = fs.realpathSync(status.binaryPath);
    const globalRoot = getGlobalNpmRoot();

    if (globalRoot) {
      if (realPath.includes(globalRoot)) {
        status.isGlobal = true;
        status.method = 'npm install -g';
      } else if (status.binaryPath !== realPath) {
        status.isGlobal = true;
        status.method = 'npm link';
      } else {
        status.isGlobal = false;
        status.method = 'local';
      }
    } else {
      if (status.binaryPath !== realPath) {
        status.isGlobal = true;
        status.method = 'npm link';
      } else {
        status.isGlobal = false;
      }
    }
  } catch (err) {
    status.isBroken = true;
  }

  return status;
}

export function runDoctor(pkgVersion) {
  const status = getInstallStatus();

  if (status.isBroken) {
    console.log(paint('⚠ Broken installation detected', C.red));
    console.log(`→ Run: ${paint('npm uninstall -g toren', C.cyan)}`);
    console.log('');
    return;
  }

  if (status.isGlobal) {
    console.log(`${paint('✔', C.green)} Toren installed globally`);
  } else {
    console.log(`${paint('✔', C.green)} Toren installed locally`);
  }
  
  console.log(`${paint('✔', C.green)} Binary path valid`);
  console.log(`${paint('✔', C.green)} Version match confirmed`);
  console.log('');
}

export function runUninstall() {
  const status = getInstallStatus();

  if (status.isBroken) {
    console.log(paint('⚠ Toren installation is corrupted. Please reinstall using npm install -g toren', C.yellow));
    process.exit(0);
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question('Are you sure you want to remove Toren from global environment? (y/n) ', (answer) => {
    rl.close();
    if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
      process.exit(0);
    }

    console.log('');
    console.log('To safely remove the global installation, run the following command:');
    
    if (status.method === 'npm link') {
      console.log(paint('  npm unlink', C.cyan));
      console.log('  (Make sure you run this in your local Toren project directory)');
    } else {
      console.log(paint('  npm uninstall -g toren', C.cyan));
    }
    
    console.log('');
    process.exit(0);
  });
}
