import fs from "node:fs/promises";
import path from "node:path";
import { DocLink, LifecycleTier } from "../core/types.js";

// Curated official documentation database
export const OFFICIAL_DOCS: Record<string, DocLink[]> = {
  node: [
    {
      title: "Node.js Official Documentation",
      url: "https://nodejs.org/en/docs",
      type: "official",
      description: "Official API guides, installation instructions, and releases.",
    },
    {
      title: "Node Version Manager (nvm)",
      url: "https://github.com/nvm-sh/nvm",
      type: "external",
      description: "Manage multiple active Node.js versions easily.",
    },
  ],
  pnpm: [
    {
      title: "pnpm Documentation",
      url: "https://pnpm.io/motivation",
      type: "official",
      description: "Fast, disk-space efficient package manager.",
    },
  ],
  yarn: [
    {
      title: "Yarn Package Manager",
      url: "https://yarnpkg.com/getting-started",
      type: "official",
      description: "Fast, reliable, and secure dependency management.",
    },
  ],
  npm: [
    {
      title: "npm CLI Documentation",
      url: "https://docs.npmjs.com/cli/v10/commands/npm-install",
      type: "official",
      description: "Official CLI reference for installing and managing dependencies.",
    },
  ],
  bun: [
    {
      title: "Bun Documentation",
      url: "https://bun.sh/docs",
      type: "official",
      description: "All-in-one JavaScript runtime & toolkit.",
    },
  ],
  docker: [
    {
      title: "Docker Compose Overview",
      url: "https://docs.docker.com/compose/",
      type: "official",
      description: "Define and run multi-container Docker applications.",
    },
    {
      title: "Docker Desktop Troubleshooting",
      url: "https://docs.docker.com/desktop/troubleshoot/overview/",
      type: "official",
      description: "Fix common Docker daemon and connection issues.",
    },
  ],
  postgres: [
    {
      title: "PostgreSQL 16 Documentation",
      url: "https://www.postgresql.org/docs/current/",
      type: "official",
      description: "PostgreSQL database system manual and connection string formats.",
    },
  ],
  redis: [
    {
      title: "Redis Documentation",
      url: "https://redis.io/docs/latest/",
      type: "official",
      description: "In-memory data structure store used as a database, cache, and broker.",
    },
  ],
  prisma: [
    {
      title: "Prisma Migrate Guide",
      url: "https://www.prisma.io/docs/concepts/components/prisma-migrate",
      type: "official",
      description: "How Prisma migration workflows operate in development and production.",
    },
    {
      title: "Prisma Connection Strings",
      url: "https://www.prisma.io/docs/orm/reference/connection-urls",
      type: "official",
      description: "Database connection URL formats for PostgreSQL, MySQL, and SQLite.",
    },
  ],
  drizzle: [
    {
      title: "Drizzle ORM Documentation",
      url: "https://orm.drizzle.team/docs/overview",
      type: "official",
      description: "TypeScript ORM with schema migrations and SQL-like syntax.",
    },
  ],
  python: [
    {
      title: "Python 3 Documentation",
      url: "https://docs.python.org/3/",
      type: "official",
      description: "Official tutorials and language reference.",
    },
    {
      title: "Poetry Dependency Management",
      url: "https://python-poetry.org/docs/",
      type: "official",
      description: "Python packaging and dependency management made easy.",
    },
  ],
  env: [
    {
      title: "The Twelve-Factor App: Config",
      url: "https://12factor.net/config",
      type: "official",
      description: "Store configuration in the environment.",
    },
  ],
};

export interface ExtractedReadmeContext {
  sectionTitle: string;
  content: string;
  tier?: LifecycleTier;
}

/**
 * Parses README.md in the repo to find sections mentioning setup, installation, or environment
 */
export async function extractReadmeContext(
  workspaceDir: string
): Promise<ExtractedReadmeContext[]> {
  const readmePaths = ["README.md", "readme.md", "README", "docs/setup.md"];
  let readmeContent = "";

  for (const rel of readmePaths) {
    try {
      const full = path.join(workspaceDir, rel);
      readmeContent = await fs.readFile(full, "utf-8");
      break;
    } catch {
      // ignore
    }
  }

  if (!readmeContent) return [];

  const results: ExtractedReadmeContext[] = [];
  const lines = readmeContent.split("\n");
  let currentHeader = "";
  let currentLines: string[] = [];

  const flush = () => {
    if (currentHeader && currentLines.length > 0) {
      const content = currentLines.join("\n").trim();
      const lower = currentHeader.toLowerCase();

      let tier: LifecycleTier | undefined;
      if (lower.includes("prereq") || lower.includes("requirement") || lower.includes("system")) {
        tier = 1;
      } else if (lower.includes("install") || lower.includes("dependencies") || lower.includes("clone")) {
        tier = 2;
      } else if (lower.includes("env") || lower.includes("config") || lower.includes("secret")) {
        tier = 3;
      } else if (lower.includes("docker") || lower.includes("database") || lower.includes("services")) {
        tier = 4;
      } else if (lower.includes("migrate") || lower.includes("migration")) {
        tier = 5;
      } else if (lower.includes("seed") || lower.includes("fixture")) {
        tier = 6;
      } else if (lower.includes("run") || lower.includes("start") || lower.includes("dev") || lower.includes("usage")) {
        tier = 7;
      }

      results.push({ sectionTitle: currentHeader, content, tier });
    }
    currentLines = [];
  };

  for (const line of lines) {
    if (line.startsWith("#")) {
      flush();
      currentHeader = line.replace(/^#+\s*/, "").trim();
    } else {
      currentLines.push(line);
    }
  }
  flush();

  return results;
}

/**
 * Extracts a snippet with context from a source file
 */
export async function extractFileSnippet(
  workspaceDir: string,
  relativePath: string,
  maxLines: number = 20
): Promise<{ snippet: string; lineRange: [number, number] } | undefined> {
  try {
    const full = path.join(workspaceDir, relativePath);
    const content = await fs.readFile(full, "utf-8");
    const lines = content.split("\n");
    const count = Math.min(lines.length, maxLines);
    return {
      snippet: lines.slice(0, count).join("\n"),
      lineRange: [1, count],
    };
  } catch {
    return undefined;
  }
}
