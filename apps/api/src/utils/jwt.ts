import crypto from "crypto";

export interface JWTPayload {
  userId: string;
  role: string;
  username: string;
  regionId: string | null;
  [key: string]: any;
}

function base64UrlEncode(str: string | Buffer): string {
  const base64 = typeof str === "string" ? Buffer.from(str).toString("base64") : str.toString("base64");
  return base64
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  return Buffer.from(base64, "base64").toString("utf8");
}

/**
 * Sign a JWT payload using HS256 algorithm with Node.js crypto
 */
export function sign(payload: Record<string, any>, secret: string, options: { expiresIn: string }): string {
  const header = {
    alg: "HS256",
    typ: "JWT"
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  
  // Calculate expiration
  const expMatch = options.expiresIn.match(/^(\d+)([smhd])$/);
  if (!expMatch) {
    throw new Error("Invalid expiresIn format. Use e.g. '15m', '7d'");
  }
  
  const value = parseInt(expMatch[1], 10);
  const unit = expMatch[2];
  let durationMs = 0;
  if (unit === "s") durationMs = value * 1000;
  else if (unit === "m") durationMs = value * 60 * 1000;
  else if (unit === "h") durationMs = value * 60 * 60 * 1000;
  else if (unit === "d") durationMs = value * 24 * 60 * 60 * 1000;
  
  const exp = Math.floor((Date.now() + durationMs) / 1000);
  const fullPayload = { ...payload, exp };
  
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));
  const signatureInput = `${encodedHeader}.${encodedPayload}`;
  
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(signatureInput);
  const signature = base64UrlEncode(hmac.digest());
  
  return `${signatureInput}.${signature}`;
}

/**
 * Verify a JWT HS256 token and return the payload or throw an error if expired or invalid
 */
export function verify(token: string, secret: string): JWTPayload {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid token structure");
  }
  
  const [encodedHeader, encodedPayload, signature] = parts;
  const signatureInput = `${encodedHeader}.${encodedPayload}`;
  
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(signatureInput);
  const expectedSignature = base64UrlEncode(hmac.digest());
  
  if (signature !== expectedSignature) {
    throw new Error("Invalid signature");
  }
  
  const payload = JSON.parse(base64UrlDecode(encodedPayload)) as JWTPayload & { exp?: number };
  
  if (payload.exp && Date.now() >= payload.exp * 1000) {
    throw new Error("Token expired");
  }
  
  return payload;
}
