#!/usr/bin/env node
import path from "node:path";
import { Command } from "commander";
import open from "open";
import picocolors from "picocolors";
import { startServer } from "../server/index.js";

const banner = `
${picocolors.cyan("   ____              __  ______                 __  ")}
${picocolors.cyan("  / __ )____  ____  / /_/ ____/________ _____  / /_ ")}
${picocolors.cyan(" / __  / __ \\/ __ \\/ __/ / __/ ___/ __ `/ __ \\/ __ \\")}
${picocolors.cyan("/ /_/ / /_/ / /_/ / /_/ /_/ / /  / /_/ / /_/ / / / /")}
${picocolors.cyan("/_____/\\____/\\____/\\__/\\____/_/   \\__,_/ .___/_/ /_/ ")}
${picocolors.cyan("                                     /_/            ")}
`;

const program = new Command();

program
  .name("bootgraph")
  .description("Interactive visual setup & dependency graph for any codebase")
  .version("0.1.0")
  .option("-p, --port <port>", "Port to serve interactive canvas on", "4000")
  .option(
    "-w, --workspace <path>",
    "Directory of the repository to inspect",
    process.cwd()
  )
  .option("--no-open", "Do not automatically open the browser")
  .action(async (options) => {
    console.log(banner);

    const port = parseInt(options.port, 10);
    const workspaceDir = path.resolve(options.workspace);

    console.log(
      picocolors.gray(`Inspecting workspace: ${picocolors.white(workspaceDir)}`)
    );

    try {
      const { manifest } = await startServer({
        port,
        workspaceDir,
      });

      console.log(
        picocolors.green(
          `Discovered ${manifest.nodes.length} setup nodes across ${manifest.summary.tiersPresent.length} lifecycle tiers.`
        )
      );

      const url = `http://localhost:${port}`;
      console.log(
        picocolors.bold(
          picocolors.cyan(`Serving canvas interface at: ${url}`)
        )
      );
      console.log(picocolors.gray("Press Ctrl+C to terminate process.\n"));

      if (options.open) {
        await open(url).catch(() => {});
      }
    } catch (err: any) {
      console.error(picocolors.red(`\nFailed to start BootGraph: ${err.message}`));
      process.exit(1);
    }
  });

program.parse(process.argv);
