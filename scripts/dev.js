// Starts the API server and the Vite dev server together; Ctrl+C stops both.
import { spawn } from 'node:child_process';

const procs = [
  spawn(process.execPath, ['--watch', 'server/index.js'], { stdio: 'inherit' }),
  spawn(process.execPath, ['node_modules/vite/bin/vite.js'], { stdio: 'inherit' }),
];

const stopAll = () => procs.forEach((p) => p.exitCode === null && p.kill());
procs.forEach((p) => p.on('exit', stopAll));
process.on('SIGINT', stopAll);
process.on('SIGTERM', stopAll);
