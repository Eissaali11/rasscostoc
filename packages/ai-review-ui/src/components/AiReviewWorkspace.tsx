import { useMemo, useReducer } from "react";
import { createDemoReviewFixture } from "../fixtures/demo-workspace.js";
import type { AiReviewWorkspaceFixture } from "../types.js";
import {
  commitManualCorrection,
  createInitialState,
  rotateBy,
  selectDevice,
  selectField,
  selectImage,
  selectSessionAttempt,
  selectedDevice,
  setDraftField,
  setPage,
  zoomBy,
  type WorkspaceUiState,
} from "../model/workspace-state.js";
import { DocumentViewer } from "./DocumentViewer.js";
import { DeviceTable } from "./DeviceTable.js";
import { FieldEditor } from "./FieldEditor.js";
import { CandidatePanel, ExplainabilityPanel } from "./ExplainabilityPanel.js";
import { GraphReadonly, ReviewHistory, SessionAttemptBar } from "./SessionGraphHistory.js";

type Action =
  | { type: "device"; id: string }
  | { type: "image"; imageId: string }
  | { type: "field"; key: string }
  | { type: "page"; index: number }
  | { type: "zoom"; delta: number }
  | { type: "rotate"; deg: number }
  | { type: "draft"; key: string; value: string }
  | { type: "session"; sessionId: string; attemptId: string }
  | { type: "commit" };

function reducer(state: WorkspaceUiState, action: Action): WorkspaceUiState {
  switch (action.type) {
    case "device":
      return selectDevice(state, action.id);
    case "image":
      return selectImage(state, action.imageId);
    case "field":
      return selectField(state, action.key);
    case "page":
      return setPage(state, action.index);
    case "zoom":
      return zoomBy(state, action.delta);
    case "rotate":
      return rotateBy(state, action.deg);
    case "draft":
      return setDraftField(state, action.key, action.value);
    case "session":
      return selectSessionAttempt(state, action.sessionId, action.attemptId);
    case "commit":
      return commitManualCorrection(state, "reviewer-ui", "تصحيح من واجهة المراجعة");
    default:
      return state;
  }
}

export type AiReviewWorkspaceProps = {
  fixture?: AiReviewWorkspaceFixture;
};

export function AiReviewWorkspace({ fixture }: AiReviewWorkspaceProps) {
  const seed = useMemo(() => fixture ?? createDemoReviewFixture(), [fixture]);
  const [state, dispatch] = useReducer(reducer, seed, createInitialState);
  const device = selectedDevice(state);
  const candidates = state.selectedDeviceId
    ? (state.fixture.candidates_by_device[state.selectedDeviceId] ?? [])
    : [];
  const explanation = state.selectedDeviceId
    ? (state.fixture.explanation_by_device[state.selectedDeviceId] ?? [])
    : [];

  return (
    <div className="air-root" data-testid="ai-review-workspace" lang="ar">
      <div className="air-banner" role="note">
        PR-006A-7 · AI Review Workspace · Fixtures فقط · لا Apply · لا استدعاء مزود من الواجهة · لا ربط
        Courier · UX Gate: ?scenario=UX-1…UX-5 · الحالة: بانتظار قبول UX
      </div>
      <div className="air-topbar">
        <div>
          <h1 className="air-title">مساحة مراجعة الذكاء الاصطناعي</h1>
          <div className="air-muted" style={{ fontSize: "0.8rem" }}>
            {state.fixture.document_label} · {state.sessionId} / {state.attemptId} · أجهزة:{" "}
            {state.fixture.devices.length} · صفحات: {state.fixture.pages.length}
          </div>
        </div>
        <SessionAttemptBar
          sessions={state.fixture.sessions}
          sessionId={state.sessionId}
          attemptId={state.attemptId}
          onChange={(sessionId, attemptId) => dispatch({ type: "session", sessionId, attemptId })}
        />
      </div>

      <div className="air-grid">
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <DocumentViewer
            pages={state.fixture.pages}
            pageIndex={state.pageIndex}
            zoom={state.zoom}
            rotationDeg={state.rotationDeg}
            highlightedImageIds={state.highlightedImageIds}
            highlightBBox={state.highlightBBox}
            onPage={(index) => dispatch({ type: "page", index })}
            onSelectImage={(imageId) => dispatch({ type: "image", imageId })}
            onZoom={(delta) => dispatch({ type: "zoom", delta })}
            onRotate={(deg) => dispatch({ type: "rotate", deg })}
          />
          <DeviceTable
            devices={state.fixture.devices}
            selectedDeviceId={state.selectedDeviceId}
            onSelect={(id) => dispatch({ type: "device", id })}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <FieldEditor
            device={device}
            selectedFieldKey={state.selectedFieldKey}
            draftFields={state.draftFields}
            onSelectField={(key) => dispatch({ type: "field", key })}
            onDraft={(key, value) => dispatch({ type: "draft", key, value })}
            onCommit={() => dispatch({ type: "commit" })}
          />
          <ReviewHistory history={state.reviewHistory} deviceId={state.selectedDeviceId} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <ExplainabilityPanel lines={explanation} />
          <CandidatePanel candidates={candidates} />
          <GraphReadonly
            nodes={state.fixture.graph_nodes}
            edges={state.fixture.graph_edges}
            focusDeviceId={state.selectedDeviceId}
          />
        </div>
      </div>
    </div>
  );
}
