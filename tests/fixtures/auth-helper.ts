import fs from "node:fs";
import path from "node:path";
import { createBrowserClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { Page } from "@playwright/test";

/**
 * Helper functions for authentication testing.
 */

const DEFAULT_FIXTURE_EMAIL = "test-alice@triplan.test";
const DEFAULT_FIXTURE_PASSWORD = "TestPassword123!@#";
const DEFAULT_FIXTURE_NAME = "Alice Tester";
const DEFAULT_BASE_URL = "http://localhost:3000";

type CookieOptions = {
  expires?: Date;
  httpOnly?: boolean;
  maxAge?: number;
  path?: string;
  sameSite?: "lax" | "none" | "strict";
  secure?: boolean;
};

type StoredCookie = {
  name: string;
  options?: CookieOptions;
  value: string;
};

type TestEnv = {
  anonKey: string;
  baseURL: string;
  serviceRoleKey?: string;
  supabaseUrl: string;
};

let cachedEnvFile: Record<string, string> | null = null;

function readLocalEnvFile() {
  if (cachedEnvFile) {
    return cachedEnvFile;
  }

  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) {
    cachedEnvFile = {};
    return cachedEnvFile;
  }

  const entries: Record<string, string> = {};
  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    const value = rawValue.replace(/^['"]|['"]$/g, "");

    entries[key] = value;
  }

  cachedEnvFile = entries;
  return entries;
}

function getTestEnvValue(name: string) {
  return process.env[name] || readLocalEnvFile()[name] || "";
}

function getTestEnv(): TestEnv {
  const supabaseUrl = getTestEnvValue("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = getTestEnvValue("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  if (!supabaseUrl || !anonKey) {
    throw new Error(
      "Supabase test env가 없습니다. NEXT_PUBLIC_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_ANON_KEY를 설정하거나 .env.local을 준비하세요."
    );
  }

  return {
    supabaseUrl,
    anonKey,
    serviceRoleKey: getTestEnvValue("SUPABASE_SERVICE_ROLE_KEY") || undefined,
    baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL || DEFAULT_BASE_URL,
  };
}

function resolveCredentials(email?: string, password?: string) {
  const resolvedEmail =
    email?.trim() ||
    process.env.E2E_AUTH_EMAIL ||
    process.env.PLAYWRIGHT_DEV_LOGIN_EMAIL ||
    DEFAULT_FIXTURE_EMAIL;
  const resolvedPassword =
    password?.trim() ||
    process.env.E2E_AUTH_PASSWORD ||
    process.env.PLAYWRIGHT_DEV_LOGIN_PASSWORD ||
    DEFAULT_FIXTURE_PASSWORD;

  return { email: resolvedEmail, password: resolvedPassword };
}

function inferDisplayName(email: string) {
  if (email === DEFAULT_FIXTURE_EMAIL) {
    return DEFAULT_FIXTURE_NAME;
  }

  return email.split("@")[0] || "E2E User";
}

async function ensureFixtureUser(
  email: string,
  password: string,
  displayName = inferDisplayName(email)
) {
  const { serviceRoleKey, supabaseUrl } = getTestEnv();
  if (!serviceRoleKey) {
    return false;
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });

  const { data: listedUsers, error: listError } = await adminClient.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });

  if (listError) {
    throw new Error(`Fixture 계정 조회 실패: ${listError.message}`);
  }

  const existingUser =
    listedUsers.users.find(
      (user) => user.email?.toLowerCase() === email.toLowerCase()
    ) ?? null;

  const authResponse = existingUser
    ? await adminClient.auth.admin.updateUserById(existingUser.id, {
        password,
        email_confirm: true,
        user_metadata: { full_name: displayName },
      })
    : await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: displayName },
      });

  if (authResponse.error) {
    throw new Error(`Fixture 계정 준비 실패: ${authResponse.error.message}`);
  }

  const userId = authResponse.data.user?.id;
  if (!userId) {
    throw new Error("Fixture 계정 준비 실패: user id가 없습니다.");
  }

  const { error: profileError } = await adminClient
    .from("profiles")
    .upsert({ id: userId, display_name: displayName }, { onConflict: "id" });

  if (profileError) {
    throw new Error(`Fixture profile 준비 실패: ${profileError.message}`);
  }

  return true;
}

async function createSessionCookies(email: string, password: string) {
  const { anonKey, supabaseUrl } = getTestEnv();
  const cookieJar = new Map<string, StoredCookie>();

  const client = createBrowserClient(supabaseUrl, anonKey, {
    isSingleton: false,
    cookies: {
      getAll() {
        return Array.from(cookieJar.values()).map(({ name, value }) => ({
          name,
          value,
        }));
      },
      setAll(cookies) {
        for (const cookie of cookies) {
          if (cookie.value) {
            cookieJar.set(cookie.name, {
              name: cookie.name,
              value: cookie.value,
              options: cookie.options as CookieOptions | undefined,
            });
            continue;
          }

          cookieJar.delete(cookie.name);
        }
      },
    },
  });

  let signInResult = await client.auth.signInWithPassword({ email, password });

  if (
    signInResult.error?.message === "Invalid login credentials" &&
    (await ensureFixtureUser(email, password))
  ) {
    signInResult = await client.auth.signInWithPassword({ email, password });
  }

  if (signInResult.error || !signInResult.data.session) {
    throw new Error(
      `테스트 세션 생성 실패: ${signInResult.error?.message ?? "session missing"}`
    );
  }

  return Array.from(cookieJar.values());
}

function toPlaywrightSameSite(sameSite?: CookieOptions["sameSite"]) {
  switch (sameSite) {
    case "none":
      return "None" as const;
    case "strict":
      return "Strict" as const;
    default:
      return "Lax" as const;
  }
}

async function applySession(page: Page, email: string, password: string) {
  const { baseURL } = getTestEnv();
  const cookies = await createSessionCookies(email, password);

  await page.context().clearCookies();
  await page.goto("/login");
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  await page.context().addCookies(
    cookies.map(({ name, options, value }) => ({
      name,
      value,
      url: baseURL,
      httpOnly: options?.httpOnly ?? false,
      secure: options?.secure ?? false,
      sameSite: toPlaywrightSameSite(options?.sameSite),
      expires: options?.maxAge
        ? Math.floor(Date.now() / 1000) + options.maxAge
        : options?.expires
          ? Math.floor(options.expires.getTime() / 1000)
          : undefined,
    }))
  );
}

export function canBootstrapSession() {
  try {
    getTestEnv();
    return true;
  } catch {
    return false;
  }
}

export async function signUp(
  page: Page,
  email: string,
  password: string,
  name: string
) {
  const credentials = resolveCredentials(email, password);

  await ensureFixtureUser(credentials.email, credentials.password, name);
  await applySession(page, credentials.email, credentials.password);
  await page.goto("/dashboard");
  await page.waitForURL(/\/(dashboard|trips)/, { timeout: 15000 });
}

export async function signIn(page: Page, email: string, password: string) {
  const credentials = resolveCredentials(email, password);

  await applySession(page, credentials.email, credentials.password);
  try {
    await page.goto("/dashboard");
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("ERR_ABORTED")) {
      throw error;
    }
  }
  await page.waitForURL(/\/(dashboard|trips)/, { timeout: 15000 });
}

export async function signOut(page: Page) {
  await page.locator("button").last().click();
  await page.getByRole("menuitem", { name: "로그아웃" }).click();
  await page.waitForURL(/\/login/, { timeout: 5000 });
}

export async function isAuthenticated(page: Page): Promise<boolean> {
  try {
    await page.goto("/dashboard", { waitUntil: "networkidle" });
    return !page.url().includes("/login") && !page.url().includes("/signup");
  } catch {
    return false;
  }
}

export async function isOnAuthPage(page: Page): Promise<boolean> {
  return page.url().includes("/login") || page.url().includes("/signup");
}
