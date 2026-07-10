import crypto from "crypto";

export interface JwtPayload {
  userId: string;
  role: string;
  username: string;
  regionId: string | null;
  [key: string]: any;
}

export class JwtSigner {
  static sign(payload: JwtPayload, secret: string, options: { expiresIn: string }): string {
    const header = { alg: "HS256", typ: "JWT" };
    const stringifiedHeader = JSON.stringify(header);
    const base64Header = Buffer.from(stringifiedHeader).toString("base64url");

    // parse expiresIn (e.g., '15m', '7d')
    const match = options.expiresIn.match(/^(\d+)([mdhs])$/);
    let expiresAt = Date.now();
    if (match) {
      const val = parseInt(match[1], 10);
      const unit = match[2];
      if (unit === "m") expiresAt += val * 60 * 1000;
      else if (unit === "h") expiresAt += val * 60 * 60 * 1000;
      else if (unit === "d") expiresAt += val * 24 * 60 * 60 * 1000;
      else if (unit === "s") expiresAt += val * 1000;
    } else {
      expiresAt += 15 * 60 * 1000; // default 15m
    }

    const payloadWithExp = {
      ...payload,
      exp: Math.floor(expiresAt / 1000),
      iat: Math.floor(Date.now() / 1000),
    };
    const stringifiedPayload = JSON.stringify(payloadWithExp);
    const base64Payload = Buffer.from(stringifiedPayload).toString("base64url");

    const signatureInput = `${base64Header}.${base64Payload}`;
    const signature = crypto
      .createHmac("sha256", secret)
      .update(signatureInput)
      .digest("base64url");

    return `${signatureInput}.${signature}`;
  }
}

export class JwtVerifier {
  static verify(token: string, secret: string): JwtPayload {
    const parts = token.split(".");
    if (parts.length !== 3) {
      throw new Error("Invalid JWT token format");
    }

    const [header, payload, signature] = parts;
    const signatureInput = `${header}.${payload}`;
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(signatureInput)
      .digest("base64url");

    if (signature !== expectedSignature) {
      throw new Error("Invalid signature");
    }

    const decodedPayload = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8")
    ) as JwtPayload;

    if (decodedPayload.exp && decodedPayload.exp < Math.floor(Date.now() / 1000)) {
      throw new Error("Token expired");
    }

    return decodedPayload;
  }
}
