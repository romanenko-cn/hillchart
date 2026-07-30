---
name: hillchart
description: Generate a hillchart PNG showing where project milestones sit between "figuring it out" (uphill) and "executing" (downhill), and optionally post it to Linear. Use when the user asks for a hillchart, hill chart, project status chart, or a visual of milestone progress for an issue, project, or update.
---

# Hillchart generator

Renders a Basecamp-style hillchart PNG from a JSON description of milestones. The
left half of the hill means the team is still figuring the work out; the right half
means the path is clear and the work is being executed.

## 1. Build the input JSON

Write a JSON file (or pipe via stdin) shaped like this:

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

- `title` — chart heading. Keep it short; it renders at the top center.
- `items` — 1 to 15 milestones. `name` max ~40 chars for clean labels.
- `percentage` — 0 to 100 position on the hill. Use this guide to place work:
  - 0–35: still figuring out the problem or approach
  - 36–49: approaching clarity, but important unknowns remain
  - 50: crest; path is clear
  - 51–69: implementation path is known, but meaningful execution remains
  - 70–84: implementation largely in place; in review / QA / stabilization
  - 85–94: QA has exercised it; remaining work is bug fixes / hardening
  - 95–100: effectively done, accepted, or only trivial wrap-up remains
- `dotShape` (optional) — `"dot"` (default), `"star"`, or `"rebel-loon"`.

When the user describes work qualitatively ("we just realized the migration is
harder than we thought"), translate it to a percentage yourself using the guide
(that example ≈ 20–30). Label auto-layout handles collisions; you never need to
position labels.

## 2. Render the PNG

From any repo (no checkout needed; requires git access to the repo):

```bash
npx -y github:romanenko-cn/hillchart chart.json -o chart.png
```

Or pipe stdin: `echo '<json>' | npx -y github:romanenko-cn/hillchart - -o chart.png`

Inside a checkout of the hillchart repo, use `npm run render -- chart.json -o chart.png`
instead. Useful flags: `--scale <n>` (default 2 → 2752px wide), `--svg <path>` to also
keep the SVG, `--help` for full usage. The command prints the absolute output path and
exits non-zero with a message on invalid input.

## 3. Post to Linear (when asked)

If the user wants the chart on a Linear issue/project and Linear MCP tools are
available:

1. Call the attachment-upload preparation tool (e.g. `prepare_attachment_upload`)
   with the PNG's filename, `image/png`, and byte size. It returns an upload URL
   (plus any required headers) and the final asset URL.
2. Upload the file with curl, e.g.
   `curl -sf -X PUT --upload-file chart.png -H "Content-Type: image/png" [returned headers] "<uploadUrl>"`.
3. Embed the asset in markdown — `![<title>](<assetUrl>)` — in a comment
   (`save_comment`), issue/project description, or attach it via
   `create_attachment_from_upload`, whichever fits the user's request.

Prefer embedding in a comment unless the user asks to edit the description.
