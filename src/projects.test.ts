import { beforeEach, describe, expect, it } from "vitest";
import {
  createProject,
  legacyDotShapeStorageKey,
  legacyItemsStorageKey,
  legacyTitleStorageKey,
  loadProjectStore,
  projectsStorageKey,
  sanitizeProjectStore,
} from "./projects";

const storage = createStorageMock();

beforeEach(() => {
  storage.clear();
});

describe("project storage", () => {
  it("creates one selected default project on fresh storage", () => {
    const store = loadProjectStore(storage);

    expect(store.projects).toHaveLength(1);
    expect(store.activeProjectId).toBe(store.projects[0].id);
    expect(store.projects[0]).toMatchObject({
      title: "Project Hillchart",
      dotShape: "dot",
    });
    expect(store.projects[0].items).toHaveLength(1);
  });

  it("migrates and removes the complete legacy chart state", () => {
    storage.setItem(legacyTitleStorageKey, "  Launch Plan  ");
    storage.setItem(
      legacyItemsStorageKey,
      JSON.stringify([
        {
          id: "m1",
          name: "Ship",
          percentage: 75,
          manualLabelPosition: { x: 430, y: 210 },
        },
      ]),
    );
    storage.setItem(legacyDotShapeStorageKey, "star");

    const store = loadProjectStore(storage);

    expect(store.projects[0]).toMatchObject({
      title: "Launch Plan",
      dotShape: "star",
      items: [
        {
          id: "m1",
          name: "Ship",
          percentage: 75,
          manualLabelPosition: { x: 430, y: 210 },
        },
      ],
    });
    expect(storage.getItem(projectsStorageKey)).not.toBeNull();
    expect(storage.getItem(legacyTitleStorageKey)).toBeNull();
    expect(storage.getItem(legacyItemsStorageKey)).toBeNull();
    expect(storage.getItem(legacyDotShapeStorageKey)).toBeNull();
  });

  it("uses the default title when the migrated title is blank", () => {
    storage.setItem(legacyTitleStorageKey, "   ");

    expect(loadProjectStore(storage).projects[0].title).toBe("Project Hillchart");
  });

  it("does not rerun migration when a new empty store exists", () => {
    storage.setItem(
      projectsStorageKey,
      JSON.stringify({ version: 1, activeProjectId: null, projects: [] }),
    );
    storage.setItem(legacyTitleStorageKey, "Legacy");

    expect(loadProjectStore(storage)).toEqual({
      version: 1,
      activeProjectId: null,
      projects: [],
    });
  });

  it("preserves duplicate titles while repairing duplicate ids", () => {
    const first = createProject("Duplicate");
    const store = sanitizeProjectStore({
      version: 1,
      activeProjectId: first.id,
      projects: [first, { ...first }],
    });

    expect(store.projects.map((project) => project.title)).toEqual([
      "Duplicate",
      "Duplicate",
    ]);
    expect(new Set(store.projects.map((project) => project.id)).size).toBe(2);
    expect(store.activeProjectId).toBe(first.id);
  });

  it("repairs an invalid active project reference", () => {
    const project = createProject("Known");
    const store = sanitizeProjectStore({
      version: 1,
      activeProjectId: "missing",
      projects: [project],
    });

    expect(store.activeProjectId).toBe(project.id);
  });
});

function createStorageMock(): Storage {
  const values = new Map<string, string>();

  return {
    get length() {
      return values.size;
    },
    clear() {
      values.clear();
    },
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    key(index: number) {
      return [...values.keys()][index] ?? null;
    },
    removeItem(key: string) {
      values.delete(key);
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
  };
}
