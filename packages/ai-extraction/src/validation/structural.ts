import type { DeviceGraph, DeviceNode, ImageNode, ValidationIssue } from "../domain/types.js";
import type { ValidationRulesEngine } from "../ports/providers.js";

/**
 * Structural validation only (ERP-006A). Business rules belong in a separate engine.
 */
export class StructuralValidationEngine implements ValidationRulesEngine {
  validate(graph: DeviceGraph, rules_version: string): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const devices = graph.nodes.filter((n): n is DeviceNode => n.kind === "device");

    if (devices.length === 0) {
      issues.push({
        code: "NO_DEVICES",
        severity: "error",
        message: "Device graph contains no device nodes",
        rules_version,
      });
    }

    for (const device of devices) {
      const images = graph.nodes.filter(
        (n): n is ImageNode => n.kind === "image" && n.device_id === device.device_id,
      );
      if (images.length === 0) {
        issues.push({
          code: "DEVICE_NO_IMAGES",
          severity: "error",
          device_id: device.device_id,
          message: "Device has no image nodes",
          rules_version,
        });
      }
      for (const img of images) {
        if (img.quality_score < 0 || img.quality_score > 100) {
          issues.push({
            code: "INVALID_QUALITY_SCORE",
            severity: "error",
            device_id: device.device_id,
            field: "quality_score",
            message: `quality_score out of range on ${img.id}`,
            rules_version,
          });
        }
      }
      if (device.grouping_confidence < 0 || device.grouping_confidence > 100) {
        issues.push({
          code: "INVALID_GROUPING_CONFIDENCE",
          severity: "error",
          device_id: device.device_id,
          field: "grouping_confidence",
          message: "grouping_confidence out of range",
          rules_version,
        });
      }
    }

    return issues;
  }
}
