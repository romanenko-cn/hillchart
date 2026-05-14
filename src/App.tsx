import { useEffect, useMemo, useRef, useState } from "react";
import {
  buildHillPath,
  buildLabelLayouts,
  chartBounds,
  clampManualLabelPosition,
  clampPercentage,
  createEmptyItems,
  createMilestoneItem,
  defaultChartTitle,
  maxItems,
  type HillchartItem,
  sanitizeItems,
  sanitizeTitle,
} from "./hillchart";
import { copySvgChartAsPng, sanitizeImageFilename } from "./imageExport";
import "./App.css";

const itemsStorageKey = "hillchart.items.v1";
const titleStorageKey = "hillchart.title.v1";
const placementGuidelines = [
  "0-35: still figuring out the problem or approach",
  "36-49: approaching clarity, but important unknowns remain",
  "50: crest; path is clear",
  "51-69: implementation path is known, but meaningful execution remains",
  "70-84: implementation is largely in place and the scope is in review / QA / stabilization",
  "85-94: QA has meaningfully exercised it and remaining work is mostly bug fixes / hardening",
  "95-100: effectively done, accepted, or only trivial wrap-up remains",
];

function loadItems(): HillchartItem[] {
  if (typeof window === "undefined") {
    return createEmptyItems();
  }

  try {
    const stored = window.localStorage.getItem(itemsStorageKey);
    return stored ? sanitizeItems(JSON.parse(stored)) : createEmptyItems();
  } catch {
    return createEmptyItems();
  }
}

function loadTitle(): string {
  if (typeof window === "undefined") {
    return defaultChartTitle;
  }

  return sanitizeTitle(window.localStorage.getItem(titleStorageKey));
}

function markerColor(percentage: number): string {
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

function App() {
  const [title, setTitle] = useState(loadTitle);
  const [items, setItems] = useState<HillchartItem[]>(loadItems);
  const [exportStatus, setExportStatus] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const chartRef = useRef<SVGSVGElement>(null);
  const visibleItems = items.filter((item) => item.name.trim().length > 0);
  const hasManualLabelOverrides = items.some((item) => item.manualLabelPosition);
  const hillPath = useMemo(() => buildHillPath(), []);

  useEffect(() => {
    window.localStorage.setItem(itemsStorageKey, JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    window.localStorage.setItem(titleStorageKey, sanitizeTitle(title));
  }, [title]);

  function updateItem(id: string, patch: Partial<HillchartItem>) {
    setItems((current) =>
      current.map((item) => {
        if (item.id !== id) {
          return item;
        }

        const nextItem = { ...item, ...patch };
        if (patch.percentage !== undefined && patch.percentage !== item.percentage) {
          nextItem.manualLabelPosition = undefined;
        }

        return nextItem;
      }),
    );
  }

  function updateManualLabelPosition(id: string, position: { x: number; y: number }) {
    setItems((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              manualLabelPosition: clampManualLabelPosition(item, position),
            }
          : item,
      ),
    );
  }

  function resetManualLabelPosition(id: string) {
    updateItem(id, { manualLabelPosition: undefined });
  }

  function resetAllManualLabelPositions() {
    setItems((current) =>
      current.map((item) => ({
        ...item,
        manualLabelPosition: undefined,
      })),
    );
  }

  function addItem() {
    setItems((current) => {
      if (current.length >= maxItems) {
        return current;
      }

      return [...current, createMilestoneItem(current.length + 1)];
    });
  }

  function removeItem(id: string) {
    setItems((current) => {
      if (current.length <= 1) {
        return current;
      }

      return current.filter((item) => item.id !== id);
    });
  }

  function resetChart() {
    setTitle(defaultChartTitle);
    setItems(createEmptyItems());
    window.localStorage.removeItem(itemsStorageKey);
    window.localStorage.removeItem(titleStorageKey);
  }

  async function exportChart() {
    if (!chartRef.current) {
      setExportStatus("Chart is not ready to export.");
      return;
    }

    setIsExporting(true);
    setExportStatus("");

    try {
      const result = await copySvgChartAsPng(
        chartRef.current,
        sanitizeImageFilename(sanitizeTitle(title)),
      );
      setExportStatus(
        result === "copied"
          ? "PNG image copied to clipboard."
          : "Clipboard image copy is unavailable, so the PNG was downloaded.",
      );
    } catch (error) {
      setExportStatus(error instanceof Error ? error.message : "Unable to export image.");
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">Hillchart Builder</p>
          <h1>Create and update project hillcharts</h1>
          <p className="intro">
            Enter up to ten milestones, then use percentages to position them from unknowns
            on the left through execution on the right.
          </p>
        </div>
        <div className="hero-actions">
          <button className="secondary-button" type="button" onClick={exportChart} disabled={isExporting}>
            {isExporting ? "Exporting..." : "Copy PNG"}
          </button>
          <button
            className="secondary-button"
            type="button"
            onClick={resetAllManualLabelPositions}
            disabled={!hasManualLabelOverrides}
          >
            Reset labels
          </button>
          <button className="secondary-button" type="button" onClick={resetChart}>
            Reset chart
          </button>
        </div>
      </section>

      {exportStatus ? <p className="export-status">{exportStatus}</p> : null}

      <section className="workspace" aria-label="Hillchart editor">
        <form className="editor" aria-label="Milestone inputs">
          <label className="title-editor">
            <span>Chart title</span>
            <input
              type="text"
              value={title}
              maxLength={96}
              placeholder={defaultChartTitle}
              onChange={(event) => setTitle(event.target.value)}
              onBlur={() => setTitle((current) => sanitizeTitle(current))}
            />
          </label>

          <div className="editor-heading">
            <h2>Milestones</h2>
            <span>{items.length} / {maxItems} milestones</span>
          </div>

          {items.map((item, index) => (
            <div className="task-row" key={item.id}>
              <span className="row-index">{index + 1}</span>
              <label className="field-group">
                <span>Name</span>
                <input
                  type="text"
                  value={item.name}
                  maxLength={72}
                  placeholder="Milestone name"
                  onChange={(event) => updateItem(item.id, { name: event.target.value })}
                />
              </label>
              <label className="field-group percent-number-field">
                <span>Percentage</span>
                <input
                  className="number-input"
                  aria-label={`Percentage for milestone ${index + 1}`}
                  type="number"
                  min="0"
                  max="100"
                  value={item.percentage}
                  onChange={(event) =>
                    updateItem(item.id, {
                      percentage: clampPercentage(Number(event.target.value)),
                    })
                  }
                />
              </label>
              <button
                className="label-reset-button"
                type="button"
                onClick={() => resetManualLabelPosition(item.id)}
                disabled={!item.manualLabelPosition}
                aria-label={`Reset label position for milestone ${index + 1}`}
              >
                Auto
              </button>
              <button
                className="remove-task-button"
                type="button"
                onClick={() => removeItem(item.id)}
                disabled={items.length <= 1}
                aria-label={`Remove milestone ${index + 1}`}
              >
                ×
              </button>
            </div>
          ))}

          <button
            className="add-task-button"
            type="button"
            onClick={addItem}
            disabled={items.length >= maxItems}
          >
            Add milestone
          </button>

          <section className="helper-card" aria-label="Placement guide">
            <p className="helper-title">Placement guide</p>
            <p className="helper-intro">Use these rough percentage ranges when placing milestones on the hill.</p>
            <ul className="helper-list">
              {placementGuidelines.map((guideline) => (
                <li key={guideline}>{guideline}</li>
              ))}
            </ul>
          </section>
        </form>

        <section className="chart-card" aria-label="Hillchart preview">
          <HillChart
            ref={chartRef}
            title={sanitizeTitle(title)}
            items={visibleItems}
            hillPath={hillPath}
            onManualLabelChange={updateManualLabelPosition}
          />
        </section>
      </section>
    </main>
  );
}

function HillChart({
  ref,
  title,
  items,
  hillPath,
  onManualLabelChange,
}: {
  ref: React.Ref<SVGSVGElement>;
  title: string;
  items: HillchartItem[];
  hillPath: string;
  onManualLabelChange: (id: string, position: { x: number; y: number }) => void;
}) {
  const labelLayouts = useMemo(() => buildLabelLayouts(items), [items]);
  const activePointerRef = useRef<{ itemId: string; pointerId: number } | null>(null);

  function projectPointerToSvgCoordinates(event: React.PointerEvent<SVGTextElement>) {
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

  function handleLabelPointerDown(item: HillchartItem, event: React.PointerEvent<SVGTextElement>) {
    event.preventDefault();
    activePointerRef.current = {
      itemId: item.id,
      pointerId: event.pointerId,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    const coordinates = projectPointerToSvgCoordinates(event);
    if (coordinates) {
      onManualLabelChange(item.id, coordinates);
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
      onManualLabelChange(item.id, coordinates);
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

  return (
    <svg
      ref={ref}
      className="hill-chart"
      viewBox="0 0 1376 768"
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
        d={hillPath}
        fill="none"
        stroke="rgba(73, 84, 109, 0.12)"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="10"
        transform="translate(0 2)"
        filter="url(#curve-shadow)"
      />
      <path
        d={hillPath}
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
        const color = markerColor(item.percentage);

        return (
          <g key={item.id}>
            <path
              d={`M ${point.x} ${layout.leaderStartY} V ${layout.leaderEndY} H ${layout.leaderEndX}`}
              stroke={color}
              strokeWidth="3"
              fill="none"
              opacity="0.62"
            />
            <circle
              cx={point.x}
              cy={point.y}
              r="15"
              fill="#ffffff"
              opacity="0.96"
              filter="url(#soft-shadow)"
            />
            <circle cx={point.x} cy={point.y} r="12.5" fill={color} />
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

export default App;
