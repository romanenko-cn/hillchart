export const dotShapeStorageKey = "hillchart.dotShape.v1";

export const dotShapes = ["dot", "star", "rebel-loon"] as const;

export type DotShape = (typeof dotShapes)[number];

export function isDotShape(value: unknown): value is DotShape {
  return typeof value === "string" && dotShapes.includes(value as DotShape);
}

export function loadDotShape(): DotShape {
  if (typeof window === "undefined") {
    return "dot";
  }

  try {
    const stored = window.localStorage.getItem(dotShapeStorageKey);
    return isDotShape(stored) ? stored : "dot";
  } catch {
    return "dot";
  }
}

export function buildStarPoints(
  centerX: number,
  centerY: number,
  outerRadius: number,
  innerRadius: number,
): string {
  return Array.from({ length: 10 }, (_, index) => {
    const radius = index % 2 === 0 ? outerRadius : innerRadius;
    const angle = -Math.PI / 2 + (index * Math.PI) / 5;
    const x = centerX + Math.cos(angle) * radius;
    const y = centerY + Math.sin(angle) * radius;

    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(" ");
}
