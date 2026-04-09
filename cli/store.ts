import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve } from "path";
import { sanitizeItems, sanitizeTitle, type HillchartItem } from "../src/hillchart.ts";

export interface HillData {
  title: string;
  items: HillchartItem[];
}

const DATA_FILE = resolve(process.cwd(), "hill.json");

export function dataExists(): boolean {
  return existsSync(DATA_FILE);
}

export function load(): HillData {
  if (!existsSync(DATA_FILE)) {
    console.error("No hill.json found. Run `hill init` first.");
    process.exit(1);
  }
  const raw = JSON.parse(readFileSync(DATA_FILE, "utf-8"));
  return {
    title: sanitizeTitle(raw.title),
    items: sanitizeItems(raw.items),
  };
}

export function save(data: HillData): void {
  writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}
