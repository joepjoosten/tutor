import { webcrypto } from "node:crypto";

if (!globalThis.crypto) {
  Object.defineProperty(globalThis, "crypto", {
    value: webcrypto,
    configurable: true,
  });
}

if (!globalThis.atob) {
  globalThis.atob = (value: string) =>
    Buffer.from(value, "base64").toString("binary");
}

if (!globalThis.btoa) {
  globalThis.btoa = (value: string) =>
    Buffer.from(value, "binary").toString("base64");
}
