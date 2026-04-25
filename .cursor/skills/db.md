---
name: drizzle-schema-ts-only
description: Update PostgreSQL/Timescale schemas using Drizzle ORM TypeScript files only. Use when changing DB schema definitions in codebases that use Drizzle; never create or modify .sql migration files, and leave migration generation to the user.
---

# Drizzle Schema TS Only

## Scope

- Apply when editing database schemas (Postgres/Timescale) backed by Drizzle ORM.

## Rules

- Edit only Drizzle ORM TypeScript schema files (e.g., `src/db/postgres/schema/*.ts`).
- Do not create, edit, or delete any `.sql` migration files.
- Do not run migration generators; user will run Drizzle Kit manually.

## Workflow

1. Locate existing schema definitions and follow existing patterns (indexes, enums, defaults).
2. Implement schema changes in TS only.
3. Summarize changes and remind user to run Drizzle Kit to generate SQL migrations.
