import fs from "node:fs/promises";
import path from "node:path";
import { SetupNode } from "../../core/types.js";
import { OFFICIAL_DOCS, extractFileSnippet } from "../doc-enricher.js";

export async function scanDatabase(workspaceDir: string): Promise<SetupNode[]> {
  const nodes: SetupNode[] = [];

  const prismaPath = path.join(workspaceDir, "prisma", "schema.prisma");
  let hasPrisma = false;
  try {
    await fs.access(prismaPath);
    hasPrisma = true;
  } catch {
    // no prisma
  }

  if (hasPrisma) {
    let schemaRaw = "";
    try {
      schemaRaw = await fs.readFile(prismaPath, "utf-8");
    } catch {
      // ignore read error
    }
    const isSqlite = /provider\s*=\s*["']sqlite["']/i.test(schemaRaw);
    const migrateRequires = isSqlite
      ? ["deps:installed", "env:configured"]
      : ["deps:installed", "service:database", "env:configured"];

    const snippet = await extractFileSnippet(workspaceDir, "prisma/schema.prisma", 25);
    nodes.push({
      id: "db-migrate-prisma",
      name: "Apply Prisma Migrations",
      tier: 5,
      category: "db",
      status: "blocked",
      command: "npx prisma migrate dev",
      description:
        "Execute pending Prisma database migrations and sync schema with target database.",
      rationale:
        "Database tables, indexes, and relations must exist before the application code or seeds can execute.",
      sourceFile: "prisma/schema.prisma",
      sourceSnippet: snippet?.snippet,
      sourceLineRange: snippet?.lineRange,
      docLinks: OFFICIAL_DOCS.prisma || [],
      provides: ["db:migrated", "db:schema"],
      requires: migrateRequires,
    });

    nodes.push({
      id: "db-generate-prisma",
      name: "Generate Prisma Client",
      tier: 5,
      category: "db",
      status: "blocked",
      command: "npx prisma generate",
      description: "Generate type-safe Prisma Client JavaScript/TypeScript bindings.",
      rationale: "Application build and dev server require freshly compiled Prisma models.",
      sourceFile: "prisma/schema.prisma",
      sourceSnippet: snippet?.snippet,
      sourceLineRange: snippet?.lineRange,
      docLinks: OFFICIAL_DOCS.prisma || [],
      provides: ["db:client"],
      requires: ["deps:installed"],
    });
  }

  const drizzleCandidates = [
    "drizzle.config.ts",
    "drizzle.config.js",
    "drizzle.config.json",
  ];
  let drizzleFile: string | undefined;
  for (const c of drizzleCandidates) {
    try {
      await fs.access(path.join(workspaceDir, c));
      drizzleFile = c;
      break;
    } catch {
      // ignore
    }
  }

  if (drizzleFile) {
    const snippet = await extractFileSnippet(workspaceDir, drizzleFile, 25);
    nodes.push({
      id: "db-migrate-drizzle",
      name: "Push Drizzle Schema Migrations",
      tier: 5,
      category: "db",
      status: "blocked",
      command: "npx drizzle-kit push",
      description: "Push local TypeScript Drizzle schema definitions directly into target database.",
      rationale: "Database schema must match TypeScript models before application boot.",
      sourceFile: drizzleFile,
      sourceSnippet: snippet?.snippet,
      sourceLineRange: snippet?.lineRange,
      docLinks: OFFICIAL_DOCS.drizzle || [],
      provides: ["db:migrated", "db:schema"],
      requires: ["deps:installed", "service:database", "env:configured"],
    });
  }

  const alembicPath = path.join(workspaceDir, "alembic.ini");
  try {
    await fs.access(alembicPath);
    const snippet = await extractFileSnippet(workspaceDir, "alembic.ini", 20);
    nodes.push({
      id: "db-migrate-alembic",
      name: "Run Alembic Migrations",
      tier: 5,
      category: "db",
      status: "blocked",
      command: "alembic upgrade head",
      description: "Upgrade database schema to the latest Alembic revision.",
      rationale: "Python backend services depend on current database schema state.",
      sourceFile: "alembic.ini",
      sourceSnippet: snippet?.snippet,
      sourceLineRange: snippet?.lineRange,
      docLinks: [
        {
          title: "Alembic Documentation",
          url: "https://alembic.sqlalchemy.org/en/latest/",
          type: "official",
          description: "Database migration tool for SQLAlchemy.",
        },
      ],
      provides: ["db:migrated"],
      requires: ["deps:installed", "service:database", "env:configured"],
    });
  } catch {
    // no alembic
  }

  return nodes;
}
