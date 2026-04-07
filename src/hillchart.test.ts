import { describe, expect, it } from "vitest";
import {
  buildLabelLayouts,
  chartBounds,
  clampPercentage,
  createEmptyItems,
  createTaskItem,
  defaultChartTitle,
  getHillPoint,
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
      { id: "a", name: "Task A", percentage: 20 },
      { id: "b", name: "Task B", percentage: 21 },
      { id: "c", name: "Task C", percentage: 22 },
      { id: "d", name: "Task D", percentage: 23 },
    ]);

    layouts.forEach((layout, index) => {
      layouts.slice(index + 1).forEach((other) => {
        expect(overlaps(layout.box, other.box)).toBe(false);
      });
    });
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
  it("normalizes stored items without padding to eight rows", () => {
    const items = sanitizeItems([
      { id: "existing", name: "Lookup API", percentage: 101 },
      { name: 12, percentage: -4 },
    ]);

    expect(items).toHaveLength(2);
    expect(items[0]).toEqual({ id: "existing", name: "Lookup API", percentage: 100 });
    expect(items[1].name).toBe("");
    expect(items[1].percentage).toBe(0);
  });

  it("keeps at least one task and no more than eight tasks", () => {
    expect(createEmptyItems()).toHaveLength(1);
    expect(sanitizeItems([])).toHaveLength(1);
    expect(
      sanitizeItems(Array.from({ length: maxItems + 2 }, (_, index) => createTaskItem(index + 1))),
    ).toHaveLength(maxItems);
  });
});

describe("sanitizeTitle", () => {
  it("keeps a non-empty title and falls back for empty values", () => {
    expect(sanitizeTitle("  Role Assignment Operations  ")).toBe("Role Assignment Operations");
    expect(sanitizeTitle("   ")).toBe(defaultChartTitle);
    expect(sanitizeTitle(null)).toBe(defaultChartTitle);
  });
});
