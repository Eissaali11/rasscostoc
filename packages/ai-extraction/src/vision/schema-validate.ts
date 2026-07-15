import type { JsonSchema } from "./schemas.js";

export type SchemaValidationResult = {
  valid: boolean;
  errors: string[];
};

function typeOk(value: unknown, type: string | string[] | undefined): boolean {
  if (!type) return true;
  const types = Array.isArray(type) ? type : [type];
  return types.some((t) => {
    if (t === "null") return value === null;
    if (t === "object") return value !== null && typeof value === "object" && !Array.isArray(value);
    if (t === "array") return Array.isArray(value);
    if (t === "number") return typeof value === "number" && !Number.isNaN(value);
    if (t === "string") return typeof value === "string";
    if (t === "boolean") return typeof value === "boolean";
    return false;
  });
}

function validateNode(value: unknown, schema: JsonSchema, path: string, errors: string[]): void {
  if (!typeOk(value, schema.type)) {
    errors.push(`${path}: expected type ${JSON.stringify(schema.type)}`);
    return;
  }
  if (typeof schema.minimum === "number" && typeof value === "number" && value < schema.minimum) {
    errors.push(`${path}: below minimum ${schema.minimum}`);
  }
  if (typeof schema.maximum === "number" && typeof value === "number" && value > schema.maximum) {
    errors.push(`${path}: above maximum ${schema.maximum}`);
  }
  if (schema.type === "object" || (Array.isArray(schema.type) && schema.type.includes("object"))) {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return;
    const obj = value as Record<string, unknown>;
    for (const key of schema.required ?? []) {
      if (!(key in obj)) errors.push(`${path}.${key}: required`);
    }
    if (schema.properties) {
      for (const [key, child] of Object.entries(schema.properties)) {
        if (key in obj) validateNode(obj[key], child, `${path}.${key}`, errors);
      }
    }
    if (schema.additionalProperties === false && schema.properties) {
      for (const key of Object.keys(obj)) {
        if (!(key in schema.properties)) {
          errors.push(`${path}.${key}: additional property not allowed`);
        }
      }
    }
  }
}

/** Lightweight JSON Schema subset validator (no external ajv dependency). */
export function validateAgainstSchema(
  data: unknown,
  schema: JsonSchema,
): SchemaValidationResult {
  const errors: string[] = [];
  validateNode(data, schema, "$", errors);
  return { valid: errors.length === 0, errors };
}
