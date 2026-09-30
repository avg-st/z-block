/**
 * Генератор иконок расширения (PNG пишутся вручную, без зависимостей).
 * Запуск: npm run icons
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, '..', 'icons');

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

/** rgba -> PNG */
function encodePng(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0; // фильтр None
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // бит на канал
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Знак «запрещено»: красный круг с белой диагональной полосой. */
function drawIcon(size) {
  const rgba = Buffer.alloc(size * size * 4);
  const cx = (size - 1) / 2;
  const cy = (size - 1) / 2;
  const rOuter = size * 0.47;
  const rInner = size * 0.49;
  const band = Math.max(size * 0.1, 1.4) / 2;
  const k = Math.SQRT1_2; // 45°

  const put = (x, y, color) => {
    const i = (y * size + x) * 4;
    rgba[i] = color[0];
    rgba[i + 1] = color[1];
    rgba[i + 2] = color[2];
    rgba[i + 3] = color[3];
  };

  const red = [214, 45, 32, 255];
  const white = [255, 255, 255, 255];

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const edge = rOuter - dist;
      if (edge <= -1) continue; // вне круга
      const alpha = edge >= 1 ? 1 : Math.max(0, Math.min(1, edge + 0.5));
      // расстояние до диагонали (из левого низа в правый верх)
      const line = Math.abs(dx * k - dy * k) / Math.SQRT2 * Math.SQRT2;
      const inBand = line < band && dist < rInner;
      const color = inBand ? white : red;
      put(x, y, [color[0], color[1], color[2], Math.round(255 * alpha)]);
    }
  }
  return rgba;
}

mkdirSync(OUT_DIR, { recursive: true });
for (const size of [16, 32, 48, 128]) {
  const file = resolve(OUT_DIR, `icon${size}.png`);
  writeFileSync(file, encodePng(size, size, drawIcon(size)));
  console.log('готово:', file);
}
