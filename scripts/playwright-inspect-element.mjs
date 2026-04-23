#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { basename, join, resolve } from 'node:path';
import { chromium, firefox, webkit } from '@playwright/test';

const args = process.argv.slice(2);
const defaultWebServerCommand =
  'NODE_OPTIONS=--max-old-space-size=4096 pnpm exec next dev --webpack';
let parsedArgs;

try {
  parsedArgs = parseArgs(args);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  console.error('Run `pnpm pwi --help` for usage.');
  process.exit(1);
}

if (parsedArgs.help) {
  console.log(`Usage: pnpm playwright:inspect [port|url] [options]

Start the local app when needed, open a browser, then Option/Alt-click an element
to print locator and style info.

Options:
  --browser <name>   Browser engine: chromium, firefox, or webkit. Default: chromium.
  --bundled          Use Playwright's bundled Chromium instead of Chrome channel.
  --channel <name>   Chromium channel. Default: chrome.
  --profiles         Show saved pwi profiles and last opened origins.
  --no-server       Do not auto-start a local dev server.
  --profile <name>   Persistent login profile name. Default: current folder name.
  --timeout <ms>    How long to wait for an auto-started server. Default: 120000.

Examples:
  pnpm pwi
  pnpm pwi 5173
  pnpm pwi --bundled
  pnpm pwi --profiles
  pnpm pwi --profile google-login
  pnpm pwi localhost:5173
  pnpm pwi http://localhost:5173 --no-server
  PLAYWRIGHT_INSPECT_PORT=5173 pnpm playwright:inspect
`);
  process.exit(0);
}

try {
  validateOptions(parsedArgs);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  console.error('Run `pnpm pwi --help` for usage.');
  process.exit(1);
}

if (parsedArgs.showProfiles) {
  await printProfilesDashboard();
  process.exit(0);
}

const explicitTarget = parsedArgs.target;
const explicitUrl = normalizeTargetUrl(explicitTarget);
let targetUrl = explicitUrl || getConfiguredBaseUrl();
let targetPort = getLocalPort(targetUrl);

let webServer = null;
let browserContext = null;

process.once('SIGINT', () => shutdown(130));
process.once('SIGTERM', () => shutdown(143));

if (!targetUrl && parsedArgs.noServer) {
  console.error('Pass a port or URL when using --no-server.');
  console.error('Example: pnpm pwi 5173 --no-server');
  process.exit(1);
}

if (!targetUrl) {
  targetPort = await findAvailablePort();
  targetUrl = `http://localhost:${targetPort}`;
}

let reachable = await checkReachable(targetUrl);
if (!reachable.ok) {
  if (!parsedArgs.noServer && canAutoStartServer(targetUrl)) {
    if (!targetPort && !explicitUrl) {
      targetPort = await findAvailablePort();
      targetUrl = `http://localhost:${targetPort}`;
    }

    webServer = startWebServer(targetUrl);
    reachable = await waitForReachable(targetUrl, parsedArgs.timeoutMs, webServer);
  }

  if (!reachable.ok) {
    await cleanup();
    printNavigationError(reachable.error, targetUrl);
    process.exit(1);
  }
}

await warnOnOriginChange(parsedArgs, targetUrl);

try {
  browserContext = await launchBrowserContext(parsedArgs);
} catch (error) {
  await cleanup();
  printBrowserLaunchError(error);
  process.exit(1);
}

const page = await browserContext.newPage();

try {
  await preparePage(page, targetUrl);
} catch (error) {
  await cleanup();
  printNavigationError(error, targetUrl);
  process.exit(1);
}

console.log(`\nInspecting ${targetUrl}`);
console.log('Option/Alt-click an element in the browser to print its locator.');
console.log('Close the inspect tab or browser window to stop.\n');

const stopReason = await waitForInspectorStop(browserContext, page);
console.log(`[pwi] ${stopReason}`);
await cleanup();

function waitForInspectorStop(targetContext, targetPage) {
  return new Promise((resolve) => {
    let settled = false;

    const finish = (reason) => {
      if (settled) {
        return;
      }

      settled = true;
      resolve(reason);
    };

    targetContext.once('close', () => finish('browser context closed'));
    targetPage.once('close', () => finish('inspect page closed'));
    targetPage.once('crash', () => finish('inspect page crashed'));
  });
}

async function preparePage(targetPage, targetUrl) {
  await targetPage.exposeFunction('triplanReportInspectedElement', reportElement);

  targetPage.on('framenavigated', async (frame) => {
    if (frame === targetPage.mainFrame()) {
      await installInspector(targetPage).catch(() => {});
    }
  });

  await targetPage.goto(targetUrl);
  await installInspector(targetPage);
}

async function installInspector(targetPage) {
  await targetPage.evaluate(() => {
    if (window.__triplanElementInspectorInstalled) {
      return;
    }

    window.__triplanElementInspectorInstalled = true;

    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.zIndex = '2147483647';
    overlay.style.pointerEvents = 'none';
    overlay.style.border = '2px solid #2563eb';
    overlay.style.background = 'rgba(37, 99, 235, 0.08)';
    overlay.style.borderRadius = '4px';
    overlay.style.display = 'none';
    document.documentElement.appendChild(overlay);

    document.addEventListener(
      'mouseover',
      (event) => {
        const element = event.target;
        if (!(element instanceof Element) || element === overlay) {
          return;
        }

        const rect = element.getBoundingClientRect();
        overlay.style.display = 'block';
        overlay.style.left = `${rect.left}px`;
        overlay.style.top = `${rect.top}px`;
        overlay.style.width = `${rect.width}px`;
        overlay.style.height = `${rect.height}px`;
      },
      true,
    );

    document.addEventListener(
      'click',
      (event) => {
        if (!event.altKey) {
          return;
        }

        const element = event.target;
        if (!(element instanceof HTMLElement)) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        window.triplanReportInspectedElement(collectElementInfo(element));
      },
      true,
    );

    function collectElementInfo(element) {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      const role = getRole(element);
      const name = getAccessibleName(element);
      const testId =
        element.getAttribute('data-testid') ??
        element.getAttribute('data-test-id');
      const id = element.id || null;
      const text = normalizeText(element.innerText || element.textContent || '');
      const cssPath = getCssPath(element);
      const locator = getLocator({ element, role, name, testId, text, cssPath });

      return {
        url: window.location.href,
        tag: element.tagName.toLowerCase(),
        locator,
        locatorOptions: getLocatorOptions({ role, name, testId, text, id, cssPath }),
        attributes: {
          id,
          role: element.getAttribute('role'),
          ariaLabel: element.getAttribute('aria-label'),
          testId,
          class: element.getAttribute('class'),
        },
        text,
        box: {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        },
        styles: {
          display: style.display,
          fontSize: style.fontSize,
          fontWeight: style.fontWeight,
          lineHeight: style.lineHeight,
          padding: style.padding,
          margin: style.margin,
          borderRadius: style.borderRadius,
        },
      };
    }

    function getLocator({ element, role, name, testId, text, cssPath }) {
      if (testId) {
        return `page.getByTestId(${quote(testId)})`;
      }

      if (role && name) {
        return `page.getByRole(${quote(role)}, { name: ${quote(name)} })`;
      }

      if (element.matches('input, textarea, select')) {
        const label = getFormLabel(element);
        if (label) {
          return `page.getByLabel(${quote(label)})`;
        }
      }

      if (text) {
        return `page.getByText(${quote(text.length > 80 ? `${text.slice(0, 77)}...` : text)})`;
      }

      return `page.locator(${quote(cssPath)})`;
    }

    function getLocatorOptions({ role, name, testId, text, id, cssPath }) {
      return [
        testId ? `page.getByTestId(${quote(testId)})` : null,
        role && name ? `page.getByRole(${quote(role)}, { name: ${quote(name)} })` : null,
        text ? `page.getByText(${quote(text.length > 80 ? `${text.slice(0, 77)}...` : text)})` : null,
        id ? `page.locator(${quote(`#${CSS.escape(id)}`)})` : null,
        `page.locator(${quote(cssPath)})`,
      ].filter(Boolean);
    }

    function getRole(element) {
      const explicitRole = element.getAttribute('role');
      if (explicitRole) {
        return explicitRole;
      }

      const tag = element.tagName.toLowerCase();
      const type = element.getAttribute('type')?.toLowerCase();

      if (tag === 'button') return 'button';
      if (tag === 'a' && element.hasAttribute('href')) return 'link';
      if (tag === 'textarea') return 'textbox';
      if (tag === 'select') return 'combobox';
      if (tag === 'input' && ['button', 'submit', 'reset'].includes(type || '')) return 'button';
      if (tag === 'input' && ['checkbox'].includes(type || '')) return 'checkbox';
      if (tag === 'input' && ['radio'].includes(type || '')) return 'radio';
      if (tag === 'input') return 'textbox';
      if (/^h[1-6]$/.test(tag)) return 'heading';

      return null;
    }

    function getAccessibleName(element) {
      return firstNonEmpty([
        element.getAttribute('aria-label'),
        getAriaLabelledByText(element),
        element.getAttribute('alt'),
        element.getAttribute('title'),
        element.getAttribute('value'),
        getFormLabel(element),
        element.innerText,
        element.textContent,
      ]);
    }

    function getAriaLabelledByText(element) {
      const labelledBy = element.getAttribute('aria-labelledby');
      if (!labelledBy) {
        return null;
      }

      return labelledBy
        .split(/\s+/)
        .map((id) => document.getElementById(id)?.innerText)
        .filter(Boolean)
        .join(' ');
    }

    function getFormLabel(element) {
      if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement)) {
        return null;
      }

      if (element.labels?.length) {
        return Array.from(element.labels)
          .map((label) => label.innerText)
          .filter(Boolean)
          .join(' ');
      }

      return null;
    }

    function getCssPath(element) {
      const parts = [];
      let current = element;

      while (current && current.nodeType === Node.ELEMENT_NODE && current !== document.body) {
        const testId = current.getAttribute('data-testid') ?? current.getAttribute('data-test-id');
        if (testId) {
          parts.unshift(`[data-testid="${cssAttributeEscape(testId)}"]`);
          break;
        }

        if (current.id) {
          parts.unshift(`#${CSS.escape(current.id)}`);
          break;
        }

        const tag = current.tagName.toLowerCase();
        const sameTagSiblings = Array.from(current.parentElement?.children || []).filter(
          (sibling) => sibling.tagName === current.tagName,
        );
        const index = sameTagSiblings.indexOf(current) + 1;
        parts.unshift(sameTagSiblings.length > 1 ? `${tag}:nth-of-type(${index})` : tag);
        current = current.parentElement;
      }

      return parts.join(' > ');
    }

    function firstNonEmpty(values) {
      for (const value of values) {
        const normalized = normalizeText(value || '');
        if (normalized) {
          return normalized;
        }
      }
      return null;
    }

    function normalizeText(value) {
      return value.replace(/\s+/g, ' ').trim();
    }

    function quote(value) {
      return JSON.stringify(value);
    }

    function cssAttributeEscape(value) {
      return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    }
  });
}

function reportElement(info) {
  const prompt = [
    '대상 요소:',
    `- url: ${info.url}`,
    `- locator: ${info.locator}`,
    `- size: ${info.box.width}x${info.box.height}`,
    `- styles: font-size ${info.styles.fontSize}, padding ${info.styles.padding}, radius ${info.styles.borderRadius}`,
    '',
    '요청:',
    '- 이 요소를 어떻게 바꿀지 적기',
  ].join('\n');

  console.log('\n=== Inspected Element ===');
  console.log(`Locator: ${info.locator}`);
  console.log(`Tag: ${info.tag}`);
  console.log(`Text: ${info.text || '(none)'}`);
  console.log(`Box: ${info.box.width}x${info.box.height} at ${info.box.x},${info.box.y}`);
  console.log(`Styles: font-size ${info.styles.fontSize}, padding ${info.styles.padding}, margin ${info.styles.margin}`);
  console.log('Attributes:', JSON.stringify(info.attributes, null, 2));
  console.log('\nLocator options:');
  for (const option of info.locatorOptions) {
    console.log(`- ${option}`);
  }
  console.log('\nPrompt snippet:');
  console.log(prompt);
  console.log('=========================\n');
}

function printNavigationError(error, targetUrl) {
  const message = error instanceof Error ? error.message : String(error ?? '');
  const cause = error instanceof Error && error.cause instanceof Error
    ? error.cause.message
    : '';
  const isConnectionRefused =
    message.includes('ERR_CONNECTION_REFUSED') ||
    message.includes('fetch failed') ||
    cause.includes('ECONNREFUSED');

  console.error(`\nCould not open ${targetUrl}`);

  if (isConnectionRefused) {
    console.error('No dev server is listening at that address.');
    console.error('\nRun with auto-start enabled, or point at a running server:');
    console.error('  pnpm pwi');
    console.error('  pnpm pwi <port>');
    console.error('  pnpm pwi http://localhost:<port> --no-server');
    return;
  }

  console.error(message);
}

function parseArgs(rawArgs) {
  const options = {
    browserName: process.env.PLAYWRIGHT_INSPECT_BROWSER ?? 'chromium',
    channel: process.env.PLAYWRIGHT_INSPECT_CHANNEL ?? null,
    useBundledChromium: false,
    help: false,
    noServer: false,
    profile: process.env.PLAYWRIGHT_INSPECT_PROFILE ?? getDefaultProfileName(),
    showProfiles: false,
    target: null,
    timeoutMs: Number(process.env.PLAYWRIGHT_INSPECT_TIMEOUT_MS ?? 120_000),
  };

  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];

    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }

    if (arg === '--no-server') {
      options.noServer = true;
      continue;
    }

    if (arg === '--profiles' || arg === '--dashboard' || arg === '--list') {
      options.showProfiles = true;
      continue;
    }

    if (arg === '--bundled') {
      options.channel = null;
      options.useBundledChromium = true;
      continue;
    }

    if (arg === '--browser') {
      const value = rawArgs[index + 1];
      if (!value) {
        throw new Error('--browser requires chromium, firefox, or webkit');
      }
      options.browserName = value;
      index += 1;
      continue;
    }

    if (arg.startsWith('--browser=')) {
      options.browserName = arg.slice('--browser='.length);
      continue;
    }

    if (arg === '--channel') {
      const value = rawArgs[index + 1];
      if (!value) {
        throw new Error('--channel requires a browser channel name');
      }
      options.channel = value;
      index += 1;
      continue;
    }

    if (arg.startsWith('--channel=')) {
      options.channel = arg.slice('--channel='.length);
      continue;
    }

    if (arg === '--profile') {
      const value = rawArgs[index + 1];
      if (!value) {
        throw new Error('--profile requires a profile name or path');
      }
      options.profile = value;
      index += 1;
      continue;
    }

    if (arg.startsWith('--profile=')) {
      options.profile = arg.slice('--profile='.length);
      continue;
    }

    if (arg === '--fresh') {
      // Kept as a harmless alias for older usage. Fresh is now the default.
      continue;
    }

    if (arg === '--timeout') {
      const value = rawArgs[index + 1];
      if (!value || Number.isNaN(Number(value))) {
        throw new Error('--timeout requires a millisecond value');
      }
      options.timeoutMs = Number(value);
      index += 1;
      continue;
    }

    if (arg.startsWith('--timeout=')) {
      const value = arg.slice('--timeout='.length);
      if (Number.isNaN(Number(value))) {
        throw new Error('--timeout requires a millisecond value');
      }
      options.timeoutMs = Number(value);
      continue;
    }

    if (!arg.startsWith('-') && !options.target) {
      options.target = arg;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (options.browserName === 'chromium' && !options.channel && !options.useBundledChromium) {
    options.channel = 'chrome';
  }

  return options;
}

function validateOptions(options) {
  if (!['chromium', 'firefox', 'webkit'].includes(options.browserName)) {
    throw new Error('--browser requires chromium, firefox, or webkit');
  }

  if (options.channel && options.browserName !== 'chromium') {
    throw new Error('--channel is only supported with chromium');
  }

  if (options.useBundledChromium && options.browserName !== 'chromium') {
    throw new Error('--bundled is only supported with chromium');
  }

  if (!Number.isFinite(options.timeoutMs) || options.timeoutMs <= 0) {
    throw new Error('--timeout requires a positive millisecond value');
  }
}

async function launchBrowserContext(options) {
  const browserType = getBrowserType(options.browserName);
  const userDataDir = getProfileDir(options.profile);
  const launchOptions = {
    headless: false,
  };

  if (options.channel) {
    if (options.browserName !== 'chromium') {
      throw new Error('--channel is only supported with chromium');
    }
    launchOptions.channel = options.channel;
  }

  return browserType.launchPersistentContext(userDataDir, launchOptions);
}

async function warnOnOriginChange(options, targetUrl) {
  const profileDir = getProfileDir(options.profile);
  const metaPath = join(profileDir, '.pwi-profile.json');
  const currentOrigin = getOrigin(targetUrl);

  if (!currentOrigin) {
    return;
  }

  let previous = null;
  try {
    previous = JSON.parse(await readFile(metaPath, 'utf8'));
  } catch {
    previous = null;
  }

  if (previous?.origin && previous.origin !== currentOrigin) {
    console.warn(
      `\nProfile "${options.profile}" was last used at ${previous.origin}, now opening ${currentOrigin}.`,
    );
    console.warn(
      'Cookies may survive across localhost ports, but localStorage/sessionStorage are origin-specific.',
    );
    console.warn('Use a fixed port if login state must be predictable.\n');
  }

  await mkdir(profileDir, { recursive: true });
  await writeFile(
    metaPath,
    JSON.stringify(
      {
        browser: options.browserName,
        channel: options.channel ?? 'bundled',
        origin: currentOrigin,
        profile: options.profile,
        worktree: process.cwd(),
        updatedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
}

async function printProfilesDashboard() {
  const profilesRoot = resolve('.playwright-pwi');
  let entries = [];

  try {
    entries = await readdir(profilesRoot, { withFileTypes: true });
  } catch {
    console.log('No pwi profiles found for this worktree.');
    console.log(`Expected directory: ${profilesRoot}`);
    return;
  }

  const rows = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const profileName = entry.name;
    const metaPath = join(profilesRoot, profileName, '.pwi-profile.json');
    let meta = null;

    try {
      meta = JSON.parse(await readFile(metaPath, 'utf8'));
    } catch {
      meta = null;
    }

    const origin = meta?.origin ?? '(unknown)';
    const reachable =
      meta?.origin && (await checkReachable(meta.origin)).ok ? 'up' : 'down';

    rows.push({
      profile: profileName,
      origin,
      status: meta?.origin ? reachable : 'unknown',
      browser: meta?.browser ?? '(unknown)',
      channel: meta?.channel ?? '(unknown)',
      updatedAt: meta?.updatedAt ?? '(unknown)',
    });
  }

  if (!rows.length) {
    console.log('No pwi profiles found for this worktree.');
    return;
  }

  const defaultProfile = sanitizeProfileName(getDefaultProfileName());
  console.log(`pwi profiles for ${process.cwd()}`);
  console.log(`Default profile label: ${defaultProfile}\n`);
  printTable(rows, [
    ['profile', 'Profile'],
    ['origin', 'Last origin'],
    ['status', 'Now'],
    ['browser', 'Browser'],
    ['channel', 'Channel'],
    ['updatedAt', 'Updated'],
  ]);
}

function printTable(rows, columns) {
  const widths = columns.map(([key, label]) =>
    Math.max(
      label.length,
      ...rows.map((row) => String(row[key] ?? '').length),
    ),
  );

  console.log(
    columns
      .map(([, label], index) => label.padEnd(widths[index]))
      .join('  '),
  );
  console.log(widths.map((width) => '-'.repeat(width)).join('  '));

  for (const row of rows) {
    console.log(
      columns
        .map(([key], index) => String(row[key] ?? '').padEnd(widths[index]))
        .join('  '),
    );
  }
}

function getBrowserType(browserName) {
  if (browserName === 'chromium') return chromium;
  if (browserName === 'firefox') return firefox;
  if (browserName === 'webkit') return webkit;
  throw new Error('--browser requires chromium, firefox, or webkit');
}

function getProfileDir(profile) {
  if (profile.includes('/') || profile.startsWith('.') || profile.startsWith('~')) {
    return resolve(profile.replace(/^~(?=$|\/)/, process.env.HOME ?? '~'));
  }

  return resolve('.playwright-pwi', sanitizeProfileName(profile));
}

function getOrigin(targetUrl) {
  try {
    return new URL(targetUrl).origin;
  } catch {
    return null;
  }
}

function sanitizeProfileName(profile) {
  return profile.replace(/[^a-zA-Z0-9._-]/g, '-');
}

function getDefaultProfileName() {
  return basename(process.cwd()) || 'default';
}

function getConfiguredBaseUrl() {
  if (process.env.PLAYWRIGHT_INSPECT_URL) {
    return process.env.PLAYWRIGHT_INSPECT_URL;
  }

  if (process.env.PLAYWRIGHT_TEST_BASE_URL) {
    return process.env.PLAYWRIGHT_TEST_BASE_URL;
  }

  const configuredPort =
    process.env.PLAYWRIGHT_INSPECT_PORT ||
    process.env.PORT;

  return configuredPort ? `http://localhost:${configuredPort}` : null;
}

function normalizeTargetUrl(target) {
  if (!target) {
    return null;
  }

  if (/^\d+$/.test(target)) {
    return `http://localhost:${target}`;
  }

  if (/^https?:\/\//.test(target)) {
    return target;
  }

  return `http://${target}`;
}

async function checkReachable(targetUrl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);

  try {
    await fetch(targetUrl, {
      method: 'GET',
      signal: controller.signal,
      redirect: 'manual',
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, error };
  } finally {
    clearTimeout(timeout);
  }
}

async function waitForReachable(targetUrl, timeoutMs, webServerProcess) {
  const startedAt = Date.now();
  let lastError = null;
  let earlyExit = null;

  if (webServerProcess) {
    webServerProcess.once('exit', (code, signal) => {
      earlyExit = new Error(
        `Dev server exited before becoming ready (code ${code ?? 'null'}, signal ${signal ?? 'null'})`,
      );
    });
  }

  while (Date.now() - startedAt < timeoutMs) {
    if (earlyExit) {
      return { ok: false, error: earlyExit };
    }

    const result = await checkReachable(targetUrl);
    if (result.ok) {
      return result;
    }

    lastError = result.error;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  return { ok: false, error: lastError ?? new Error('Timed out waiting for dev server') };
}

function canAutoStartServer(targetUrl) {
  try {
    const url = new URL(targetUrl);
    return ['localhost', '127.0.0.1'].includes(url.hostname);
  } catch {
    return false;
  }
}

function startWebServer(targetUrl) {
  const webServerCommand =
    process.env.PLAYWRIGHT_WEB_SERVER_COMMAND || getWebServerCommand(targetUrl);

  console.log(`\nNo server found at ${targetUrl}. Starting dev server...`);
  console.log(`  ${webServerCommand}\n`);

  const child = spawn(webServerCommand, {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NEXT_PUBLIC_DEV_LOGIN_EMAIL:
        process.env.PLAYWRIGHT_DEV_LOGIN_EMAIL ??
        process.env.E2E_AUTH_EMAIL ??
        'test-alice@triplan.test',
      NEXT_PUBLIC_DEV_LOGIN_PASSWORD:
        process.env.PLAYWRIGHT_DEV_LOGIN_PASSWORD ??
        process.env.E2E_AUTH_PASSWORD ??
        'TestPassword123!@#',
    },
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout.on('data', (chunk) => {
    process.stdout.write(`[dev] ${chunk}`);
  });
  child.stderr.on('data', (chunk) => {
    process.stderr.write(`[dev] ${chunk}`);
  });

  return child;
}

function getWebServerCommand(targetUrl) {
  const port = getLocalPort(targetUrl);
  if (!port) {
    return defaultWebServerCommand;
  }

  return `${defaultWebServerCommand} -p ${port}`;
}

function getLocalPort(targetUrl) {
  try {
    const url = new URL(targetUrl);
    return url.port || null;
  } catch {
    return null;
  }
}

async function findAvailablePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();

    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() => {
        if (address && typeof address === 'object') {
          resolve(address.port);
          return;
        }

        reject(new Error('Could not find an available port'));
      });
    });
  });
}

async function stopWebServer(webServerProcess) {
  if (!webServerProcess || webServerProcess.killed) {
    return;
  }

  webServerProcess.kill('SIGTERM');

  await new Promise((resolve) => {
    const timeout = setTimeout(resolve, 3000);
    webServerProcess.once('exit', () => {
      clearTimeout(timeout);
      resolve();
    });
  });
}

async function cleanup() {
  await browserContext?.close().catch(() => {});
  browserContext = null;
  await stopWebServer(webServer);
  webServer = null;
}

async function shutdown(exitCode) {
  await cleanup();
  process.exit(exitCode);
}

function printBrowserLaunchError(error) {
  const message = error instanceof Error ? error.message : String(error);

  console.error('\nCould not launch the Playwright browser.');
  console.error('If this is running inside a restricted terminal, run it from your normal local shell.');
  console.error(message);
}
