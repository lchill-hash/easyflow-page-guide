import { deflateSync } from "node:zlib";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n += 1) {
  let c = n;
  for (let k = 0; k < 8; k += 1) {
    c = (c & 1) === 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE[n] = c >>> 0;
}

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) {
    c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  const lengthBuffer = Buffer.alloc(4);
  lengthBuffer.writeUInt32BE(data.length, 0);
  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([lengthBuffer, typeBuffer, data, crcBuffer]);
}

function encodePng(size, rgba) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    const rowStart = y * (size * 4 + 1);
    raw[rowStart] = 0;
    rgba.copy(raw, rowStart + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function insideRoundedRect(x, y, left, top, right, bottom, radius) {
  if (x < left || x > right || y < top || y > bottom) {
    return false;
  }
  const cx = x < left + radius ? left + radius : x > right - radius ? right - radius : x;
  const cy = y < top + radius ? top + radius : y > bottom - radius ? bottom - radius : y;
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= radius * radius;
}

function drawPixels(size) {
  const pixels = Buffer.alloc(size * size * 4);
  const radius = Math.max(2, Math.round(size * 0.2));
  const bars = [
    [0.22, 0.29, 0.78, 0.37],
    [0.22, 0.45, 0.62, 0.53],
    [0.22, 0.61, 0.72, 0.69],
  ];
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const index = (y * size + x) * 4;
      const inBackground = insideRoundedRect(x, y, 0, 0, size - 1, size - 1, radius);
      if (!inBackground) {
        pixels[index] = 0;
        pixels[index + 1] = 0;
        pixels[index + 2] = 0;
        pixels[index + 3] = 0;
        continue;
      }
      pixels[index] = 79;
      pixels[index + 1] = 70;
      pixels[index + 2] = 229;
      pixels[index + 3] = 255;
      const barRadius = Math.max(1, Math.round(size * 0.04));
      for (const [left, top, right, bottom] of bars) {
        if (
          insideRoundedRect(
            x,
            y,
            Math.round(left * size),
            Math.round(top * size),
            Math.round(right * size),
            Math.round(bottom * size),
            barRadius,
          )
        ) {
          pixels[index] = 255;
          pixels[index + 1] = 255;
          pixels[index + 2] = 255;
          pixels[index + 3] = 255;
        }
      }
    }
  }
  return pixels;
}

export async function generateIcons(outDir) {
  const targetDir = outDir ?? resolve(process.cwd(), "dist", "icons");
  await mkdir(targetDir, { recursive: true });
  const sizes = [16, 32, 48, 128];
  for (const size of sizes) {
    const png = encodePng(size, drawPixels(size));
    await writeFile(join(targetDir, `icon${size}.png`), png);
  }
  return sizes.map((size) => join(targetDir, `icon${size}.png`));
}

const invokedDirectly = process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/gen-icons.mjs");
if (invokedDirectly) {
  const files = await generateIcons();
  for (const file of files) {
    console.log(`generated ${file}`);
  }
}