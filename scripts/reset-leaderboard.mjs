import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

await loadEnvFiles([".env.local", ".env"]);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

let result;

try {
  result = await supabase
    .from("prediction_brackets")
    .delete({ count: "exact" })
    .not("id", "is", null);
} catch (error) {
  console.error(error instanceof Error ? error.message : "Failed to reset leaderboard.");
  process.exit(1);
}

const { count, error } = result;

if (error) {
  console.error(error.message);
  process.exit(1);
}

console.log(`Reset leaderboard: deleted ${count ?? 0} prediction bracket(s).`);

async function loadEnvFiles(paths) {
  for (const path of paths) {
    const absolutePath = resolve(path);
    if (!existsSync(absolutePath)) continue;

    const contents = await readFile(absolutePath, "utf8");
    for (const line of contents.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex === -1) continue;

      const key = trimmed.slice(0, separatorIndex).trim();
      const value = trimmed.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, "");

      if (key && process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  }
}
