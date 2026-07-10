import dotenv from "dotenv";
import path from "path";

export interface AppConfig {
  port: number;
  env: string;
  databaseUrl: string;
  jwtSecret: string;
}

export function loadConfig(rootPath: string = process.cwd()): AppConfig {
  dotenv.config({ path: path.resolve(rootPath, ".env") });

  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET environment variable is required");
  }

  return {
    port: parseInt(process.env.PORT || "3001", 10),
    env: process.env.NODE_ENV || "development",
    databaseUrl: process.env.DATABASE_URL || "",
    jwtSecret: process.env.JWT_SECRET,
  };
}
