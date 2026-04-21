import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

const itemsStorageKey = "hillchart.items.v1";
const titleStorageKey = "hillchart.title.v1";

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
});

function seedChartState(items: unknown[]) {
  window.localStorage.setItem(itemsStorageKey, JSON.stringify(items));
  window.localStorage.setItem(titleStorageKey, "Project Hillchart");
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
