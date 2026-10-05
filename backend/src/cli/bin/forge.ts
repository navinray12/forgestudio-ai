#!/usr/bin/env node
/**
 * ForgeStudio CLI Executable Entrypoint
 * Usage: forge <command> [subcommand] [flags]
 */

import { runCliCommand } from "../../services/cli/forgeCli.service.js";

async function main() {
  const args = process.argv.slice(2);
  const result = await runCliCommand(args, {
    cwd: process.cwd(),
    env: process.env as Record<string, string>,
  });

  if (result.stdout) {
    console.log(result.stdout);
  }
  if (result.stderr) {
    console.error(`\x1b[31m${result.stderr}\x1b[0m`);
  }

  process.exit(result.exitCode);
}

main().catch((err) => {
  console.error("Fatal CLI Error:", err);
  process.exit(1);
});
