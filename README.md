# Admin Dashboard Server

Fastify server for admin dashboard application.

## Setup

1. Install dependencies:

```bash
npm install
# or
pnpm install
```

2. Create a `.env` file in the root directory:

```env
PORT=3000
HOST=0.0.0.0
NODE_ENV=development
LOG_LEVEL=info

# Supabase Configuration
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
# Or use anon key for client-side operations:
# SUPABASE_ANON_KEY=your_supabase_anon_key

# For Drizzle migrations, you need database password
# Get this from: Supabase Dashboard -> Settings -> Database -> Connection string -> URI
# Or use the service role key as password
SUPABASE_DB_PASSWORD=your_database_password
# Alternatively, you can provide the full connection string:
# SUPABASE_DB_URL=postgresql://postgres:password@db.project-ref.supabase.co:5432/postgres

# SMTP Configuration (for sending emails)
# Required for weekly personal task email reports
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=your-email@gmail.com
```

**Note:** For admin operations, it's recommended to use `SUPABASE_SERVICE_ROLE_KEY` which bypasses Row Level Security (RLS). For client-side operations, use `SUPABASE_ANON_KEY`.

**For Drizzle migrations:** You need the database password. You can find it in Supabase Dashboard -> Settings -> Database -> Connection string. Or you can use the service role key as the password.

3. Build the project:

```bash
npm run build
```

4. Start the server:

```bash
npm start
```

## Development

Run in development mode with hot reload:

```bash
npm run dev
```

## Project Structure

```
admin-dashboard-server/
├── src/
│   ├── server.ts      # Entry point
│   ├── app.ts         # Fastify app configuration
│   ├── plugins/       # Fastify plugins (auto-loaded)
│   └── routes/        # API routes (auto-loaded)
├── dist/              # Compiled JavaScript (generated)
├── package.json
├── tsconfig.json
└── README.md
```

## Adding Routes

Create route files in `src/routes/` directory. They will be automatically loaded by `@fastify/autoload`.

Example route file (`src/routes/example.ts`):

```typescript
import { FastifyPluginAsync } from "fastify";

const example: FastifyPluginAsync = async (fastify) => {
  fastify.get("/example", async (request, reply) => {
    return { message: "Hello from admin dashboard server!" };
  });
};

export default example;
```

## Testing Supabase Connection

After setting up your `.env` file, you can test the Supabase connection:

1. Start the server:

```bash
npm run dev
```

2. Check configuration status:

```bash
curl http://localhost:3000/test/supabase/config
```

3. Test the connection:

```bash
curl http://localhost:3000/test/supabase
```

## Using Supabase

The Supabase client is available on the Fastify instance. You can access it in your routes:

```typescript
import { FastifyPluginAsync } from "fastify";

const example: FastifyPluginAsync = async (fastify) => {
  fastify.get("/users", async (request, reply) => {
    // Access Supabase client
    const { data, error } = await fastify.supabase.from("users").select("*");

    if (error) {
      return reply.status(500).send({ error: error.message });
    }

    return { data };
  });
};

export default example;
```

## Adding Plugins

Create plugin files in `src/plugins/` directory. They will be automatically loaded by `@fastify/autoload`.

## Database Migrations with Drizzle

This project uses Drizzle ORM for database migrations. Here's how to use it:

### 1. Define your schema

Edit or create schema files in `src/db/schema/`:

```typescript
// src/db/schema/users.ts
import { pgTable, uuid, varchar, timestamp } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

Don't forget to export it in `src/db/schema/index.ts`:

```typescript
export * from "./users";
```

### 2. Generate migrations

After defining your schema, generate migration files:

```bash
npm run db:generate
```

This will create migration files in `src/db/migrations/`.

### 3. Apply migrations

Apply migrations to your Supabase database:

```bash
npm run db:migrate
```

### 4. Push schema directly (development only)

For quick development, you can push schema changes directly without migrations:

```bash
npm run db:push
```

**Warning:** `db:push` is for development only. Use migrations (`db:migrate`) in production.

### 5. Open Drizzle Studio

View and edit your database with Drizzle Studio:

```bash
npm run db:studio
```

### Using Drizzle in Routes

Access Drizzle in your routes:

```typescript
import { FastifyPluginAsync } from "fastify";
import { eq } from "drizzle-orm";
import { users } from "../db/schema";

const example: FastifyPluginAsync = async (fastify) => {
  fastify.get("/users", async (request, reply) => {
    const allUsers = await fastify.drizzle.select().from(users);
    return { data: allUsers };
  });

  fastify.get("/users/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = await fastify.drizzle
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    if (user.length === 0) {
      return reply.status(404).send({ error: "User not found" });
    }

    return { data: user[0] };
  });
};

export default example;
```
