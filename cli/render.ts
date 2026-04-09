import { writeFileSync } from "fs";
import { buildHillPath, buildLabelLayouts, chartBounds, type HillchartItem } from "../src/hillchart.ts";
import { Resvg } from "@resvg/resvg-js";

function markerColor(percentage: number): string {
  if (percentage < 34) return "#6371a6";
  if (percentage < 50) return "#5387b7";
  if (percentage < 60) return "#c89b2f";
  return "#35a4a2";
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildSvg(title: string, items: HillchartItem[]): string {
  const hillPath = buildHillPath();
  const visibleItems = items.filter((i) => i.name.trim().length > 0);
  const labelLayouts = buildLabelLayouts(visibleItems);

  const markers = labelLayouts
    .map((layout) => {
      const { item, point } = layout;
      const color = markerColor(item.percentage);
      return `
    <g>
      <path d="M ${point.x} ${layout.leaderStartY} V ${layout.leaderEndY} H ${layout.leaderEndX}"
        stroke="${color}" stroke-width="3" fill="none" opacity="0.62" />
      <circle cx="${point.x}" cy="${point.y}" r="15" fill="#ffffff" opacity="0.96" filter="url(#soft-shadow)" />
      <circle cx="${point.x}" cy="${point.y}" r="12.5" fill="${color}" />
      <text x="${layout.labelX}" y="${layout.labelY}" text-anchor="${layout.textAnchor}"
        fill="${color}" font-family="Inter, Arial, sans-serif" font-size="20"
        font-weight="800" letter-spacing="-0.02em">${escapeXml(item.name)}</text>
    </g>`;
    })
    .join("\n");

  const emptyMessage =
    visibleItems.length === 0
      ? `<text x="688" y="392" text-anchor="middle" fill="#748096"
        font-family="Inter, Arial, sans-serif" font-size="22" font-weight="700">
        Add a milestone name to show it on the chart
      </text>`
      : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1376 768" width="1376" height="768">
  <defs>
    <linearGradient id="hill-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#66739f" />
      <stop offset="28%" stop-color="#8c92af" />
      <stop offset="49%" stop-color="#c8992d" />
      <stop offset="60%" stop-color="#b8a24a" />
      <stop offset="100%" stop-color="#34a4a3" />
    </linearGradient>
    <linearGradient id="wash" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fbf1d9" />
      <stop offset="44%" stop-color="#fbfaf7" />
      <stop offset="100%" stop-color="#e2f3f7" />
    </linearGradient>
    <radialGradient id="left-glow" cx="0%" cy="20%" r="70%">
      <stop offset="0%" stop-color="rgba(247,221,167,0.6)" />
      <stop offset="100%" stop-color="rgba(247,221,167,0)" />
    </radialGradient>
    <radialGradient id="right-glow" cx="100%" cy="100%" r="78%">
      <stop offset="0%" stop-color="rgba(177,230,236,0.6)" />
      <stop offset="100%" stop-color="rgba(177,230,236,0)" />
    </radialGradient>
    <filter id="soft-shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="#3f5573" flood-opacity="0.12" />
    </filter>
    <filter id="curve-shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#53627f" flood-opacity="0.18" />
    </filter>
  </defs>

  <rect width="1376" height="768" fill="url(#wash)" />
  <rect width="1376" height="768" fill="url(#left-glow)" opacity="0.75" />
  <rect width="1376" height="768" fill="url(#right-glow)" opacity="0.75" />

  <line x1="76" y1="104" x2="1300" y2="104" stroke="#d7dde6" stroke-width="1.5" />
  <line x1="${chartBounds.center}" y1="182" x2="${chartBounds.center}" y2="690" stroke="#dde4ea" stroke-width="1.4" />
  <line x1="40" y1="${chartBounds.baseline + 8}" x2="1336" y2="${chartBounds.baseline + 8}" stroke="#dbe3ea" stroke-width="1.5" />

  <text x="688" y="82" text-anchor="middle" fill="#24334b"
    font-family="Inter, Arial, sans-serif" font-size="31" font-weight="500" letter-spacing="-0.03em">
    ${escapeXml(title)}
  </text>

  <path d="${hillPath}" fill="none" stroke="rgba(73,84,109,0.12)"
    stroke-linecap="round" stroke-linejoin="round" stroke-width="10"
    transform="translate(0 2)" filter="url(#curve-shadow)" />
  <path d="${hillPath}" fill="none" stroke="url(#hill-gradient)"
    stroke-linecap="round" stroke-linejoin="round" stroke-width="5.5" />

  ${emptyMessage}
  ${markers}
</svg>`;
}

export function renderToPng(svgString: string, outputPath: string): void {
  const resvg = new Resvg(svgString, { fitTo: { mode: "width", value: 1376 } });
  const rendered = resvg.render();
  writeFileSync(outputPath, rendered.asPng());
}
