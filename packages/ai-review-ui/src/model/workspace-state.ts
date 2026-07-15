import type {
  AiReviewWorkspaceFixture,
  DeviceRowView,
  FieldBBox,
  ReviewVersionView,
} from "../types.js";

export type WorkspaceUiState = {
  fixture: AiReviewWorkspaceFixture;
  sessionId: string;
  attemptId: string;
  selectedDeviceId: string | null;
  selectedFieldKey: string | null;
  highlightedImageIds: string[];
  /** Field bbox on the currently highlighted page image, if available */
  highlightBBox: FieldBBox | null;
  pageIndex: number; // 0-based into fixture.pages
  zoom: number;
  rotationDeg: number;
  draftFields: Record<string, string>;
  reviewHistory: ReviewVersionView[];
};

export function deviceImageIds(device: DeviceRowView): string[] {
  const ids = new Set<string>();
  for (const f of device.fields) {
    for (const id of f.source_image_ids) ids.add(id);
  }
  return [...ids];
}

export function findDeviceIdForImage(
  devices: DeviceRowView[],
  imageId: string,
): string | null {
  for (const d of devices) {
    if (deviceImageIds(d).includes(imageId)) return d.device_id;
  }
  return null;
}

export function createInitialState(fixture: AiReviewWorkspaceFixture): WorkspaceUiState {
  const firstDevice = fixture.devices[0] ?? null;
  const imageIds = firstDevice ? deviceImageIds(firstDevice) : [];
  const pageIndex =
    imageIds[0] != null
      ? Math.max(0, fixture.pages.findIndex((p) => p.image_id === imageIds[0]))
      : 0;
  return {
    fixture,
    sessionId: fixture.active_session_id,
    attemptId: fixture.active_attempt_id,
    selectedDeviceId: firstDevice?.device_id ?? null,
    selectedFieldKey: null,
    highlightedImageIds: imageIds,
    highlightBBox: null,
    pageIndex: pageIndex < 0 ? 0 : pageIndex,
    zoom: 1,
    rotationDeg: 0,
    draftFields: {},
    reviewHistory: [...fixture.review_history],
  };
}

export function selectDevice(state: WorkspaceUiState, deviceId: string): WorkspaceUiState {
  const device = state.fixture.devices.find((d) => d.device_id === deviceId);
  const imageIds = device ? deviceImageIds(device) : [];
  const pageIndex =
    imageIds[0] != null
      ? Math.max(0, state.fixture.pages.findIndex((p) => p.image_id === imageIds[0]))
      : state.pageIndex;
  return {
    ...state,
    selectedDeviceId: deviceId,
    selectedFieldKey: null,
    highlightedImageIds: imageIds,
    highlightBBox: null,
    pageIndex: pageIndex < 0 ? state.pageIndex : pageIndex,
    draftFields: {},
  };
}

/** Clicking a page/image selects the owning device and highlights that image. */
export function selectImage(state: WorkspaceUiState, imageId: string): WorkspaceUiState {
  const deviceId = findDeviceIdForImage(state.fixture.devices, imageId);
  const pageIndex = Math.max(
    0,
    state.fixture.pages.findIndex((p) => p.image_id === imageId),
  );
  if (!deviceId) {
    return {
      ...state,
      pageIndex: pageIndex < 0 ? state.pageIndex : pageIndex,
      highlightedImageIds: [imageId],
      highlightBBox: null,
      selectedFieldKey: null,
    };
  }
  const next = selectDevice(state, deviceId);
  return {
    ...next,
    pageIndex: pageIndex < 0 ? next.pageIndex : pageIndex,
    highlightedImageIds: [imageId],
    highlightBBox: null,
  };
}

export function selectField(state: WorkspaceUiState, fieldKey: string): WorkspaceUiState {
  const device = state.fixture.devices.find((d) => d.device_id === state.selectedDeviceId);
  const field = device?.fields.find((f) => f.key === fieldKey);
  const imageIds = field?.source_image_ids ?? [];
  const pageIndex =
    imageIds[0] != null
      ? Math.max(0, state.fixture.pages.findIndex((p) => p.image_id === imageIds[0]))
      : state.pageIndex;
  return {
    ...state,
    selectedFieldKey: fieldKey,
    highlightedImageIds: imageIds,
    highlightBBox: field?.bbox ?? null,
    pageIndex: pageIndex < 0 ? state.pageIndex : pageIndex,
  };
}

export function setPage(state: WorkspaceUiState, pageIndex: number): WorkspaceUiState {
  const max = Math.max(0, state.fixture.pages.length - 1);
  return { ...state, pageIndex: Math.min(max, Math.max(0, pageIndex)) };
}

export function zoomBy(state: WorkspaceUiState, delta: number): WorkspaceUiState {
  const zoom = Math.min(3, Math.max(0.5, Number((state.zoom + delta).toFixed(2))));
  return { ...state, zoom };
}

export function rotateBy(state: WorkspaceUiState, deg: number): WorkspaceUiState {
  return { ...state, rotationDeg: (state.rotationDeg + deg + 360) % 360 };
}

export function setDraftField(state: WorkspaceUiState, key: string, value: string): WorkspaceUiState {
  return { ...state, draftFields: { ...state.draftFields, [key]: value } };
}

export function selectSessionAttempt(
  state: WorkspaceUiState,
  sessionId: string,
  attemptId: string,
): WorkspaceUiState {
  return { ...state, sessionId, attemptId };
}

/** Local-only versioned review — in-memory, no Courier persistence. */
export function commitManualCorrection(
  state: WorkspaceUiState,
  editedBy: string,
  reason?: string,
): WorkspaceUiState {
  if (!state.selectedDeviceId) return state;
  const device = state.fixture.devices.find((d) => d.device_id === state.selectedDeviceId);
  if (!device) return state;

  const diffs: ReviewVersionView["field_diffs"] = [];
  for (const [key, after] of Object.entries(state.draftFields)) {
    const field = device.fields.find((f) => f.key === key);
    const before = field?.value ?? null;
    if (String(before ?? "") === after) continue;
    diffs.push({ field: key, before, after });
  }
  if (diffs.length === 0) return state;

  const nextVersion =
    Math.max(0, ...state.reviewHistory.map((r) => r.review_version)) + 1;

  const entry: ReviewVersionView = {
    review_version: nextVersion,
    device_id: state.selectedDeviceId,
    edited_by: editedBy,
    edited_at: new Date().toISOString(),
    reason,
    field_diffs: diffs,
  };

  const devices = state.fixture.devices.map((d) => {
    if (d.device_id !== state.selectedDeviceId) return d;
    return {
      ...d,
      fields: d.fields.map((f) =>
        state.draftFields[f.key] !== undefined
          ? { ...f, value: state.draftFields[f.key] ?? null }
          : f,
      ),
      serial_number:
        state.draftFields.serial_number !== undefined
          ? state.draftFields.serial_number
          : d.serial_number,
      sim_serial:
        state.draftFields.sim_serial !== undefined
          ? state.draftFields.sim_serial
          : d.sim_serial,
      tid: state.draftFields.tid !== undefined ? state.draftFields.tid : d.tid,
      merchant:
        state.draftFields.merchant !== undefined
          ? state.draftFields.merchant
          : d.merchant,
      branch:
        state.draftFields.branch !== undefined ? state.draftFields.branch : d.branch,
    };
  });

  return {
    ...state,
    fixture: { ...state.fixture, devices },
    draftFields: {},
    reviewHistory: [...state.reviewHistory, entry],
  };
}

export function selectedDevice(state: WorkspaceUiState) {
  return state.fixture.devices.find((d) => d.device_id === state.selectedDeviceId) ?? null;
}

export function isAmbiguousMatch(candidates: { length: number }): boolean {
  return candidates.length > 1;
}
