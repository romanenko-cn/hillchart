import { useMemo, useRef } from "react";
import {
  buildHillPath,
  buildLabelLayouts,
  chartBounds,
  getPercentageFromHillX,
  type HillchartItem,
} from "./hillchart";
import { buildStarPoints, type DotShape } from "./dotShape";
import { rebelLoonDataUrl } from "./assets/rebelLoonDataUrl";

export const chartImageWidth = 1376;
export const chartImageHeight = 768;

export function markerColor(percentage: number): string {
  if (percentage < 34) {
    return "#6371a6";
  }
  if (percentage < 50) {
    return "#5387b7";
  }
  if (percentage < 60) {
    return "#c89b2f";
  }

  return "#35a4a2";
}

export function HillChart({
  ref,
  title,
  items,
  hillPath,
  dotShape,
  onManualLabelChange,
  onMilestoneDrag,
  onMilestoneDragEnd,
}: {
  ref?: React.Ref<SVGSVGElement>;
  title: string;
  items: HillchartItem[];
  hillPath?: string;
  dotShape: DotShape;
  onManualLabelChange?: (id: string, position: { x: number; y: number }) => void;
  onMilestoneDrag?: (id: string, percentage: number) => void;
  onMilestoneDragEnd?: (id: string, startPercentage: number, endPercentage: number) => void;
}) {
  const labelLayouts = useMemo(() => buildLabelLayouts(items), [items]);
  const resolvedHillPath = useMemo(() => hillPath ?? buildHillPath(), [hillPath]);
  const activePointerRef = useRef<{ itemId: string; pointerId: number } | null>(null);
  const activeDotPointerRef = useRef<{
    itemId: string;
    pointerId: number;
    startPercentage: number;
    latestPercentage: number;
  } | null>(null);

  function projectPointerToSvgCoordinates(event: React.PointerEvent<SVGElement>) {
    const svg = event.currentTarget.ownerSVGElement;
    if (!svg) {
      return null;
    }

    const rect = svg.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      return null;
    }

    const { width, height } = svg.viewBox.baseVal;
    return {
      x: ((event.clientX - rect.left) / rect.width) * width,
      y: ((event.clientY - rect.top) / rect.height) * height,
    };
  }

  function updateDotDragFromPointer(item: HillchartItem, event: React.PointerEvent<SVGElement>) {
    const coordinates = projectPointerToSvgCoordinates(event);
    if (!coordinates) {
      return;
    }

    const percentage = getPercentageFromHillX(coordinates.x);
    if (activeDotPointerRef.current?.itemId === item.id) {
      activeDotPointerRef.current.latestPercentage = percentage;
    }
    onMilestoneDrag?.(item.id, percentage);
  }

  function handleLabelPointerDown(item: HillchartItem, event: React.PointerEvent<SVGTextElement>) {
    event.preventDefault();
    activePointerRef.current = {
      itemId: item.id,
      pointerId: event.pointerId,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    const coordinates = projectPointerToSvgCoordinates(event);
    if (coordinates) {
      onManualLabelChange?.(item.id, coordinates);
    }
  }

  function handleLabelPointerMove(item: HillchartItem, event: React.PointerEvent<SVGTextElement>) {
    if (
      !activePointerRef.current ||
      activePointerRef.current.itemId !== item.id ||
      activePointerRef.current.pointerId !== event.pointerId
    ) {
      return;
    }

    const coordinates = projectPointerToSvgCoordinates(event);
    if (coordinates) {
      onManualLabelChange?.(item.id, coordinates);
    }
  }

  function handleLabelPointerEnd(item: HillchartItem, event: React.PointerEvent<SVGTextElement>) {
    if (
      activePointerRef.current &&
      activePointerRef.current.itemId === item.id &&
      activePointerRef.current.pointerId === event.pointerId
    ) {
      activePointerRef.current = null;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function handleDotPointerDown(item: HillchartItem, event: React.PointerEvent<SVGCircleElement>) {
    event.preventDefault();
    activeDotPointerRef.current = {
      itemId: item.id,
      pointerId: event.pointerId,
      startPercentage: item.percentage,
      latestPercentage: item.percentage,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    updateDotDragFromPointer(item, event);
  }

  function handleDotPointerMove(item: HillchartItem, event: React.PointerEvent<SVGCircleElement>) {
    if (
      !activeDotPointerRef.current ||
      activeDotPointerRef.current.itemId !== item.id ||
      activeDotPointerRef.current.pointerId !== event.pointerId
    ) {
      return;
    }

    updateDotDragFromPointer(item, event);
  }

  function handleDotPointerEnd(item: HillchartItem, event: React.PointerEvent<SVGCircleElement>) {
    if (
      activeDotPointerRef.current &&
      activeDotPointerRef.current.itemId === item.id &&
      activeDotPointerRef.current.pointerId === event.pointerId
    ) {
      onMilestoneDragEnd?.(
        item.id,
        activeDotPointerRef.current.startPercentage,
        activeDotPointerRef.current.latestPercentage,
      );
      activeDotPointerRef.current = null;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  return (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      className="hill-chart"
      viewBox={`0 0 ${chartImageWidth} ${chartImageHeight}`}
      role="img"
      aria-labelledby="chart-title chart-desc"
    >
      <title id="chart-title">Project hillchart</title>
      <desc id="chart-desc">Milestone names are positioned along a hill curve based on percentage complete.</desc>

      <defs>
        <linearGradient id="hill-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#66739f" />
          <stop offset="28%" stopColor="#8c92af" />
          <stop offset="49%" stopColor="#c8992d" />
          <stop offset="60%" stopColor="#b8a24a" />
          <stop offset="100%" stopColor="#34a4a3" />
        </linearGradient>
        <linearGradient id="wash" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fbf1d9" />
          <stop offset="44%" stopColor="#fbfaf7" />
          <stop offset="100%" stopColor="#e2f3f7" />
        </linearGradient>
        <radialGradient id="left-glow" cx="0%" cy="20%" r="70%">
          <stop offset="0%" stopColor="rgba(247, 221, 167, 0.6)" />
          <stop offset="100%" stopColor="rgba(247, 221, 167, 0)" />
        </radialGradient>
        <radialGradient id="right-glow" cx="100%" cy="100%" r="78%">
          <stop offset="0%" stopColor="rgba(177, 230, 236, 0.6)" />
          <stop offset="100%" stopColor="rgba(177, 230, 236, 0)" />
        </radialGradient>
        <filter id="soft-shadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#3f5573" floodOpacity="0.12" />
        </filter>
        <filter id="curve-shadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#53627f" floodOpacity="0.18" />
        </filter>
      </defs>

      <rect width="1376" height="768" rx="0" fill="url(#wash)" />
      <rect width="1376" height="768" rx="0" fill="url(#left-glow)" opacity="0.75" />
      <rect width="1376" height="768" rx="0" fill="url(#right-glow)" opacity="0.75" />
      <line x1="76" y1="104" x2="1300" y2="104" stroke="#d7dde6" strokeWidth="1.5" />
      <line
        x1={chartBounds.center}
        y1="182"
        x2={chartBounds.center}
        y2="690"
        stroke="#dde4ea"
        strokeWidth="1.4"
      />
      <line
        x1="40"
        y1={chartBounds.baseline + 8}
        x2="1336"
        y2={chartBounds.baseline + 8}
        stroke="#dbe3ea"
        strokeWidth="1.5"
      />

      <text
        x="688"
        y="82"
        textAnchor="middle"
        fill="#24334b"
        fontFamily="Inter, Arial, sans-serif"
        fontSize="31"
        fontWeight="500"
        letterSpacing="-0.03em"
      >
        {title}
      </text>

      <path
        d={resolvedHillPath}
        fill="none"
        stroke="rgba(73, 84, 109, 0.12)"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="10"
        transform="translate(0 2)"
        filter="url(#curve-shadow)"
      />
      <path
        d={resolvedHillPath}
        fill="none"
        stroke="url(#hill-gradient)"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="5.5"
      />

      {items.length === 0 ? (
        <text
          x="688"
          y="392"
          textAnchor="middle"
          fill="#748096"
          fontFamily="Inter, Arial, sans-serif"
          fontSize="22"
          fontWeight="700"
        >
          Add a milestone name to show it on the chart
        </text>
      ) : null}

      {labelLayouts.map((layout) => {
        const { item, point } = layout;
        const color = item.color ?? markerColor(item.percentage);

        return (
          <g key={item.id}>
            <path
              d={layout.leaderPath}
              stroke={color}
              strokeWidth="3"
              fill="none"
              opacity="0.62"
            />
            <Marker shape={dotShape} x={point.x} y={point.y} color={color} itemId={item.id} />
            <circle
              className="milestone-dot-hit-target"
              data-dot-id={item.id}
              aria-label={`Drag ${item.name} milestone dot`}
              cx={point.x}
              cy={point.y}
              r="26"
              fill="transparent"
              onPointerDown={(event) => handleDotPointerDown(item, event)}
              onPointerMove={(event) => handleDotPointerMove(item, event)}
              onPointerUp={(event) => handleDotPointerEnd(item, event)}
              onPointerCancel={(event) => handleDotPointerEnd(item, event)}
            />
            <Label
              x={layout.labelX}
              y={layout.labelY}
              anchor={layout.textAnchor}
              color={color}
              item={item}
              onPointerDown={handleLabelPointerDown}
              onPointerMove={handleLabelPointerMove}
              onPointerUp={handleLabelPointerEnd}
              onPointerCancel={handleLabelPointerEnd}
            />
          </g>
        );
      })}
    </svg>
  );
}

function Marker({
  shape,
  x,
  y,
  color,
  itemId,
}: {
  shape: DotShape;
  x: number;
  y: number;
  color: string;
  itemId: string;
}) {
  if (shape === "rebel-loon") {
    return (
      <g data-marker-id={itemId} data-marker-shape="rebel-loon" filter="url(#soft-shadow)">
        <circle cx={x} cy={y} r="18" fill="#ffffff" opacity="0.96" />
        <image
          href={rebelLoonDataUrl}
          x={x - 16}
          y={y - 16}
          width="32"
          height="32"
          preserveAspectRatio="xMidYMid meet"
        />
      </g>
    );
  }

  if (shape === "star") {
    return (
      <g data-marker-id={itemId} data-marker-shape="star" filter="url(#soft-shadow)">
        <polygon points={buildStarPoints(x, y, 18, 8.5)} fill="#ffffff" opacity="0.96" />
        <polygon points={buildStarPoints(x, y, 15, 7)} fill={color} />
      </g>
    );
  }

  return (
    <g data-marker-id={itemId} data-marker-shape="dot" filter="url(#soft-shadow)">
      <circle cx={x} cy={y} r="15" fill="#ffffff" opacity="0.96" />
      <circle cx={x} cy={y} r="12.5" fill={color} />
    </g>
  );
}

function Label({
  x,
  y,
  anchor,
  color,
  item,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
}: {
  x: number;
  y: number;
  anchor: "start" | "middle" | "end";
  color: string;
  item: HillchartItem;
  onPointerDown: (item: HillchartItem, event: React.PointerEvent<SVGTextElement>) => void;
  onPointerMove: (item: HillchartItem, event: React.PointerEvent<SVGTextElement>) => void;
  onPointerUp: (item: HillchartItem, event: React.PointerEvent<SVGTextElement>) => void;
  onPointerCancel: (item: HillchartItem, event: React.PointerEvent<SVGTextElement>) => void;
}) {
  return (
    <g>
      <text
        className={item.manualLabelPosition ? "chart-label chart-label-manual" : "chart-label"}
        data-label-id={item.id}
        x={x}
        y={y}
        textAnchor={anchor}
        fill={color}
        fontFamily="Inter, Arial, sans-serif"
        fontSize="20"
        fontWeight="800"
        letterSpacing="-0.02em"
        onPointerDown={(event) => onPointerDown(item, event)}
        onPointerMove={(event) => onPointerMove(item, event)}
        onPointerUp={(event) => onPointerUp(item, event)}
        onPointerCancel={(event) => onPointerCancel(item, event)}
      >
        {item.name}
      </text>
    </g>
  );
}
