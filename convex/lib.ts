import type { GenericCtx } from "@convex-dev/better-auth";
import type { DataModel } from "./_generated/dataModel";
import { getEncryptionSecret } from "./env";

export async function requireUser(ctx: GenericCtx<DataModel>) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity?.subject) {
    throw new Error("You must be signed in.");
  }
  return identity.subject;
}

function bytesToBase64(bytes: Uint8Array) {
  let output = "";
  for (const byte of bytes) {
    output += String.fromCharCode(byte);
  }
  return btoa(output);
}

function base64ToBytes(value: string) {
  const input = atob(value);
  const output = new Uint8Array(input.length);
  for (let i = 0; i < input.length; i += 1) {
    output[i] = input.charCodeAt(i);
  }
  return output;
}

async function getAesKey(secret: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(secret)
  );
  return crypto.subtle.importKey(
    "raw",
    digest,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptSecret(value: string) {
  const key = await getAesKey(getEncryptionSecret());
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(value)
  );

  return `${bytesToBase64(iv)}.${bytesToBase64(new Uint8Array(encrypted))}`;
}

export async function decryptSecret(value: string) {
  const [ivPart, encryptedPart] = value.split(".");
  if (!ivPart || !encryptedPart) {
    throw new Error("Stored secret payload is invalid.");
  }

  const key = await getAesKey(getEncryptionSecret());
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(ivPart) },
    key,
    base64ToBytes(encryptedPart)
  );

  return new TextDecoder().decode(decrypted);
}

export async function blobToBase64(blob: Blob) {
  const arrayBuffer = await blob.arrayBuffer();
  return bytesToBase64(new Uint8Array(arrayBuffer));
}
