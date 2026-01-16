import type { Config } from "drizzle-kit";
import * as dotenv from "dotenv";

dotenv.config();

// Parse connection string to extract individual components
function parseConnectionString(connectionString: string) {
  try {
    const url = new URL(connectionString);
    return {
      host: url.hostname,
      port: parseInt(url.port || "5432"),
      user: url.username,
      password: url.password,
      database: url.pathname.slice(1) || "postgres",
      ssl: {
        rejectUnauthorized: false, // Supabase uses self-signed certificates
      },
    };
  } catch (error) {
    throw new Error(
      `Invalid connection string format: ${connectionString}\n` +
        "Expected format: postgresql://user:password@host:port/database"
    );
  }
}

// Get database credentials from environment variables
function getDbCredentials() {
  // Priority 1: Use DATABASE_URL if provided (connection string from Supabase Dashboard)
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl) {
    console.log("Using DATABASE_URL from .env file");
    return parseConnectionString(databaseUrl.trim());
  }

  // Priority 2: Use individual DATABASE_* variables
  const host = process.env.DATABASE_HOST;
  const port = process.env.DATABASE_PORT;
  const user = process.env.DATABASE_USER;
  const password = process.env.DATABASE_PASSWORD;
  const database = process.env.DATABASE_NAME;

  if (!host || !port || !user || !password || !database) {
    throw new Error(
      "\n❌ Database configuration is incomplete in .env file.\n\n" +
        "Option 1: Use DATABASE_URL (RECOMMENDED - get from Supabase Dashboard):\n" +
        "  DATABASE_URL=postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres\n\n" +
        "Option 2: Use individual variables:\n" +
        "  DATABASE_HOST=db.ehvutrxybbhawozozpat.supabase.co\n" +
        "  DATABASE_PORT=5432\n" +
        "  DATABASE_USER=postgres\n" +
        "  DATABASE_PASSWORD=your_password\n" +
        "  DATABASE_NAME=postgres\n\n" +
        "📋 Cách lấy DATABASE_URL:\n" +
        "1. Vào Supabase Dashboard -> Settings -> Database\n" +
        "2. Tìm phần 'Connection string'\n" +
        "3. Chọn tab 'Transaction' (port 6543) hoặc 'Session' (port 5432)\n" +
        "4. Copy connection string và thêm vào .env"
    );
  }

  return {
    host: host.trim(),
    port: parseInt(port.trim()),
    user: user.trim(),
    password: password.trim(),
    database: database.trim(),
    ssl: {
      rejectUnauthorized: false, // Supabase uses self-signed certificates
    },
  };
}

const dbCredentials = getDbCredentials();

// Debug: Log connection info (without password)
if (process.env.DEBUG_DB_CONNECTION === "true") {
  console.log("Database connection info:", {
    host: dbCredentials.host,
    port: dbCredentials.port,
    user: dbCredentials.user,
    database: dbCredentials.database,
    ssl: dbCredentials.ssl ? "enabled" : "disabled",
  });
}

export default {
  dialect: "postgresql",
  schema: "./src/db/schema/*.ts",
  out: "./src/db/migrations",
  dbCredentials,
  verbose: true,
  strict: true,
} satisfies Config;
