import type { FieldBBox, PageView } from "../types.js";
import { Panel } from "./ui-bits.js";

export function DocumentViewer(props: {
  pages: PageView[];
  pageIndex: number;
  zoom: number;
  rotationDeg: number;
  highlightedImageIds: string[];
  highlightBBox: FieldBBox | null;
  onPage: (index: number) => void;
  onSelectImage: (imageId: string) => void;
  onZoom: (delta: number) => void;
  onRotate: (deg: number) => void;
}) {
  const page = props.pages[props.pageIndex];
  const highlighted = page ? props.highlightedImageIds.includes(page.image_id) : false;
  const showBBox =
    highlighted && props.highlightBBox != null && page != null
      ? props.highlightBBox
      : null;

  return (
    <Panel
      title="عارض المستند"
      actions={
        <span className="air-muted" style={{ fontSize: "0.75rem" }}>
          {page ? `${page.label} · جودة ${page.quality_score}%` : "—"}
        </span>
      }
    >
      {props.pages.length > 1 ? (
        <div className="air-thumbs" role="listbox" aria-label="صفحات المستند">
          {props.pages.map((p, index) => {
            const on = props.highlightedImageIds.includes(p.image_id);
            const current = index === props.pageIndex;
            return (
              <button
                key={p.image_id}
                type="button"
                role="option"
                aria-selected={current}
                className={`air-thumb${current ? " current" : ""}${on ? " on" : ""}`}
                title={p.label}
                onClick={() => props.onSelectImage(p.image_id)}
              >
                {p.page}
              </button>
            );
          })}
        </div>
      ) : null}

      <div
        className="air-viewer-stage"
        role="img"
        aria-label={page?.label ?? "لا صفحة"}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight" || e.key === "ArrowDown") {
            e.preventDefault();
            props.onPage(props.pageIndex + 1);
          }
          if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
            e.preventDefault();
            props.onPage(props.pageIndex - 1);
          }
        }}
      >
        {page ? (
          <button
            type="button"
            className={`air-page-preview${highlighted ? " highlight" : ""}`}
            style={{
              background: page.preview_tone,
              transform: `scale(${props.zoom}) rotate(${props.rotationDeg}deg)`,
            }}
            onClick={() => props.onSelectImage(page.image_id)}
            aria-label={`تحديد الجهاز المرتبط بـ ${page.label}`}
          >
            {page.label}
            <br />
            <span style={{ fontSize: "0.7rem", opacity: 0.85 }}>{page.image_id}</span>
            {showBBox ? (
              <span
                className="air-bbox"
                style={{
                  left: `${showBBox.x * 100}%`,
                  top: `${showBBox.y * 100}%`,
                  width: `${showBBox.w * 100}%`,
                  height: `${showBBox.h * 100}%`,
                }}
                aria-hidden
              />
            ) : null}
          </button>
        ) : (
          <p className="air-muted">لا توجد صفحات</p>
        )}
      </div>
      <div className="air-toolbar" role="toolbar" aria-label="أدوات العرض">
        <button
          type="button"
          className="air-btn"
          onClick={() => props.onPage(props.pageIndex - 1)}
          disabled={props.pageIndex <= 0}
        >
          السابق
        </button>
        <button
          type="button"
          className="air-btn"
          onClick={() => props.onPage(props.pageIndex + 1)}
          disabled={props.pageIndex >= props.pages.length - 1}
        >
          التالي
        </button>
        <button type="button" className="air-btn" onClick={() => props.onZoom(0.1)}>
          تكبير
        </button>
        <button type="button" className="air-btn" onClick={() => props.onZoom(-0.1)}>
          تصغير
        </button>
        <button type="button" className="air-btn" onClick={() => props.onRotate(90)}>
          تدوير
        </button>
      </div>
    </Panel>
  );
}
