import { useEffect, useMemo, useRef, useState } from "react";
import {
  buildHillPath,
  clampManualLabelPosition,
  clampPercentage,
  createEmptyItems,
  createMilestoneItem,
  defaultChartTitle,
  maxItems,
  type HillchartItem,
  sanitizeTitle,
} from "./hillchart";
import { copySvgChartAsPng, sanitizeImageFilename } from "./imageExport";
import { HillChart } from "./ChartSvg";
import { dotShapes, isDotShape, type DotShape } from "./dotShape";
import {
  createProject,
  loadProjectStore,
  saveProjectStore,
  type HillchartProject,
} from "./projects";
import "./App.css";

declare global {
  interface Window {
    hillchart: {
      setDotShape: (shape: string) => DotShape;
      getDotShape: () => DotShape;
      dotShapes: readonly DotShape[];
    };
  }
}

const placementGuidelines = [
  "0-35: still figuring out the problem or approach",
  "36-49: approaching clarity, but important unknowns remain",
  "50: crest; path is clear",
  "51-69: implementation path is known, but meaningful execution remains",
  "70-84: implementation is largely in place and the scope is in review / QA / stabilization",
  "85-94: QA has meaningfully exercised it and remaining work is mostly bug fixes / hardening",
  "95-100: effectively done, accepted, or only trivial wrap-up remains",
];

function App() {
  const [projectStore, setProjectStore] = useState(loadProjectStore);
  const [exportStatus, setExportStatus] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const chartRef = useRef<SVGSVGElement>(null);
  const activeProject =
    projectStore.projects.find((project) => project.id === projectStore.activeProjectId) ?? null;
  const title = activeProject?.title ?? defaultChartTitle;
  const items = activeProject?.items ?? [];
  const dotShape = activeProject?.dotShape ?? "dot";
  const visibleItems = items.filter((item) => item.name.trim().length > 0);
  const hasManualLabelOverrides = items.some((item) => item.manualLabelPosition);
  const hillPath = useMemo(() => buildHillPath(), []);

  useEffect(() => {
    saveProjectStore(projectStore);
  }, [projectStore]);

  useEffect(() => {
    const api = {
      setDotShape(shape: string) {
        if (!isDotShape(shape)) {
          throw new RangeError(
            `Unknown dot shape "${shape}". Use one of: ${dotShapes.join(", ")}.`,
          );
        }

        updateActiveProject({ dotShape: shape });
        return shape;
      },
      getDotShape: () => dotShape,
      dotShapes,
    };

    window.hillchart = api;

    return () => {
      if (window.hillchart === api) {
        delete (window as Partial<Window>).hillchart;
      }
    };
  }, [activeProject?.id, dotShape]);

  function updateActiveProject(
    patch:
      | Partial<Omit<HillchartProject, "id">>
      | ((project: HillchartProject) => HillchartProject),
  ) {
    setProjectStore((current) => ({
      ...current,
      projects: current.projects.map((project) => {
        if (project.id !== current.activeProjectId) {
          return project;
        }

        return typeof patch === "function" ? patch(project) : { ...project, ...patch };
      }),
    }));
  }

  function setItems(
    updater: HillchartItem[] | ((current: HillchartItem[]) => HillchartItem[]),
  ) {
    updateActiveProject((project) => ({
      ...project,
      items: typeof updater === "function" ? updater(project.items) : updater,
    }));
  }

  function createNewProject() {
    const project = createProject();
    setProjectStore((current) => ({
      ...current,
      activeProjectId: project.id,
      projects: [...current.projects, project],
    }));
    setExportStatus("");
  }

  function deleteActiveProject() {
    if (
      !activeProject ||
      !window.confirm(`Delete "${activeProject.title}"? This cannot be undone.`)
    ) {
      return;
    }

    setProjectStore((current) => {
      const deletedIndex = current.projects.findIndex(
        (project) => project.id === current.activeProjectId,
      );
      if (deletedIndex < 0) {
        return current;
      }

      const projects = current.projects.filter(
        (project) => project.id !== current.activeProjectId,
      );
      const nextProject = projects[Math.min(deletedIndex, projects.length - 1)];

      return {
        ...current,
        activeProjectId: nextProject?.id ?? null,
        projects,
      };
    });
    setExportStatus("");
  }

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

  function updatePercentageDuringDotDrag(id: string, percentage: number) {
    setItems((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              percentage,
            }
          : item,
      ),
    );
  }

  function finishDotDrag(id: string, startPercentage: number, endPercentage: number) {
    if (startPercentage === endPercentage) {
      return;
    }

    setItems((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              manualLabelPosition: undefined,
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
    updateActiveProject({
      title: defaultChartTitle,
      items: createEmptyItems(),
      dotShape: "dot",
    });
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
          <button
            className="secondary-button"
            type="button"
            onClick={exportChart}
            disabled={isExporting || !activeProject}
          >
            {isExporting ? "Exporting..." : "Copy PNG"}
          </button>
          <button
            className="secondary-button"
            type="button"
            onClick={resetAllManualLabelPositions}
            disabled={!activeProject || !hasManualLabelOverrides}
          >
            Reset labels
          </button>
          <button
            className="secondary-button"
            type="button"
            onClick={resetChart}
            disabled={!activeProject}
          >
            Reset chart
          </button>
        </div>
      </section>

      {exportStatus ? <p className="export-status">{exportStatus}</p> : null}

      <section className="project-toolbar" aria-label="Project controls">
        <label className="project-selector">
          <span>Project</span>
          <select
            value={activeProject?.id ?? ""}
            onChange={(event) => {
              setProjectStore((current) => ({
                ...current,
                activeProjectId: event.target.value,
              }));
              setExportStatus("");
            }}
            disabled={projectStore.projects.length === 0}
          >
            {projectStore.projects.length === 0 ? <option value="">No projects</option> : null}
            {projectStore.projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.title}
              </option>
            ))}
          </select>
        </label>
        <div className="project-actions">
          <button className="project-create-button" type="button" onClick={createNewProject}>
            New project
          </button>
          <button
            className="project-delete-button"
            type="button"
            onClick={deleteActiveProject}
            disabled={!activeProject}
          >
            Delete project
          </button>
        </div>
      </section>

      {activeProject ? (
      <section className="workspace" aria-label="Hillchart editor">
        <form className="editor" aria-label="Milestone inputs">
          <label className="title-editor">
            <span>Project title</span>
            <input
              type="text"
              value={title}
              maxLength={96}
              placeholder={defaultChartTitle}
              onChange={(event) => updateActiveProject({ title: event.target.value })}
              onBlur={() => updateActiveProject({ title: sanitizeTitle(title) })}
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
            dotShape={dotShape}
            onManualLabelChange={updateManualLabelPosition}
            onMilestoneDrag={updatePercentageDuringDotDrag}
            onMilestoneDragEnd={finishDotDrag}
          />
        </section>
      </section>
      ) : (
        <section className="projects-empty-state" aria-label="No projects">
          <p className="eyebrow">No projects</p>
          <h2>Create a project to start a hillchart</h2>
          <p>Your projects are saved automatically in this browser.</p>
          <button className="project-create-button" type="button" onClick={createNewProject}>
            Create project
          </button>
        </section>
      )}
    </main>
  );
}

export default App;
