import { describe, expect, it } from "vitest";
import { renderChartSvg } from "./renderChart";

describe("renderChartSvg", () => {
  it("renders a standalone SVG document with the title and milestone labels", () => {
    const svg = renderChartSvg({
      title: "Q3 Roadmap",
      items: [
        { name: "Auth", percentage: 35 },
        { name: "Billing", percentage: 80 },
      ],
    });

    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain("Q3 Roadmap");
    expect(svg).toContain(">Auth</text>");
    expect(svg).toContain(">Billing</text>");
    expect(svg).toContain('data-marker-shape="dot"');
  });

  it("filters out unnamed items and falls back to defaults for bad input", () => {
    const svg = renderChartSvg({
      title: "   ",
      dotShape: "triangle",
      items: [
        { name: "  ", percentage: 10 },
        { name: "Real milestone", percentage: 250 },
      ],
    });

    expect(svg).toContain("Project Hillchart");
    expect(svg).toContain("Real milestone");
    expect(svg).toContain('data-marker-shape="dot"');
    const markerCount = svg.match(/data-marker-id=/g)?.length ?? 0;
    expect(markerCount).toBe(1);
  });

  it("renders the requested marker shape", () => {
    const svg = renderChartSvg({
      title: "Shapes",
      dotShape: "star",
      items: [{ name: "One", percentage: 50 }],
    });

    expect(svg).toContain('data-marker-shape="star"');
  });

  it("omits pointer-interaction attributes in static output", () => {
    const svg = renderChartSvg({
      title: "Static",
      items: [{ name: "One", percentage: 50 }],
    });

    expect(svg).not.toContain("onPointer");
  });
});
