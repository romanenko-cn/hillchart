import { describe, expect, it } from "vitest";
import {
  buildLabelLayouts,
  chartBounds,
  clampManualLabelPosition,
  clampPercentage,
  createEmptyItems,
  createMilestoneItem,
  defaultChartTitle,
  getHillPoint,
  labelLayoutBounds,
  maxItems,
  sanitizeItems,
  sanitizeTitle,
} from "./hillchart";

describe("clampPercentage", () => {
  it("keeps percentages within the chart range", () => {
    expect(clampPercentage(-10)).toBe(0);
    expect(clampPercentage(42.4)).toBe(42);
    expect(clampPercentage(42.5)).toBe(43);
    expect(clampPercentage(125)).toBe(100);
    expect(clampPercentage(Number.NaN)).toBe(0);
  });
});

describe("getHillPoint", () => {
  it("maps 0, 50, and 100 percent across the hill", () => {
    const start = getHillPoint(0);
    const middle = getHillPoint(50);
    const end = getHillPoint(100);

    expect(start.x).toBe(chartBounds.left);
    expect(start.y).toBe(chartBounds.baseline);
    expect(middle.x).toBe(chartBounds.center);
    expect(middle.y).toBe(chartBounds.top);
    expect(end.x).toBe(chartBounds.right);
    expect(end.y).toBeCloseTo(chartBounds.baseline);
  });

  it("keeps the hill symmetrical around the middle", () => {
    const leftQuarter = getHillPoint(25);
    const rightQuarter = getHillPoint(75);

    expect(leftQuarter.y).toBeCloseTo(rightQuarter.y);
    expect(leftQuarter.x + rightQuarter.x).toBeCloseTo(chartBounds.left + chartBounds.right);
  });
});

describe("buildLabelLayouts", () => {
  it("separates labels for clustered percentages", () => {
    const layouts = buildLabelLayouts([
      { id: "a", name: "Milestone A", percentage: 20 },
      { id: "b", name: "Milestone B", percentage: 21 },
      { id: "c", name: "Milestone C", percentage: 22 },
      { id: "d", name: "Milestone D", percentage: 23 },
    ]);

    layouts.forEach((layout, index) => {
      layouts.slice(index + 1).forEach((other) => {
        expect(overlaps(layout.box, other.box)).toBe(false);
      });
    });
  });

  it("uses manual label positions when provided", () => {
    const [layout] = buildLabelLayouts([
      {
        id: "manual",
        name: "Manual Label",
        percentage: 20,
        manualLabelPosition: {
          x: 420,
          y: 180,
        },
      },
    ]);

    expect(layout.labelX).toBe(420);
    expect(layout.labelY).toBe(180);
    expect(layout.leaderEndX).toBe(420);
    expect(layout.box.left).toBeLessThan(layout.box.right);
  });

  it("clamps manual label positions into the visible layout frame", () => {
    const [layout] = buildLabelLayouts([
      {
        id: "manual",
        name: "A very long manual label that should be clamped safely",
        percentage: 65,
        manualLabelPosition: {
          x: 9999,
          y: -200,
        },
      },
    ]);

    expect(layout.labelX).toBeLessThanOrEqual(labelLayoutBounds.maxCenterX - 64);
    expect(layout.labelY).toBe(labelLayoutBounds.minCenterY);
    expect(layout.box.left).toBeGreaterThanOrEqual(labelLayoutBounds.minCenterX);
    expect(layout.box.top).toBeGreaterThanOrEqual(labelLayoutBounds.minCenterY - 24);
  });
});

function overlaps(
  first: { left: number; right: number; top: number; bottom: number },
  second: { left: number; right: number; top: number; bottom: number },
) {
  return (
    first.left < second.right &&
    first.right > second.left &&
    first.top < second.bottom &&
    first.bottom > second.top
  );
}

describe("sanitizeItems", () => {
  it("normalizes stored items without padding to ten rows", () => {
    const items = sanitizeItems([
      { id: "existing", name: "Lookup API", percentage: 101 },
      { name: 12, percentage: -4 },
    ]);

    expect(items).toHaveLength(2);
    expect(items[0]).toEqual({ id: "existing", name: "Lookup API", percentage: 100 });
    expect(items[1].name).toBe("");
    expect(items[1].percentage).toBe(0);
  });

  it("keeps at least one milestone and no more than ten milestones", () => {
    expect(createEmptyItems()).toHaveLength(1);
    expect(sanitizeItems([])).toHaveLength(1);
    expect(
      sanitizeItems(
        Array.from({ length: maxItems + 2 }, (_, index) => createMilestoneItem(index + 1)),
      ),
    ).toHaveLength(maxItems);
  });

  it("preserves valid manual label positions and drops malformed ones", () => {
    const items = sanitizeItems([
      {
        id: "existing",
        name: "Lookup API",
        percentage: 70,
        manualLabelPosition: { x: 450, y: 180 },
      },
      {
        id: "bad",
        name: "Bad",
        percentage: 20,
        manualLabelPosition: { x: "oops", y: 180 },
      },
    ]);

    expect(items[0].manualLabelPosition).toEqual({ x: 450, y: 180 });
    expect(items[1].manualLabelPosition).toBeUndefined();
  });
});

describe("clampManualLabelPosition", () => {
  it("keeps a dragged label fully inside the safe layout frame", () => {
    const clamped = clampManualLabelPosition(
      { name: "Long milestone name" },
      { x: -100, y: 1000 },
    );

    expect(clamped.x).toBeGreaterThanOrEqual(labelLayoutBounds.minCenterX + 64);
    expect(clamped.y).toBe(labelLayoutBounds.maxCenterY);
  });
});

describe("sanitizeTitle", () => {
  it("keeps a non-empty title and falls back for empty values", () => {
    expect(sanitizeTitle("  Role Assignment Operations  ")).toBe("Role Assignment Operations");
    expect(sanitizeTitle("   ")).toBe(defaultChartTitle);
    expect(sanitizeTitle(null)).toBe(defaultChartTitle);
  });
});
