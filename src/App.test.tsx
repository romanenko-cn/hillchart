import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

const itemsStorageKey = "hillchart.items.v1";
const titleStorageKey = "hillchart.title.v1";
const dotShapeStorageKey = "hillchart.dotShape.v1";
const projectsStorageKey = "hillchart.projects.v1";

const pointerCaptures = new WeakMap<Element, Set<number>>();
const storage = createStorageMock();

beforeAll(() => {
  Object.defineProperty(window, "localStorage", {
    value: storage,
    configurable: true,
  });

  Object.defineProperty(globalThis, "PointerEvent", {
    value: MouseEvent,
    configurable: true,
  });

  Object.defineProperty(SVGElement.prototype, "setPointerCapture", {
    value(pointerId: number) {
      const active = pointerCaptures.get(this) ?? new Set<number>();
      active.add(pointerId);
      pointerCaptures.set(this, active);
    },
    configurable: true,
  });

  Object.defineProperty(SVGElement.prototype, "releasePointerCapture", {
    value(pointerId: number) {
      pointerCaptures.get(this)?.delete(pointerId);
    },
    configurable: true,
  });

  Object.defineProperty(SVGElement.prototype, "hasPointerCapture", {
    value(pointerId: number) {
      return pointerCaptures.get(this)?.has(pointerId) ?? false;
    },
    configurable: true,
  });
});

beforeEach(() => {
  storage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("App", () => {
  it("shows when and from which commit the app was built", () => {
    render(<App />);

    const commitLink = screen.getByRole("link", { name: __GIT_SHA__.slice(0, 7) });
    expect(commitLink.getAttribute("href")).toBe(__GIT_COMMIT_URL__);
    expect(
      screen.getByText(__BUILD_TIME__.replace("T", " ").replace(/\.\d{3}Z$/, " UTC")),
    ).not.toBeNull();
  });

  it("uses dot markers by default and exposes the available console settings", () => {
    seedChartState([{ id: "m1", name: "Milestone A", percentage: 20 }]);

    const { container } = render(<App />);

    expect(container.querySelector('[data-marker-shape="dot"]')).not.toBeNull();
    expect(container.querySelector('[data-marker-shape="star"]')).toBeNull();
    expect(window.hillchart.getDotShape()).toBe("dot");
    expect(window.hillchart.dotShapes).toEqual(["dot", "star", "rebel-loon"]);
  });

  it("changes marker shapes from the console API and persists the setting", () => {
    seedChartState([{ id: "m1", name: "Milestone A", percentage: 20 }]);

    const { container } = render(<App />);

    act(() => {
      expect(window.hillchart.setDotShape("star")).toBe("star");
    });

    const star = container.querySelector('[data-marker-shape="star"]');
    expect(star).not.toBeNull();
    expect(star?.querySelectorAll("polygon")).toHaveLength(2);
    expect(window.hillchart.getDotShape()).toBe("star");
    expect(readStoredProjects().projects[0].dotShape).toBe("star");
  });

  it("restores the persisted star shape on reopen", () => {
    seedChartState([{ id: "m1", name: "Milestone A", percentage: 20 }]);
    window.localStorage.setItem(dotShapeStorageKey, "star");

    const { container } = render(<App />);

    expect(container.querySelector('[data-marker-shape="star"]')).not.toBeNull();
    expect(window.hillchart.getDotShape()).toBe("star");
  });

  it("renders and persists the Rebel Loon marker from the console API", () => {
    seedChartState([{ id: "m1", name: "Milestone A", percentage: 20 }]);

    const { container } = render(<App />);

    act(() => {
      window.hillchart.setDotShape("rebel-loon");
    });

    const marker = container.querySelector('[data-marker-shape="rebel-loon"]');
    expect(marker).not.toBeNull();
    expect(marker?.querySelector("image")?.getAttribute("href")).toMatch(
      /^data:image\/svg\+xml;base64,/,
    );
    expect(readStoredProjects().projects[0].dotShape).toBe("rebel-loon");
  });

  it("rejects unknown console dot shapes without changing the current shape", () => {
    seedChartState([{ id: "m1", name: "Milestone A", percentage: 20 }]);

    const { container } = render(<App />);

    expect(() => window.hillchart.setDotShape("triangle")).toThrow(
      'Unknown dot shape "triangle". Use one of: dot, star, rebel-loon.',
    );
    expect(window.hillchart.getDotShape()).toBe("dot");
    expect(container.querySelector('[data-marker-shape="dot"]')).not.toBeNull();
  });

  it("restores persisted manual label positions on reopen", () => {
    seedChartState([
      {
        id: "m1",
        name: "Milestone A",
        percentage: 20,
        manualLabelPosition: { x: 480, y: 210 },
      },
    ]);

    render(<App />);

    const label = screen.getByText("Milestone A");
    expect(label.getAttribute("x")).toBe("480");
    expect(label.getAttribute("y")).toBe("210");
  });

  it("drags labels in SVG space and updates the leader line", () => {
    seedChartState([{ id: "m1", name: "Milestone A", percentage: 20 }]);

    const { container } = render(<App />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    mockSvgBounds(svg!);

    const label = screen.getByText("Milestone A");
    fireEvent.pointerDown(label, { pointerId: 1, clientX: 520, clientY: 220 });
    fireEvent.pointerMove(label, { pointerId: 1, clientX: 610, clientY: 240 });
    fireEvent.pointerUp(label, { pointerId: 1, clientX: 610, clientY: 240 });

    expect(label.getAttribute("x")).toBe("610");
    expect(label.getAttribute("y")).toBe("240");

    const leaderLine = container.querySelector('path[stroke-width="3"]');
    expect(leaderLine?.getAttribute("d")).toContain("H 610");
  });

  it("drags milestone dots along the hill and updates the percentage input", () => {
    seedChartState([
      { id: "m1", name: "Milestone A", percentage: 20 },
      { id: "m2", name: "Milestone B", percentage: 50 },
    ]);

    const { container } = render(<App />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    mockSvgBounds(svg!);

    const dot = container.querySelector('[data-dot-id="m1"]');
    expect(dot).not.toBeNull();

    fireEvent.pointerDown(dot!, { pointerId: 2, clientX: 299, clientY: 540 });
    fireEvent.pointerMove(dot!, { pointerId: 2, clientX: 558, clientY: 100 });
    fireEvent.pointerUp(dot!, { pointerId: 2, clientX: 558, clientY: 100 });

    expect((screen.getByLabelText("Percentage for milestone 1") as HTMLInputElement).value).toBe("40");
    expect((screen.getByLabelText("Percentage for milestone 2") as HTMLInputElement).value).toBe("50");

    const movedDot = container.querySelector('[data-dot-id="m1"]');
    expect(movedDot?.getAttribute("cx")).toBe("558.4");
  });

  it("keeps manual label position during dot drag and resets it on release", () => {
    seedChartState([
      {
        id: "m1",
        name: "Milestone A",
        percentage: 20,
        manualLabelPosition: { x: 480, y: 210 },
      },
    ]);

    const { container } = render(<App />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    mockSvgBounds(svg!);

    const label = screen.getByText("Milestone A");
    const resetButton = screen.getByRole("button", {
      name: "Reset label position for milestone 1",
    });
    const dot = container.querySelector('[data-dot-id="m1"]');
    expect(dot).not.toBeNull();

    fireEvent.pointerDown(dot!, { pointerId: 3, clientX: 299, clientY: 540 });
    fireEvent.pointerMove(dot!, { pointerId: 3, clientX: 558, clientY: 100 });

    expect(label.getAttribute("x")).toBe("480");
    expect(label.getAttribute("y")).toBe("210");
    expect(resetButton.hasAttribute("disabled")).toBe(false);

    fireEvent.pointerUp(dot!, { pointerId: 3, clientX: 558, clientY: 100 });

    expect((screen.getByLabelText("Percentage for milestone 1") as HTMLInputElement).value).toBe("40");
    expect(resetButton.hasAttribute("disabled")).toBe(true);
    expect(label.getAttribute("x")).not.toBe("480");
    expect(label.getAttribute("y")).not.toBe("210");
  });

  it("clamps dot dragging at chart boundaries", () => {
    seedChartState([{ id: "m1", name: "Milestone A", percentage: 50 }]);

    const { container } = render(<App />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    mockSvgBounds(svg!);

    const dot = container.querySelector('[data-dot-id="m1"]');
    expect(dot).not.toBeNull();

    fireEvent.pointerDown(dot!, { pointerId: 4, clientX: 688, clientY: 300 });
    fireEvent.pointerMove(dot!, { pointerId: 4, clientX: -200, clientY: 300 });
    fireEvent.pointerUp(dot!, { pointerId: 4, clientX: -200, clientY: 300 });
    expect((screen.getByLabelText("Percentage for milestone 1") as HTMLInputElement).value).toBe("0");

    const updatedDot = container.querySelector('[data-dot-id="m1"]');
    fireEvent.pointerDown(updatedDot!, { pointerId: 5, clientX: 40, clientY: 682 });
    fireEvent.pointerMove(updatedDot!, { pointerId: 5, clientX: 1600, clientY: 682 });
    fireEvent.pointerUp(updatedDot!, { pointerId: 5, clientX: 1600, clientY: 682 });
    expect((screen.getByLabelText("Percentage for milestone 1") as HTMLInputElement).value).toBe("100");
  });

  it("finalizes dot drag state on pointer cancel", () => {
    seedChartState([
      {
        id: "m1",
        name: "Milestone A",
        percentage: 20,
        manualLabelPosition: { x: 480, y: 210 },
      },
    ]);

    const { container } = render(<App />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    mockSvgBounds(svg!);

    const dot = container.querySelector('[data-dot-id="m1"]');
    expect(dot).not.toBeNull();

    fireEvent.pointerDown(dot!, { pointerId: 6, clientX: 299, clientY: 540 });
    fireEvent.pointerMove(dot!, { pointerId: 6, clientX: 558, clientY: 100 });
    fireEvent.pointerCancel(dot!, { pointerId: 6, clientX: 558, clientY: 100 });

    expect((screen.getByLabelText("Percentage for milestone 1") as HTMLInputElement).value).toBe("40");
    expect(
      screen
        .getByRole("button", { name: "Reset label position for milestone 1" })
        .hasAttribute("disabled"),
    ).toBe(true);
  });

  it("clears a manual override when the milestone percentage changes", () => {
    seedChartState([
      {
        id: "m1",
        name: "Milestone A",
        percentage: 20,
        manualLabelPosition: { x: 480, y: 210 },
      },
    ]);

    render(<App />);

    const resetButton = screen.getByRole("button", {
      name: "Reset label position for milestone 1",
    });
    expect(resetButton.hasAttribute("disabled")).toBe(false);

    fireEvent.change(screen.getByLabelText("Percentage for milestone 1"), {
      target: { value: "35" },
    });

    expect(resetButton.hasAttribute("disabled")).toBe(true);
  });

  it("resets all manual label overrides with one action", () => {
    seedChartState([
      {
        id: "m1",
        name: "Milestone A",
        percentage: 20,
        manualLabelPosition: { x: 480, y: 210 },
      },
      {
        id: "m2",
        name: "Milestone B",
        percentage: 50,
        manualLabelPosition: { x: 700, y: 260 },
      },
    ]);

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Reset labels" }));

    expect(
      screen
        .getByRole("button", { name: "Reset label position for milestone 1" })
        .hasAttribute("disabled"),
    ).toBe(true);
    expect(
      screen
        .getByRole("button", { name: "Reset label position for milestone 2" })
        .hasAttribute("disabled"),
    ).toBe(true);
  });

  it("creates, renames, switches, and restores independent projects", () => {
    seedChartState([{ id: "m1", name: "First milestone", percentage: 20 }]);
    render(<App />);

    fireEvent.change(screen.getByLabelText("Project title"), {
      target: { value: "First project" },
    });
    fireEvent.click(screen.getByRole("button", { name: "New project" }));

    expect(screen.getByLabelText("Project")).toHaveProperty("selectedIndex", 1);
    fireEvent.change(screen.getByLabelText("Project title"), {
      target: { value: "Second project" },
    });
    fireEvent.change(screen.getByPlaceholderText("Milestone name"), {
      target: { value: "Second milestone" },
    });

    const selector = screen.getByLabelText("Project");
    const [firstProject] = readStoredProjects().projects;
    fireEvent.change(selector, { target: { value: firstProject.id } });

    expect(screen.getByLabelText("Project title")).toHaveProperty("value", "First project");
    expect(screen.getByDisplayValue("First milestone")).not.toBeNull();
    expect(screen.queryByDisplayValue("Second milestone")).toBeNull();
    expect(readStoredProjects().projects.map((project: { title: string }) => project.title)).toEqual([
      "First project",
      "Second project",
    ]);
  });

  it("allows projects to have duplicate titles", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "New project" }));

    expect(screen.getAllByRole("option", { name: "Project Hillchart" })).toHaveLength(2);
  });

  it("cancels project deletion when confirmation is rejected", () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Delete project" }));

    expect(screen.getByLabelText("Project")).not.toHaveProperty("disabled", true);
    expect(readStoredProjects().projects).toHaveLength(1);
  });

  it("selects the next project after deleting the active project", () => {
    seedProjectStore({
      version: 1,
      activeProjectId: "first",
      projects: [
        {
          id: "first",
          title: "First",
          items: [{ id: "m1", name: "", percentage: 20 }],
          dotShape: "dot",
        },
        {
          id: "second",
          title: "Second",
          items: [{ id: "m2", name: "Second milestone", percentage: 20 }],
          dotShape: "star",
        },
      ],
    });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const { container } = render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Delete project" }));

    expect(screen.getByLabelText("Project title")).toHaveProperty("value", "Second");
    expect(container.querySelector('[data-marker-shape="star"]')).not.toBeNull();
    expect(readStoredProjects()).toMatchObject({
      activeProjectId: "second",
      projects: [{ id: "second" }],
    });
  });

  it("preserves an empty project list and creates from its empty state", () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const { unmount } = render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Delete project" }));

    expect(screen.getByRole("heading", { name: "Create a project to start a hillchart" })).not.toBeNull();
    expect(readStoredProjects()).toMatchObject({ activeProjectId: null, projects: [] });

    unmount();
    render(<App />);
    expect(screen.getByRole("heading", { name: "Create a project to start a hillchart" })).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Create project" }));
    expect(screen.getByLabelText("Project title")).toHaveProperty(
      "value",
      "Project Hillchart",
    );
  });
});

function seedChartState(items: unknown[]) {
  window.localStorage.setItem(itemsStorageKey, JSON.stringify(items));
  window.localStorage.setItem(titleStorageKey, "Project Hillchart");
}

function seedProjectStore(store: unknown) {
  window.localStorage.setItem(projectsStorageKey, JSON.stringify(store));
}

function readStoredProjects() {
  return JSON.parse(window.localStorage.getItem(projectsStorageKey)!);
}

function mockSvgBounds(svg: SVGSVGElement) {
  vi.spyOn(svg, "getBoundingClientRect").mockReturnValue({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: 1376,
    bottom: 768,
    width: 1376,
    height: 768,
    toJSON: () => ({}),
  });
}

function createStorageMock() {
  const values = new Map<string, string>();

  return {
    getItem(key: string) {
      return values.has(key) ? values.get(key)! : null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
    removeItem(key: string) {
      values.delete(key);
    },
    clear() {
      values.clear();
    },
  };
}
