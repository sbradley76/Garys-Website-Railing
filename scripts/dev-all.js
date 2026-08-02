import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, '..');
const serverEntry = path.join(projectRoot, 'server', 'index.js');
const viteEntry = path.join(projectRoot, 'node_modules', 'vite', 'bin', 'vite.js');

if (!existsSync(serverEntry)) {
  console.error(`Missing local email server entry: ${serverEntry}`);
  process.exit(1);
}

if (!existsSync(viteEntry)) {
  console.error('Vite is not installed. Run "npm install" and try again.');
  process.exit(1);
}

const childOptions = {
  cwd: projectRoot,
  stdio: 'inherit',
  env: { ...process.env },
  windowsHide: false,
};

// Launch both services through the current Node executable. This avoids
// spawning npm.cmd, which can throw EINVAL on Windows in some directories.
const services = [
  {
    name: 'email server',
    child: spawn(process.execPath, [serverEntry], childOptions),
  },
  {
    name: 'Vite',
    child: spawn(process.execPath, [viteEntry], childOptions),
  },
];

let shuttingDown = false;

function stopAll(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const { child } of services) {
    if (!child.killed && child.exitCode === null) {
      child.kill();
    }
  }

  // Allow the child processes to close their servers before exiting.
  setTimeout(() => process.exit(exitCode), 100).unref();
}

for (const { name, child } of services) {
  child.on('error', (error) => {
    console.error(`Unable to start ${name}:`, error);
    stopAll(1);
  });

  child.on('exit', (code, signal) => {
    if (shuttingDown) return;

    if (signal) {
      console.error(`${name} stopped with signal ${signal}.`);
      stopAll(1);
      return;
    }

    if (code !== 0) {
      console.error(`${name} exited with code ${code}.`);
      stopAll(code ?? 1);
    }
  });
}

process.on('SIGINT', () => stopAll(0));
process.on('SIGTERM', () => stopAll(0));
