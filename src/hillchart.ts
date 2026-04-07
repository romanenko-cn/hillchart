export type HillchartItem = {
  id: string;
  name: string;
  percentage: number;
};

export type ChartPoint = {
  x: number;
  y: number;
};

export type HillchartLabelLayout = {
  item: HillchartItem;
  point: ChartPoint;
  labelX: number;
  labelY: number;
  leaderEndX: number;
  leaderStartY: number;
  leaderEndY: number;
  textAnchor: "start" | "middle" | "end";
  box: LabelBox;
};

type LabelBox = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

export const chartBounds = {
  left: 40,
  right: 1336,
  top: 300,
  baseline: 682,
  center: 688,
};

export const maxItems = 8;
export const defaultChartTitle = "Project Hillchart";

export function clampPercentage(value: number): number {
  if (Number.isNaN(value)) {
    return 0;
  }

  return Math.min(100, Math.max(0, Math.round(value)));
}

export function createEmptyItems(): HillchartItem[] {
  return [createTaskItem(1)];
}

export function createTaskItem(index: number): HillchartItem {
  return {
    id: createTaskId(),
    name: "",
    percentage: defaultPercentageForIndex(index),
  };
}

export function sanitizeTitle(value: unknown): string {
  if (typeof value !== "string") {
    return defaultChartTitle;
  }

  const title = value.trim();
  return title.length > 0 ? title : defaultChartTitle;
}

export function getHillPoint(percentage: number): ChartPoint {
  const clamped = clampPercentage(percentage);
  const progress = clamped / 100;
  const width = chartBounds.right - chartBounds.left;
  const hillHeight = chartBounds.baseline - chartBounds.top;
  const curve = symmetricHillCurve(progress);

  return {
    x: chartBounds.left + width * progress,
    y: chartBounds.baseline - hillHeight * curve,
  };
}

export function buildHillPath(steps = 180): string {
  const points = Array.from({ length: steps + 1 }, (_, index) =>
    getHillPoint((index / steps) * 100),
  );

  return points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(" ");
}

export function buildLabelLayouts(items: HillchartItem[]): HillchartLabelLayout[] {
  const placed: HillchartLabelLayout[] = [];

  items
    .map((item, index) => ({ item, index, point: getHillPoint(item.percentage) }))
    .sort((first, second) => first.point.x - second.point.x)
    .forEach(({ item, index, point }) => {
      const candidates = createLabelCandidates(item, point, index);
      const best = candidates
        .map((candidate) => ({
          candidate,
          score: scoreCandidate(candidate.box, placed, candidate.distancePenalty),
        }))
        .sort((first, second) => first.score - second.score)[0].candidate;

      placed.push({
        item,
        point,
        labelX: best.labelX,
        labelY: best.labelY,
        leaderEndX: best.labelX,
        leaderStartY: point.y + (best.above ? -18 : 18),
        leaderEndY: best.labelY + (best.above ? 20 : -20),
        textAnchor: best.textAnchor,
        box: best.box,
      });
    });

  const byId = new Map(placed.map((layout) => [layout.item.id, layout]));
  return items.map((item) => byId.get(item.id)!);
}

function symmetricHillCurve(progress: number): number {
  const halfProgress = progress <= 0.5 ? progress / 0.5 : (1 - progress) / 0.5;
  return smootherStep(halfProgress);
}

function smootherStep(value: number): number {
  return value * value * value * (value * (value * 6 - 15) + 10);
}

function createLabelCandidates(item: HillchartItem, point: ChartPoint, index: number) {
  const width = estimateLabelWidth(item);
  const height = 48;
  const preferredX = clamp(point.x, 118 + width / 2, 1258 - width / 2);
  const preferredAbove = point.y > 360 || index % 2 === 0;
  const preferredY = clamp(point.y + (preferredAbove ? -74 : 86), 126, 612);
  const laneYs = [126, 206, 286, 366, 446, 526, 606];
  const yCandidates = [
    preferredY,
    ...laneYs.sort(
      (first, second) => Math.abs(first - preferredY) - Math.abs(second - preferredY),
    ),
  ];
  const xOffsets = [0, -180, 180, -320, 320];

  return yCandidates.flatMap((labelY, laneIndex) =>
    xOffsets.map((xOffset, xIndex) => {
      const centerX = clamp(preferredX + xOffset, 118 + width / 2, 1258 - width / 2);
      const above = labelY < point.y;
      const horizontalPenalty = Math.abs(centerX - preferredX) / 4;
      const verticalPenalty = Math.abs(labelY - preferredY) / 6;
      const lanePenalty = laneIndex * 3 + xIndex * 8;

      const box = {
        left: centerX - width / 2,
        right: centerX + width / 2,
        top: labelY - 24,
        bottom: labelY + height,
      };

      return {
        above,
        labelX: centerX,
        labelY,
        textAnchor: "middle" as const,
        distancePenalty: lanePenalty + horizontalPenalty + verticalPenalty,
        box,
      };
    }),
  );
}

function scoreCandidate(
  box: LabelBox,
  placed: HillchartLabelLayout[],
  distancePenalty: number,
): number {
  return placed.reduce((score, layout) => {
    if (!boxesOverlap(box, layout.box)) {
      return score;
    }

    const overlapX = Math.min(box.right, layout.box.right) - Math.max(box.left, layout.box.left);
    const overlapY = Math.min(box.bottom, layout.box.bottom) - Math.max(box.top, layout.box.top);
    return score + 10_000 + overlapX * overlapY;
  }, distancePenalty);
}

function boxesOverlap(first: LabelBox, second: LabelBox): boolean {
  const padding = 12;
  return (
    first.left < second.right + padding &&
    first.right + padding > second.left &&
    first.top < second.bottom + padding &&
    first.bottom + padding > second.top
  );
}

function estimateLabelWidth(item: HillchartItem): number {
  const titleWidth = item.name.trim().length * 11.5;

  return clamp(titleWidth + 26, 128, 300);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function sanitizeItems(value: unknown): HillchartItem[] {
  if (!Array.isArray(value)) {
    return createEmptyItems();
  }

  const items = value
    .slice(0, maxItems)
    .map((item, index) => sanitizeItem(item, index + 1));

  return items.length > 0 ? items : createEmptyItems();
}

function sanitizeItem(value: unknown, index: number): HillchartItem {
  if (!value || typeof value !== "object") {
    return createTaskItem(index);
  }

  const candidate = value as Partial<HillchartItem>;
  return {
    id: typeof candidate.id === "string" && candidate.id.length > 0 ? candidate.id : createTaskId(),
    name: typeof candidate.name === "string" ? candidate.name : "",
    percentage: clampPercentage(Number(candidate.percentage)),
  };
}

function defaultPercentageForIndex(index: number): number {
  return index === 1 ? 20 : Math.min(100, 20 + (index - 1) * 8);
}

function createTaskId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
