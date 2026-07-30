# Hillchart Builder

Create and update Basecamp-style project hillcharts: milestones climb the left side
of the hill while the team is still figuring the work out, and descend the right side
as execution becomes clear. Use it three ways:

- **Web app** — interactive editor at https://romanenko-cn.github.io/hillchart/
  (deployed from `main` via GitHub Pages)
- **CLI** — render a PNG from a JSON description, from this repo or any other
- **AI agents** — a Claude Code skill that generates charts and posts them to Linear

All three share the same rendering code, so the output is identical everywhere.

## Web app

```bash
npm install
npm run dev    # local dev server
npm test       # vitest suite
```

Charts are edited interactively (drag dots along the hill, drag labels to reposition)
and saved to localStorage per browser. "Copy PNG" exports the current chart.

## CLI

Describe a chart as JSON:

```json
{
  "title": "Q3 Platform Roadmap",
  "dotShape": "dot",
  "items": [
    { "name": "SSO integration", "percentage": 18 },
    { "name": "Billing migration", "percentage": 42 },
    { "name": "Mobile push", "percentage": 78 }
  ]
}
```

- `items`: 1–15 milestones; `percentage` 0–100 positions each one on the hill
  (0 = pure unknowns, 50 = crest, 100 = done). See the placement guide in
  [.claude/skills/hillchart/SKILL.md](.claude/skills/hillchart/SKILL.md).
- `dotShape` (optional): `"dot"`, `"star"`, or `"rebel-loon"`.

Render it:

```bash
# inside this repo
npm run render -- chart.json -o chart.png

# from any other repo/machine with git access (no checkout or build needed)
npx -y github:romanenko-cn/hillchart chart.json -o chart.png

# via stdin
echo '{"title":"Demo","items":[{"name":"It works","percentage":62}]}' \
  | npx -y github:romanenko-cn/hillchart - -o chart.png
```

Options: `-o/--out <path>`, `--svg <path>` (also write the SVG), `--scale <n>`
(default 2 → 2752×1536 PNG), `--help`. Inter fonts are bundled in `fonts/`, so
output is pixel-identical on any machine or CI. Example inputs live in
[samples/](samples/).

## Using from AI agents (Claude Code skill)

[.claude/skills/hillchart/SKILL.md](.claude/skills/hillchart/SKILL.md) teaches an
agent the JSON format, the percentage semantics, the `npx` invocation above, and
how to upload the PNG to Linear via the Linear MCP attachment flow (prepare upload
→ curl the file → embed `![chart](assetUrl)` in a comment).

To use it from another repo, copy the skill folder there:

```bash
mkdir -p .claude/skills
cp -r path/to/hillchart/.claude/skills/hillchart .claude/skills/
```

Or install it once for every repo on your machine:

```bash
cp -r path/to/hillchart/.claude/skills/hillchart ~/.claude/skills/
```

Then ask Claude things like *"make a hillchart of our Q3 workstreams and post it
to ENG-123"* — it will write the JSON, run the CLI via `npx`, and attach the PNG
to the Linear issue.

## How it's put together

- [src/hillchart.ts](src/hillchart.ts) — pure chart math: hill curve, label
  auto-layout with collision avoidance, input sanitization
- [src/ChartSvg.tsx](src/ChartSvg.tsx) — the SVG chart component, shared by the
  web app (interactive) and the CLI (static)
- [src/renderChart.tsx](src/renderChart.tsx) — headless SVG rendering via
  `react-dom/server`
- [src/cli.ts](src/cli.ts) — CLI entry; rasterizes with
  [@resvg/resvg-js](https://github.com/yisibl/resvg-js) (no browser involved)
- [bin/hillchart.js](bin/hillchart.js) — `npx` entry point; runs the TypeScript
  CLI directly via tsx, so git installs need no build step
