import type { Config } from "drizzle-kit";
import * as dotenv from "dotenv";

dotenv.config();

// Parse Supabase URL to extract connection details
// Supabase URL format: https://project-ref.supabase.co
// Connection string format: postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres
function getSupabaseConnectionString(): string {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabasePassword = process.env.SUPABASE_DB_PASSWORD;

  if (!supabaseUrl) {
    throw new Error("SUPABASE_URL is not set in .env file");
  }

  // If direct database connection string is provided, use it
  if (process.env.SUPABASE_DB_URL) {
    return process.env.SUPABASE_DB_URL;
  }

  // Extract project reference from Supabase URL
  // https://xxxxx.supabase.co -> xxxxx
  const urlMatch = supabaseUrl.match(/https?:\/\/([^.]+)\.supabase\.co/);
  if (!urlMatch) {
    throw new Error(
      "Invalid SUPABASE_URL format. Expected format: https://project-ref.supabase.co"
    );
  }

  const projectRef = urlMatch[1];

  // Use provided password or service key (service key can be used as password in some cases)
  const password = supabasePassword || supabaseServiceKey || "";

  if (!password) {
    throw new Error(
      "Either SUPABASE_DB_PASSWORD or SUPABASE_SERVICE_ROLE_KEY must be set in .env file"
    );
  }

  // Supabase database connection details
  // Database host: db.[project-ref].supabase.co
  // Port: 5432
  // User: postgres
  // Database: postgres
  return `postgresql://postgres:${password}@db.${projectRef}.supabase.co:5432/postgres`;
}

export default {
  dialect: "postgresql",
  schema: "./src/db/schema/*.ts",
  out: "./src/db/migrations",
  dbCredentials: {
    connectionString: getSupabaseConnectionString(),
  },
  verbose: true,
  strict: true,
} satisfies Config;
