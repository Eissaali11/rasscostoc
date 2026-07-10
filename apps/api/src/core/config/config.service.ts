import dotenv from "dotenv";

// Load environment variables from .env
dotenv.config();

export class ConfigService {
  private static instance: ConfigService;
  private readonly envConfig: Record<string, string | undefined>;

  private constructor() {
    this.envConfig = process.env;
  }

  public static getInstance(): ConfigService {
    if (!ConfigService.instance) {
      ConfigService.instance = new ConfigService();
    }
    return ConfigService.instance;
  }

  get(key: string, defaultValue?: string): string {
    const value = this.envConfig[key];
    if (value === undefined) {
      if (defaultValue !== undefined) {
        return defaultValue;
      }
      throw new Error(`Configuration key "${key}" is missing and has no default value.`);
    }
    return value;
  }

  getNumber(key: string, defaultValue?: number): number {
    const value = this.envConfig[key];
    if (value === undefined) {
      if (defaultValue !== undefined) {
        return defaultValue;
      }
      throw new Error(`Configuration key "${key}" is missing and has no default value.`);
    }
    const num = Number(value);
    if (isNaN(num)) {
      throw new Error(`Configuration key "${key}" value "${value}" is not a valid number.`);
    }
    return num;
  }

  getBoolean(key: string, defaultValue?: boolean): boolean {
    const value = this.envConfig[key];
    if (value === undefined) {
      if (defaultValue !== undefined) {
        return defaultValue;
      }
      throw new Error(`Configuration key "${key}" is missing and has no default value.`);
    }
    return value.toLowerCase() === "true" || value === "1";
  }

  get nodeEnv(): string {
    return this.get("NODE_ENV", "development");
  }

  get isDevelopment(): boolean {
    return this.nodeEnv === "development";
  }

  get isProduction(): boolean {
    return this.nodeEnv === "production";
  }

  get port(): number {
    return this.getNumber("PORT", 3001);
  }

  get databaseUrl(): string {
    return this.get("DATABASE_URL");
  }

  get sessionSecret(): string {
    return this.get("SESSION_SECRET");
  }

  get jwtSecret(): string {
    return this.get("JWT_SECRET");
  }

  get trustProxy(): boolean {
    return this.getBoolean("TRUST_PROXY", false);
  }
}

export const configService = ConfigService.getInstance();
export default configService;
