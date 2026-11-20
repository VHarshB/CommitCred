import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

function key(secret: string) {
  return createHash("sha256").update(`receipt:${secret}`).digest();
}

export function sealReceipt(output: unknown, secret: string, binding: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(secret), iv);
  cipher.setAAD(Buffer.from(binding));
  const value = Buffer.concat([cipher.update(JSON.stringify(output), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), value]).toString("base64url");
}

export function openReceipt(receipt: string, secret: string, binding: string): unknown {
  const value = Buffer.from(receipt, "base64url");
  const decipher = createDecipheriv("aes-256-gcm", key(secret), value.subarray(0, 12));
  decipher.setAAD(Buffer.from(binding));
  decipher.setAuthTag(value.subarray(12, 28));
  return JSON.parse(Buffer.concat([decipher.update(value.subarray(28)), decipher.final()]).toString("utf8"));
}
