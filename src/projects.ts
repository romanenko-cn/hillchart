import {
  createEmptyItems,
  defaultChartTitle,
  sanitizeItems,
  sanitizeTitle,
  type HillchartItem,
} from "./hillchart";
import { isDotShape, type DotShape } from "./dotShape";

export type HillchartProject = {
  id: string;
  title: string;
  items: HillchartItem[];
  dotShape: DotShape;
};

export type ProjectStore = {
  version: 1;
  activeProjectId: string | null;
  projects: HillchartProject[];
};

export const projectsStorageKey = "hillchart.projects.v1";
export const legacyItemsStorageKey = "hillchart.items.v1";
export const legacyTitleStorageKey = "hillchart.title.v1";
export const legacyDotShapeStorageKey = "hillchart.dotShape.v1";

export function createProject(title: unknown = defaultChartTitle): HillchartProject {
  return {
    id: createProjectId(),
    title: sanitizeTitle(title),
    items: createEmptyItems(),
    dotShape: "dot",
  };
}

export function loadProjectStore(storage: Storage = window.localStorage): ProjectStore {
  const stored = safeGetItem(storage, projectsStorageKey);

  if (stored !== null) {
    try {
      return sanitizeProjectStore(JSON.parse(stored));
    } catch {
      return createDefaultStore();
    }
  }

  return migrateLegacyStore(storage);
}

export function saveProjectStore(
  store: ProjectStore,
  storage: Storage = window.localStorage,
): boolean {
  try {
    storage.setItem(projectsStorageKey, JSON.stringify(store));
    return true;
  } catch {
    return false;
  }
}

export function sanitizeProjectStore(value: unknown): ProjectStore {
  if (!value || typeof value !== "object") {
    return createDefaultStore();
  }

  const candidate = value as Partial<ProjectStore>;
  const seenIds = new Set<string>();
  const projects = Array.isArray(candidate.projects)
    ? candidate.projects.map((project) => sanitizeProject(project, seenIds))
    : [];
  const activeProjectId =
    typeof candidate.activeProjectId === "string" &&
    projects.some((project) => project.id === candidate.activeProjectId)
      ? candidate.activeProjectId
      : projects[0]?.id ?? null;

  return {
    version: 1,
    activeProjectId,
    projects,
  };
}

function sanitizeProject(value: unknown, seenIds: Set<string>): HillchartProject {
  const candidate =
    value && typeof value === "object" ? (value as Partial<HillchartProject>) : {};
  let id =
    typeof candidate.id === "string" && candidate.id.trim().length > 0
      ? candidate.id
      : createProjectId();

  while (seenIds.has(id)) {
    id = createProjectId();
  }
  seenIds.add(id);

  return {
    id,
    title: sanitizeTitle(candidate.title),
    items: sanitizeItems(candidate.items),
    dotShape: isDotShape(candidate.dotShape) ? candidate.dotShape : "dot",
  };
}

function migrateLegacyStore(storage: Storage): ProjectStore {
  const project = createProject(safeGetItem(storage, legacyTitleStorageKey));
  const storedItems = safeGetItem(storage, legacyItemsStorageKey);
  const storedDotShape = safeGetItem(storage, legacyDotShapeStorageKey);

  if (storedItems !== null) {
    try {
      project.items = sanitizeItems(JSON.parse(storedItems));
    } catch {
      project.items = createEmptyItems();
    }
  }

  if (isDotShape(storedDotShape)) {
    project.dotShape = storedDotShape;
  }

  const store: ProjectStore = {
    version: 1,
    activeProjectId: project.id,
    projects: [project],
  };

  if (saveProjectStore(store, storage)) {
    safeRemoveItem(storage, legacyItemsStorageKey);
    safeRemoveItem(storage, legacyTitleStorageKey);
    safeRemoveItem(storage, legacyDotShapeStorageKey);
  }

  return store;
}

function createDefaultStore(): ProjectStore {
  const project = createProject();
  return {
    version: 1,
    activeProjectId: project.id,
    projects: [project],
  };
}

function safeGetItem(storage: Storage, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function safeRemoveItem(storage: Storage, key: string) {
  try {
    storage.removeItem(key);
  } catch {
    // A failed cleanup is harmless because the new store takes precedence.
  }
}

function createProjectId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `project-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
