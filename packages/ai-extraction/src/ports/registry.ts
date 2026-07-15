import type { RegistryBundle } from "../domain/types.js";
import type { ExtractionSchemaRegistry } from "./providers.js";
import { nowIso } from "../domain/ids.js";

export class InMemorySchemaRegistry implements ExtractionSchemaRegistry {
  private readonly bundles = new Map<string, RegistryBundle>();

  resolve(bundle_id: string): RegistryBundle {
    const hit = this.bundles.get(bundle_id);
    if (!hit) {
      throw new Error(`Unknown registry bundle: ${bundle_id}`);
    }
    return structuredClone(hit);
  }

  publish(
    bundle: Omit<RegistryBundle, "immutable" | "published_at"> & { published_at?: string },
  ): RegistryBundle {
    if (this.bundles.has(bundle.registry_bundle_id)) {
      throw new Error(
        `Registry bundle ${bundle.registry_bundle_id} is immutable; publish a new id/version`,
      );
    }
    const published: RegistryBundle = {
      ...bundle,
      immutable: true,
      published_at: bundle.published_at ?? nowIso(),
    };
    this.bundles.set(published.registry_bundle_id, structuredClone(published));
    return structuredClone(published);
  }

  list(): RegistryBundle[] {
    return [...this.bundles.values()].map((b) => structuredClone(b));
  }
}
