import { useEffect, useMemo, useRef, useState } from "react";
import {
  buildHillPath,
  buildLabelLayouts,
  chartBounds,
  clampPercentage,
  createEmptyItems,
  createTaskItem,
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
    return "#5f6d99";
  }
  if (percentage < 50) {
    return "#4f83a7";
  }
  if (percentage < 60) {
    return "#dda72e";
  }

  return "#2f9c96";
}

function App() {
  const [title, setTitle] = useState(loadTitle);
  const [items, setItems] = useState<HillchartItem[]>(loadItems);
  const [exportStatus, setExportStatus] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const chartRef = useRef<SVGSVGElement>(null);
  const visibleItems = items.filter((item) => item.name.trim().length > 0);
  const hillPath = useMemo(() => buildHillPath(), []);

  useEffect(() => {
    window.localStorage.setItem(itemsStorageKey, JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    window.localStorage.setItem(titleStorageKey, sanitizeTitle(title));
  }, [title]);

  function updateItem(id: string, patch: Partial<HillchartItem>) {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  }

  function addItem() {
    setItems((current) => {
      if (current.length >= maxItems) {
        return current;
      }

      return [...current, createTaskItem(current.length + 1)];
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
            Enter up to eight tasks, then use percentages to position them from unknowns on
            the left through execution on the right.
          </p>
        </div>
        <div className="hero-actions">
          <button className="secondary-button" type="button" onClick={exportChart} disabled={isExporting}>
            {isExporting ? "Exporting..." : "Copy PNG"}
          </button>
          <button className="secondary-button" type="button" onClick={resetChart}>
            Reset chart
          </button>
        </div>
      </section>

      {exportStatus ? <p className="export-status">{exportStatus}</p> : null}

      <section className="workspace" aria-label="Hillchart editor">
        <form className="editor" aria-label="Task inputs">
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
            <h2>Tasks</h2>
            <span>{items.length} / {maxItems} tasks</span>
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
                  placeholder="Task name"
                  onChange={(event) => updateItem(item.id, { name: event.target.value })}
                />
              </label>
              <label className="field-group percent-number-field">
                <span>Percentage</span>
                <input
                  className="number-input"
                  aria-label={`Percentage for task ${index + 1}`}
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
                className="remove-task-button"
                type="button"
                onClick={() => removeItem(item.id)}
                disabled={items.length <= 1}
                aria-label={`Remove task ${index + 1}`}
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
            Add task
          </button>
        </form>

        <section className="chart-card" aria-label="Hillchart preview">
          <HillChart
            ref={chartRef}
            title={sanitizeTitle(title)}
            items={visibleItems}
            hillPath={hillPath}
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
}: {
  ref: React.Ref<SVGSVGElement>;
  title: string;
  items: HillchartItem[];
  hillPath: string;
}) {
  const labelLayouts = useMemo(() => buildLabelLayouts(items), [items]);

  return (
    <svg
      ref={ref}
      className="hill-chart"
      viewBox="0 0 1376 768"
      role="img"
      aria-labelledby="chart-title chart-desc"
    >
      <title id="chart-title">Project hillchart</title>
      <desc id="chart-desc">Task names are positioned along a hill curve based on percentage complete.</desc>

      <defs>
        <linearGradient id="hill-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#667196" />
          <stop offset="48%" stopColor="#c49a3d" />
          <stop offset="58%" stopColor="#d9a332" />
          <stop offset="100%" stopColor="#2f9c96" />
        </linearGradient>
        <linearGradient id="wash" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fff6e4" />
          <stop offset="48%" stopColor="#fffdf9" />
          <stop offset="100%" stopColor="#e9fbff" />
        </linearGradient>
      </defs>

      <rect width="1376" height="768" rx="0" fill="url(#wash)" />
      <line x1="40" y1="80" x2="1336" y2="80" stroke="#d7dde6" strokeWidth="1.5" />
      <line
        x1={chartBounds.center}
        y1="166"
        x2={chartBounds.center}
        y2="690"
        stroke="#d1d7df"
        strokeWidth="1.2"
      />
      <line
        x1="40"
        y1={chartBounds.baseline + 8}
        x2="1336"
        y2={chartBounds.baseline + 8}
        stroke="#d7dde6"
        strokeWidth="1.5"
      />

      <text
        x="688"
        y="55"
        textAnchor="middle"
        fill="#1f2a3d"
        fontFamily="Inter, Arial, sans-serif"
        fontSize="30"
        fontWeight="500"
        letterSpacing="-0.02em"
      >
        {title}
      </text>

      <path
        d={hillPath}
        fill="none"
        stroke="rgba(39, 47, 66, 0.16)"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="10"
        transform="translate(0 2)"
      />
      <path
        d={hillPath}
        fill="none"
        stroke="url(#hill-gradient)"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="6"
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
          Add a task name to show it on the chart
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
              opacity="0.7"
            />
            <circle cx={point.x} cy={point.y} r="15" fill="#ffffff" opacity="0.95" />
            <circle cx={point.x} cy={point.y} r="12" fill={color} />
            <Label
              x={layout.labelX}
              y={layout.labelY}
              anchor={layout.textAnchor}
              color={color}
              item={item}
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
}: {
  x: number;
  y: number;
  anchor: "start" | "middle" | "end";
  color: string;
  item: HillchartItem;
}) {
  return (
    <g>
      <text
        x={x}
        y={y}
        textAnchor={anchor}
        fill={color}
        fontFamily="Inter, Arial, sans-serif"
        fontSize="20"
        fontWeight="800"
      >
        {item.name}
      </text>
    </g>
  );
}

export default App;
