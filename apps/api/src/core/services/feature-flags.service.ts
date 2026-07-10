import { db } from "../config/db";
import { sql } from "drizzle-orm";
import { logger } from "../telemetry/logger";

export class FeatureFlagService {
  private static instance: FeatureFlagService;
  
  // Default fallback flags
  private cache: Record<string, boolean> = {
    enable_saga_compensation: true,
    enable_structured_logging: true,
    enable_rate_limiting: true,
    enable_strict_cors: true,
    enable_ocr_autofill: true,
  };

  private lastFetchTime = 0;
  private readonly cacheTTL = 60000; // 60 seconds TTL

  private constructor() {}

  public static getInstance(): FeatureFlagService {
    if (!FeatureFlagService.instance) {
      FeatureFlagService.instance = new FeatureFlagService();
    }
    return FeatureFlagService.instance;
  }

  /**
   * Reload flags from database. Gracefully falls back to default values
   * if the table does not exist yet.
   */
  async refresh(): Promise<void> {
    try {
      // Run dynamic SQL to query feature flags table without requiring compiler-time schema imports
      const result = await db.execute(sql`
        SELECT key, value, enabled 
        FROM feature_flags
      `);

      if (result.rows && result.rows.length > 0) {
        const dbFlags: Record<string, boolean> = {};
        for (const row of result.rows) {
          const key = String(row.key);
          const enabled = row.enabled === true || String(row.enabled).toLowerCase() === "true" || row.value === "true";
          dbFlags[key] = enabled;
        }
        
        // Merge with existing defaults
        this.cache = { ...this.cache, ...dbFlags };
        logger.info({
          message: "Feature flags successfully refreshed from database",
          module: "system",
          action: "featureFlagsRefresh",
          metadata: { flags: this.cache }
        });
      }
    } catch (error: any) {
      // Table might not exist yet (e.g. before migrations are run)
      // Log as debug/info and use memory defaults
      logger.info({
        message: `Feature flags falling back to memory defaults (Table 'feature_flags' not ready/migrated yet: ${error.message})`,
        module: "system",
        action: "featureFlagsFallback",
      });
    }
    this.lastFetchTime = Date.now();
  }

  /**
   * Checks if a feature flag is enabled.
   */
  async isEnabled(flagKey: string, defaultValue = false): Promise<boolean> {
    const now = Date.now();
    if (now - this.lastFetchTime > this.cacheTTL) {
      await this.refresh();
    }

    if (this.cache[flagKey] !== undefined) {
      return this.cache[flagKey];
    }
    return defaultValue;
  }

  /**
   * Directly set flag state in memory (primarily for tests and runtime overrides).
   */
  setInMemory(flagKey: string, enabled: boolean): void {
    this.cache[flagKey] = enabled;
  }
}

export const featureFlagService = FeatureFlagService.getInstance();
export default featureFlagService;
