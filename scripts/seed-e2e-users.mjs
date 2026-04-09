#!/usr/bin/env node

/**
 * Seed (or update) E2E fixture users for Supabase Auth.
 *
 * Usage:
 *   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed-e2e-users.mjs
 */

import process from "node:process";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const fixtureUsers = [
  {
    email: "test-alice@triplan.test",
    password: "TestPassword123!@#",
    displayName: "Alice Tester",
  },
  {
    email: "test-bob@triplan.test",
    password: "TestPassword456!@#",
    displayName: "Bob Collaborator",
  },
];

function requireEnv(name, value) {
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

async function listUsersByEmail(supabase) {
  const usersByEmail = new Map();
  const perPage = 200;
  let page = 1;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw new Error(`Failed to list users (page ${page}): ${error.message}`);
    }

    const users = data?.users ?? [];
    for (const user of users) {
      if (!user.email) continue;
      usersByEmail.set(user.email.toLowerCase(), user);
    }

    if (users.length < perPage) break;
    page += 1;
  }

  return usersByEmail;
}

async function createOrUpdateUser(supabase, existingUser, fixture) {
  if (existingUser) {
    const { data, error } = await supabase.auth.admin.updateUserById(existingUser.id, {
      password: fixture.password,
      email_confirm: true,
      user_metadata: { full_name: fixture.displayName },
    });
    if (error) {
      throw new Error(`Failed to update ${fixture.email}: ${error.message}`);
    }
    return { user: data.user, action: "updated" };
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: fixture.email,
    password: fixture.password,
    email_confirm: true,
    user_metadata: { full_name: fixture.displayName },
  });
  if (error) {
    throw new Error(`Failed to create ${fixture.email}: ${error.message}`);
  }
  return { user: data.user, action: "created" };
}

async function upsertProfile(supabase, userId, displayName) {
  const { error } = await supabase
    .from("profiles")
    .upsert({ id: userId, display_name: displayName }, { onConflict: "id" });

  if (error) {
    throw new Error(`Failed to upsert profile for ${userId}: ${error.message}`);
  }
}

async function main() {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL", supabaseUrl);
  const key = requireEnv("SUPABASE_SERVICE_ROLE_KEY", serviceRoleKey);

  const supabase = createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

  const usersByEmail = await listUsersByEmail(supabase);

  let createdCount = 0;
  let updatedCount = 0;
  for (const fixture of fixtureUsers) {
    const existingUser = usersByEmail.get(fixture.email.toLowerCase()) ?? null;
    const { user, action } = await createOrUpdateUser(supabase, existingUser, fixture);
    if (!user?.id) {
      throw new Error(`No user id returned for ${fixture.email}`);
    }

    await upsertProfile(supabase, user.id, fixture.displayName);

    if (action === "created") createdCount += 1;
    if (action === "updated") updatedCount += 1;

    console.log(`[${action}] ${fixture.email} (${fixture.displayName})`);
  }

  console.log(`Done. created=${createdCount}, updated=${updatedCount}`);
}

main().catch((error) => {
  console.error(`E2E fixture seed failed: ${error.message}`);
  process.exit(1);
});
