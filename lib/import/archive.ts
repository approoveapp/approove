import { inflateRawSync } from "node:zlib";

export const MAX_ARCHIVE_EXPANDED_BYTES = 8 * 1024 * 1024;
export const MAX_ARCHIVE_ENTRIES = 512;

/** Validate both directory declarations and actual expansion before Office parsers allocate. */
export function validateOfficeArchive(input: Uint8Array) {
  const b = Buffer.from(input);
  const fail = () => { throw new Error("Arquivo Office excede os limites ou tem estrutura insegura."); };
  let end = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) {
    if (b.readUInt32LE(i) === 0x06054b50 && i + 22 + b.readUInt16LE(i + 20) === b.length) { end = i; break; }
  }
  if (end < 0) return fail();
  const count = b.readUInt16LE(end + 10), size = b.readUInt32LE(end + 12), start = b.readUInt32LE(end + 16);
  if (!count || count > MAX_ARCHIVE_ENTRIES || b.readUInt16LE(end + 4) || b.readUInt16LE(end + 6) || b.readUInt16LE(end + 8) !== count || start + size !== end) return fail();
  let pos = start, expanded = 0;
  const names = new Set<string>();
  for (let i = 0; i < count; i++) {
    if (pos + 46 > end || b.readUInt32LE(pos) !== 0x02014b50) return fail();
    const flags = b.readUInt16LE(pos + 8), method = b.readUInt16LE(pos + 10);
    const compressed = b.readUInt32LE(pos + 20), declared = b.readUInt32LE(pos + 24);
    const nameLen = b.readUInt16LE(pos + 28), extraLen = b.readUInt16LE(pos + 30), commentLen = b.readUInt16LE(pos + 32), local = b.readUInt32LE(pos + 42);
    if (pos + 46 + nameLen + extraLen + commentLen > end) return fail();
    const name = b.toString("utf8", pos + 46, pos + 46 + nameLen);
    if (names.has(name) || name.includes("..") || name.includes("\\") || name.startsWith("/") || flags & 1 || ![0,8].includes(method) || declared > MAX_ARCHIVE_EXPANDED_BYTES || declared > Math.max(1024 * 1024, compressed * 100)) return fail();
    names.add(name);
    if (local + 30 > start || b.readUInt32LE(local) !== 0x04034b50 || b.readUInt16LE(local + 8) !== method || b.readUInt16LE(local + 6) !== flags) return fail();
    const localNameLen = b.readUInt16LE(local + 26), data = local + 30 + localNameLen + b.readUInt16LE(local + 28);
    if (b.toString("utf8", local + 30, local + 30 + localNameLen) !== name || data + compressed > start) return fail();
    const packed = b.subarray(data, data + compressed);
    const raw = method === 0 ? packed : inflateRawSync(packed, { maxOutputLength: Math.min(MAX_ARCHIVE_EXPANDED_BYTES - expanded + 1, declared + 1) });
    expanded += raw.length;
    if (raw.length !== declared || expanded > MAX_ARCHIVE_EXPANDED_BYTES) return fail();
    if (/\.xml$|\.rels$/i.test(name) && /<!DOCTYPE|<!ENTITY/i.test(raw.toString("utf8"))) return fail();
    pos += 46 + nameLen + extraLen + commentLen;
  }
  if (pos !== end) return fail();
  return { entries: count, expandedBytes: expanded };
}
