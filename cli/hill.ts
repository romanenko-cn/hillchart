#!/usr/bin/env tsx
import { Command } from "commander";
import { execSync } from "child_process";
import { resolve } from "path";
import { randomUUID } from "crypto";
import { load, save, dataExists } from "./store.ts";
import { buildSvg, renderToPng } from "./render.ts";

const PNG_FILE = resolve(process.cwd(), "hill.png");

function rerender(): void {
  const data = load();
  const svg = buildSvg(data.title, data.items);
  renderToPng(svg, PNG_FILE);
}

const program = new Command();

program
  .name("hill")
  .description("Shape Up hill chart CLI")
  .version("0.1.0");

program
  .command("init [title]")
  .description("Create a new hill chart in the current directory")
  .action((title = "Project Hillchart") => {
    if (dataExists()) {
      console.error("hill.json already exists.");
      process.exit(1);
    }
    save({ title, items: [] });
    console.log(`Initialized: ${title}`);
  });

program
  .command("add <name>")
  .description("Add a scope")
  .option("-p, --pos <number>", "Starting position 0–100", "0")
  .action((name: string, opts: { pos: string }) => {
    const pos = parseInt(opts.pos, 10);
    if (isNaN(pos) || pos < 0 || pos > 100) {
      console.error("Position must be 0–100.");
      process.exit(1);
    }
    const data = load();
    if (data.items.some((i) => i.name === name)) {
      console.error(`'${name}' already exists.`);
      process.exit(1);
    }
    data.items.push({ id: randomUUID(), name, percentage: pos });
    save(data);
    rerender();
    console.log(`Added '${name}' at ${pos}.`);
  });

program
  .command("move <name> <position>")
  .description("Move a scope to a new position (0–100)")
  .action((name: string, posStr: string) => {
    const pos = parseInt(posStr, 10);
    if (isNaN(pos) || pos < 0 || pos > 100) {
      console.error("Position must be 0–100.");
      process.exit(1);
    }
    const data = load();
    const item = data.items.find((i) => i.name === name);
    if (!item) {
      console.error(`'${name}' not found.`);
      process.exit(1);
    }
    item.percentage = pos;
    save(data);
    rerender();
    console.log(`Moved '${name}' to ${pos}.`);
  });

program
  .command("done <name>")
  .description("Mark a scope complete and remove it")
  .action((name: string) => {
    const data = load();
    const before = data.items.length;
    data.items = data.items.filter((i) => i.name !== name);
    if (data.items.length === before) {
      console.error(`'${name}' not found.`);
      process.exit(1);
    }
    save(data);
    rerender();
    console.log(`Done: '${name}'.`);
  });

program
  .command("list")
  .description("List all scopes and positions")
  .action(() => {
    const data = load();
    if (!data.items.length) {
      console.log("No scopes. Use 'hill add <name>' to add one.");
      return;
    }
    console.log(`\n  ${data.title}\n`);
    [...data.items]
      .sort((a, b) => a.percentage - b.percentage)
      .forEach((item) => {
        const p = item.percentage;
        const side = p < 50 ? "figuring out" : "executing  ";
        const filled = "█".repeat(Math.floor(p / 5));
        const empty = "░".repeat(20 - Math.floor(p / 5));
        console.log(`  ${filled}${empty}  ${String(p).padStart(3)}  ${side}  ${item.name}`);
      });
    console.log();
  });

program
  .command("show")
  .description("Render the chart PNG and open in Preview")
  .action(() => {
    rerender();
    execSync(`open "${PNG_FILE}"`);
    console.log(`Opened ${PNG_FILE} — Preview will live-update on changes.`);
  });

program
  .command("export [output]")
  .description("Export to PNG at a custom path")
  .action((output: string = PNG_FILE) => {
    const data = load();
    const svg = buildSvg(data.title, data.items);
    renderToPng(svg, resolve(process.cwd(), output));
    console.log(`Exported to ${output}.`);
  });

program.parse();
