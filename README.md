# BootGraph

Graph-based developer tool that inspects a codebase, extracts runtime and service dependencies, and provides an executable Directed Acyclic Graph (DAG) interface in the browser.

---

## Overview

Project onboarding typically relies on written documentation that drifts from implementation reality:
* Outdated setup instructions that miss prerequisite steps or state them out of order.
* Order-dependent startup requirements, such as database migrations running before container initialization.
* Missing local environment variables from template files that lead to silent execution failures.
* Manual inspection across configuration files (`docker-compose.yml`, `package.json`, `Makefile`) to understand system architecture.

BootGraph automates dependency discovery and presents the setup workflow as an executable pipeline:

```bash
npx bootgraph
```

The tool executes the following process:
* Inspects project manifests for runtimes, packages, environment variables, containers, schemas, and entry scripts.
* Constructs a topological Directed Acyclic Graph organized across standardized lifecycle tiers.
* Launches a local HTTP and WebSocket service on port 4000 serving a web-based canvas.
* Binds project source files and reference documentation directly to corresponding graph nodes.
* Streams process execution output in real time using pseudo-terminal emulation.
* Exposes configuration overrides through an inline editor with state persistence.

```
Tier 1: System Runtimes (Node.js runtime, Docker daemon verification)
   |
Tier 2: Package Dependencies (Package manager installation)
   |
Tier 3: Environment Configuration (Local environment variable verification)
   |
Tier 4: Infrastructure Services (Container service initialization)
   | [TCP readiness probe]
Tier 5: Schema and Migrations (Database schema synchronization)
   |
Tier 6: Data Seeding (Initial database seeding)
   |
Tier 7: Application Launch (Development server initialization)
```

---

## Features

### Manifest Scanner
Inspects codebases using modular analyzers:
* Runtime definitions: `.nvmrc`, `.node-version`, `go.mod`, `pyproject.toml`, `.python-version`.
* Package dependencies: `package.json`, lockfiles (`pnpm`, `yarn`, `bun`, `npm`), `poetry.lock`, `requirements.txt`, `Cargo.toml`.
* Environment configuration: `.env.example`, `.env.template` evaluated against existing `.env` files.
* Container definitions: `docker-compose.yml`, `compose.yaml` (extracts services, ports, and health checks).
* Database schemas: Prisma (`schema.prisma`), Drizzle (`drizzle.config.ts`), Alembic (`alembic.ini`).
* Automation scripts: `Makefile`, `Justfile`, npm scripts evaluated via pattern matching (`db:*`, `seed:*`, `dev`, `build`).

### Documentation and Source Association
Associates technical context with each execution stage:
* Source anchors: Direct file references and line numbers for configuration targets.
* Technical references: Direct links to official documentation for detected toolchains.
* Project documentation extraction: Relevant setup sections extracted directly from local README files.

### Interactive Graph Interface
* Web canvas built with React Flow providing panning, zooming, and node inspection.
* Node execution states: Blocked, Ready, Running, Completed, Failed, Skipped.
* Real-time execution controls to trigger individual nodes or full pipelines.
* Inline environment variable configuration with secret masking.
* Interactive dependency re-linking and custom step registration.
* Configuration export to `.bootgraph.json` for repository-level persistence.

### Process Execution and Health Probing
* Subprocess execution streaming ANSI-formatted logs to an integrated xterm.js terminal.
* Non-blocking socket, command, and file probes to verify service availability before unlocking dependent nodes.
* Automatic parallel execution for unblocked nodes.

---

## System Architecture

```
+--------------------------------------------------------------+
|                     Target Repository                        |
|   (package.json, docker-compose.yml, .env.example, README)   |
+------------------------------+-------------------------------+
                               | Read & Inspect
+------------------------------v-------------------------------+
|                    BootGraph CLI Daemon                      |
|                                                              |
|  - Manifest Scanners (Heuristic Analyzers)                   |
|  - Documentation Enricher (File Anchors & References)        |
|  - Topological DAG Engine (Kahn Algorithm & Tiers)           |
|  - Execution Runner (Subprocess Management & Stream Piping)  |
|  - Readiness Probes (TCP Socket & Command Verification)      |
|  - Embedded Web Server (Hono HTTP & WebSocket Daemon)        |
+------------------------------+-------------------------------+
                               | WebSocket & HTTP
+------------------------------v-------------------------------+
|                    BootGraph Web Canvas                      |
|                                                              |
|  - React Flow Directed Graph Interface                       |
|  - xterm.js Terminal Stream Drawer                           |
|  - Node and Edge Inspector                                   |
|  - Environment Variable Configuration Modal                  |
+--------------------------------------------------------------+
```

---

## Lifecycle Tiers

The DAG engine organizes execution across seven deterministic stages:

| Tier | Name | Scope |
| :---: | :--- | :--- |
| **1** | System Runtimes | Base interpreters, compilers, and container daemons. |
| **2** | Package Dependencies | Third-party dependencies installed via package managers. |
| **3** | Environment Configuration | Required keys and values defined in configuration files. |
| **4** | Infrastructure Services | Background datastores, message queues, and cache services. |
| **5** | Schema and Migrations | Schema definitions and migration scripts applied to datastores. |
| **6** | Data Seeding | Fixture data and default development records. |
| **7** | Application Launch | Primary application servers and watcher processes. |

---

## Configuration (`.bootgraph.json`)

BootGraph operates without configuration files by default. Team-specific settings and custom steps can be saved to `.bootgraph.json`:

```json
{
  "$schema": "https://bootgraph.dev/schema.json",
  "name": "my-service",
  "overrides": {
    "db-migrate": {
      "command": "npx prisma migrate deploy"
    }
  },
  "customNodes": [
    {
      "id": "seed-admin",
      "name": "Seed Admin User",
      "tier": 6,
      "command": "node scripts/seed-admin.js",
      "requires": ["db-migrate"]
    }
  ]
}
```

---

## Development

### Requirements
* Node.js >= 20.0.0
* npm >= 9.0.0

### Local Execution
```bash
git clone https://github.com/hmani3/boot-graph.git
cd boot-graph

npm install
npm test
npm run build
```

---

## License

MIT
