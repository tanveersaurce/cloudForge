/**
 * Zero-dependency ZIP file generator in pure TypeScript.
 * Generates standard PKZip format archives supporting nested directory paths.
 */

export interface ZipFileInput {
  filename: string;
  content: string;
}

// Precomputed CRC32 table
const CRC_TABLE: Uint32Array = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function calculateCrc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ data[i]) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function createZipArchive(files: ZipFileInput[]): Blob {
  const encoder = new TextEncoder();
  const fileRecords: Array<{
    filenameBytes: Uint8Array;
    contentBytes: Uint8Array;
    crc: number;
    offset: number;
  }> = [];

  const chunks: Uint8Array[] = [];
  let currentOffset = 0;

  // 1. Write Local File Headers and Data
  for (const file of files) {
    // Normalize path separators to forward slash
    const normalizedName = file.filename.replace(/\\/g, '/').replace(/^\//, '');
    const filenameBytes = encoder.encode(normalizedName);
    const contentBytes = encoder.encode(file.content);
    const crc = calculateCrc32(contentBytes);
    const offset = currentOffset;

    fileRecords.push({
      filenameBytes,
      contentBytes,
      crc,
      offset,
    });

    const localHeader = new Uint8Array(30 + filenameBytes.length);
    const view = new DataView(localHeader.buffer);

    // Signature: 0x04034b50
    view.setUint32(0, 0x04034b50, true);
    // Version needed: 20 (2.0)
    view.setUint16(4, 20, true);
    // General purpose flag: 0x0800 (UTF-8)
    view.setUint16(6, 0x0800, true);
    // Compression: 0 (store - uncompressed)
    view.setUint16(8, 0, true);
    // Mod time / date (fixed fallback: 2026-01-01 00:00:00)
    view.setUint16(10, 0x0000, true);
    view.setUint16(12, 0x5c21, true);
    // CRC32
    view.setUint32(14, crc, true);
    // Compressed size
    view.setUint32(18, contentBytes.length, true);
    // Uncompressed size
    view.setUint32(22, contentBytes.length, true);
    // Filename length
    view.setUint16(26, filenameBytes.length, true);
    // Extra field length
    view.setUint16(28, 0, true);

    localHeader.set(filenameBytes, 30);

    chunks.push(localHeader);
    chunks.push(contentBytes);

    currentOffset += localHeader.length + contentBytes.length;
  }

  // 2. Write Central Directory Headers
  const centralDirStartOffset = currentOffset;

  for (const record of fileRecords) {
    const cdHeader = new Uint8Array(46 + record.filenameBytes.length);
    const view = new DataView(cdHeader.buffer);

    // Signature: 0x02014b50
    view.setUint32(0, 0x02014b50, true);
    // Version made by: 20
    view.setUint16(4, 20, true);
    // Version needed: 20
    view.setUint16(6, 20, true);
    // Flags: 0x0800 (UTF-8)
    view.setUint16(8, 0x0800, true);
    // Compression: 0 (store)
    view.setUint16(10, 0, true);
    // Mod time / date
    view.setUint16(12, 0x0000, true);
    view.setUint16(14, 0x5c21, true);
    // CRC32
    view.setUint32(16, record.crc, true);
    // Compressed size
    view.setUint32(20, record.contentBytes.length, true);
    // Uncompressed size
    view.setUint32(24, record.contentBytes.length, true);
    // Filename length
    view.setUint16(28, record.filenameBytes.length, true);
    // Extra field length
    view.setUint16(30, 0, true);
    // Comment length
    view.setUint16(32, 0, true);
    // Disk number start
    view.setUint16(34, 0, true);
    // Internal attrs
    view.setUint16(36, 0, true);
    // External attrs: 0644 normal file (0x81a40000)
    view.setUint32(38, 0x81a40000, true);
    // Relative offset of local header
    view.setUint32(42, record.offset, true);

    cdHeader.set(record.filenameBytes, 46);
    chunks.push(cdHeader);

    currentOffset += cdHeader.length;
  }

  const centralDirSize = currentOffset - centralDirStartOffset;

  // 3. Write End of Central Directory Record (EOCD)
  const eocd = new Uint8Array(22);
  const eocdView = new DataView(eocd.buffer);

  // Signature: 0x06054b50
  eocdView.setUint32(0, 0x06054b50, true);
  // Disk number: 0
  eocdView.setUint16(4, 0, true);
  // Start disk: 0
  eocdView.setUint16(6, 0, true);
  // Entries on disk
  eocdView.setUint16(8, fileRecords.length, true);
  // Total entries
  eocdView.setUint16(10, fileRecords.length, true);
  // Central directory size
  eocdView.setUint32(12, centralDirSize, true);
  // Central directory offset
  eocdView.setUint32(16, centralDirStartOffset, true);
  // Comment length: 0
  eocdView.setUint16(20, 0, true);

  chunks.push(eocd);

  return new Blob(chunks as unknown as BlobPart[], { type: 'application/zip' });
}
