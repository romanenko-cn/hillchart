import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";
import { renderChartSvg, type ChartInput } from "./renderChart";
import { sanitizeImageFilename } from "./imageExport";
import { sanitizeTitle, maxItems } from "./hillchart";
import { dotShapes } from "./dotShape";
import { chartImageWidth } from "./ChartSvg";

const usage = `Usage: hillchart <input.json | -> [options]

Renders a hillchart PNG from a JSON description.

Input JSON:
  {
    "title": "Q3 Roadmap",
    "dotShape": "dot" | "star" | "rebel-loon",
    "items": [{ "name": "Milestone", "percentage": 0-100 }, ...]  (max ${maxItems})
  }

Options:
  -o, --out <path>    Output PNG path (default: derived from title)
  --svg <path>        Also write the intermediate SVG
  --scale <n>         Raster scale factor (default: 2, i.e. ${chartImageWidth * 2}px wide)
  -h, --help          Show this help

Percentage placement guide:
  0-35 figuring out the problem, 36-49 approaching clarity, 50 crest (path is clear),
  51-69 executing, 70-84 in review/QA, 85-94 hardening, 95-100 effectively done.
`;

function fail(message: string): never {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function parseArgs(argv: string[]) {
  let input: string | undefined;
  let out: string | undefined;
  let svgOut: string | undefined;
  let scale = 2;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "-h" || arg === "--help") {
      process.stdout.write(usage);
      process.exit(0);
    } else if (arg === "-o" || arg === "--out") {
      out = argv[++index] ?? fail(`${arg} requires a path`);
    } else if (arg === "--svg") {
      svgOut = argv[++index] ?? fail("--svg requires a path");
    } else if (arg === "--scale") {
      scale = Number(argv[++index]);
      if (!Number.isFinite(scale) || scale <= 0 || scale > 8) {
        fail("--scale must be a number between 0 and 8");
      }
    } else if (input === undefined) {
      input = arg;
    } else {
      fail(`Unexpected argument "${arg}"\n\n${usage}`);
    }
  }

  if (input === undefined) {
    fail(usage);
  }

  return { input, out, svgOut, scale };
}

function readInput(source: string): ChartInput {
  const raw =
    source === "-" ? readFileSync(0, "utf8") : readFileSync(resolve(source), "utf8");

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    fail(`Input is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    fail("Input JSON must be an object like {\"title\": ..., \"items\": [...]}");
  }

  const input = parsed as ChartInput;
  if (input.dotShape !== undefined && !dotShapes.includes(input.dotShape as never)) {
    fail(`Unknown dotShape "${String(input.dotShape)}". Use one of: ${dotShapes.join(", ")}.`);
  }

  return input;
}

const { input, out, svgOut, scale } = parseArgs(process.argv.slice(2));
const chartInput = readInput(input);
const svg = renderChartSvg(chartInput);

if (svgOut) {
  writeFileSync(resolve(svgOut), svg);
}

const fontsDir = join(dirname(fileURLToPath(import.meta.url)), "..", "fonts");
const resvg = new Resvg(svg, {
  fitTo: { mode: "width", value: Math.round(chartImageWidth * scale) },
  background: "#ffffff",
  font: {
    fontFiles: [
      join(fontsDir, "Inter-Regular.ttf"),
      join(fontsDir, "Inter-Medium.ttf"),
      join(fontsDir, "Inter-Bold.ttf"),
      join(fontsDir, "Inter-ExtraBold.ttf"),
    ],
    loadSystemFonts: false,
    defaultFontFamily: "Inter",
  },
});

const png = resvg.render().asPng();
const outPath = resolve(out ?? sanitizeImageFilename(sanitizeTitle(chartInput.title)));
writeFileSync(outPath, png);
process.stdout.write(`${outPath}\n`);
