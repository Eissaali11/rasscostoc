import { createDeviceId } from "../domain/ids.js";
import type { ImageRef } from "../domain/types.js";
import type { DeviceGroupingProvider } from "../ports/providers.js";

export type EarlyLabel = {
  page: number;
  region_id?: string;
  image_id?: string;
  kind: "serial_number" | "sim_serial" | "tid" | "other";
  value: string;
};

/**
 * Heuristic grouping (PR-006A-3):
 * - image + optional early labels + page proximity
 * - conflicting SN labels on same proposed group → split + force_review
 * - low confidence → force_review (never silent auto-merge)
 */
export class HeuristicGroupingProvider implements DeviceGroupingProvider {
  readonly id = "heuristic_grouping_v1";

  async group(input: {
    document_type: string;
    images: ImageRef[];
    early_labels?: unknown;
    document_context?: unknown;
  }): Promise<{
    devices: Array<{
      device_id: string;
      device_index: number;
      images: ImageRef[];
      grouping_confidence: number;
      force_review: boolean;
    }>;
  }> {
    void input.document_type;
    void input.document_context;
    const images = input.images.slice().sort((a, b) => a.page - b.page || (a.region_id ?? "").localeCompare(b.region_id ?? ""));
    if (images.length === 0) {
      return { devices: [] };
    }

    const labels = normalizeLabels(input.early_labels);
    const clusters: ImageRef[][] = [];

    for (const img of images) {
      const label = labelForImage(img, labels);
      let merged = false;
      if (label) {
        for (const cluster of clusters) {
          const clusterLabel = cluster
            .map((c) => labelForImage(c, labels))
            .find(Boolean);
          if (clusterLabel && clusterLabel.kind === label.kind) {
            if (clusterLabel.value === label.value) {
              cluster.push(img);
              merged = true;
              break;
            }
            // conflicting same-kind labels → do not merge
          }
        }
      }
      if (!merged) {
        // proximity: attach to last cluster if adjacent page and no conflicting label
        const last = clusters[clusters.length - 1];
        if (last && canProximityMerge(last, img, labels)) {
          last.push(img);
        } else {
          clusters.push([img]);
        }
      }
    }

    // Split clusters that internally conflict
    const finalClusters: Array<{ images: ImageRef[]; force_review: boolean; confidence: number }> = [];
    for (const cluster of clusters) {
      const conflict = hasInternalConflict(cluster, labels);
      if (conflict) {
        for (const img of cluster) {
          finalClusters.push({
            images: [img],
            force_review: true,
            confidence: 35,
          });
        }
      } else {
        const hasLabelLink = cluster.some((img) => !!labelForImage(img, labels));
        const multiPage = new Set(cluster.map((i) => i.page)).size > 1;
        let confidence = 70;
        if (hasLabelLink) confidence = 92;
        else if (cluster.length === 1) confidence = 80;
        else if (multiPage) confidence = 62;
        const force_review = confidence < 75;
        finalClusters.push({ images: cluster, force_review, confidence });
      }
    }

    return {
      devices: finalClusters.map((c, i) => ({
        device_id: createDeviceId(i + 1),
        device_index: i + 1,
        images: c.images,
        grouping_confidence: c.confidence,
        force_review: c.force_review,
      })),
    };
  }
}

function normalizeLabels(raw: unknown): EarlyLabel[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isEarlyLabel);
}

function isEarlyLabel(v: unknown): v is EarlyLabel {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.page === "number" &&
    typeof o.kind === "string" &&
    typeof o.value === "string"
  );
}

function labelForImage(img: ImageRef, labels: EarlyLabel[]): EarlyLabel | undefined {
  return labels.find(
    (l) =>
      l.page === img.page &&
      (l.image_id ? l.image_id === img.image_id : true) &&
      (l.region_id ? l.region_id === img.region_id : true),
  );
}

function canProximityMerge(cluster: ImageRef[], img: ImageRef, labels: EarlyLabel[]): boolean {
  const last = cluster[cluster.length - 1]!;
  if (img.page - last.page > 1) return false;
  const a = labelForImage(last, labels);
  const b = labelForImage(img, labels);
  if (a && b && a.kind === b.kind && a.value !== b.value) return false;
  return true;
}

function hasInternalConflict(cluster: ImageRef[], labels: EarlyLabel[]): boolean {
  const sns = cluster
    .map((img) => labelForImage(img, labels))
    .filter((l): l is EarlyLabel => !!l && l.kind === "serial_number")
    .map((l) => l.value);
  return new Set(sns).size > 1;
}
