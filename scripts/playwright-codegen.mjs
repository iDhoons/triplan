#!/usr/bin/env node

import { spawn } from 'node:child_process';

const args = process.argv.slice(2);
const baseUrl = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3000';
const hasExplicitUrl = args.length > 0 && !args[0].startsWith('-');
const targetUrl = hasExplicitUrl ? args.shift() : baseUrl;

const child = spawn(
  'pnpm',
  ['exec', 'playwright', 'codegen', targetUrl, ...args],
  {
    stdio: 'inherit',
    shell: false,
  },
);

child.on('exit', (code, signal) => {
  if (signal) {
    process.exit(1);
  }
  process.exit(code ?? 1);
});
