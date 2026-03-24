import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnvFile() {
  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) {
    return;
  }

  const content = readFileSync(envPath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const equalsIndex = line.indexOf("=");
    if (equalsIndex <= 0) {
      continue;
    }

    const key = line.slice(0, equalsIndex).trim();
    const value = line.slice(equalsIndex + 1).trim();
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function parseArg(flag) {
  const index = process.argv.indexOf(flag);
  if (index === -1 || index + 1 >= process.argv.length) {
    return undefined;
  }

  return process.argv[index + 1];
}

async function main() {
  loadEnvFile();

  const email = parseArg("--email") ?? process.env.ADMIN_EMAIL;
  const password = parseArg("--password") ?? process.env.ADMIN_PASSWORD;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!email || !password) {
    console.error(
      "Missing credentials. Use --email and --password (or ADMIN_EMAIL/ADMIN_PASSWORD env vars).",
    );
    process.exit(1);
  }

  if (!supabaseUrl || !serviceRoleKey) {
    console.error(
      "Missing Supabase config. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data: authData, error: createError } =
    await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: "admin" },
      app_metadata: { role: "admin" },
    });

  if (createError || !authData.user?.id) {
    console.error(
      `Failed to create auth user: ${createError?.message ?? "Unknown error"}`,
    );
    process.exit(1);
  }

  const userId = authData.user.id;

  const { error: profileError } = await supabase.from("users").upsert(
    {
      id: userId,
      role: "admin",
    },
    {
      onConflict: "id",
    },
  );

  if (profileError) {
    console.error(`Failed to upsert users row: ${profileError.message}`);
    process.exit(1);
  }

  console.log("Admin user created successfully.");
  console.log(`Email: ${email}`);
  console.log(`User ID: ${userId}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error(`Script failed: ${message}`);
  process.exit(1);
});
