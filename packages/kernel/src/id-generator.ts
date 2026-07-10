import { randomUUID } from "crypto";

export class IdGenerator {
  public static uuid(): string {
    return randomUUID();
  }

  public static nanoid(length = 21): string {
    // Generate a secure alphabetic slug using Node.js's native crypto
    const chars = "usepatchdbfghijklmnopqrstwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let id = "";
    while (id.length < length) {
      const bytes = randomUUID().replace(/-/g, "");
      for (let i = 0; i < bytes.length && id.length < length; i++) {
        const index = parseInt(bytes[i], 16) % chars.length;
        id += chars[index];
      }
    }
    return id;
  }
}
