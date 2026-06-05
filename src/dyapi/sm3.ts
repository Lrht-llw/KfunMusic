/**
 * SM3 哈希算法实现
 * 中国国家密码标准 GB/T 32905-2016
 * 基于 TikTokDownloader 的 gmssl Python 库实现移植
 */

// 初始值（IV）
const SM3_IV: number[] = [
  0x7380166f, 0x4914b2b9, 0x172442d7, 0xda8a0600,
  0xa96f30bc, 0x163138aa, 0xe38dee4d, 0xb0fb0e4e,
];

// 循环左移
function rotateLeft(x: number, n: number): number {
  n = n % 32;
  return ((x << n) | (x >>> (32 - n))) >>> 0;
}

// 置换函数 P0
function p0(x: number): number {
  return (x ^ rotateLeft(x, 9) ^ rotateLeft(x, 17)) >>> 0;
}

// 置换函数 P1
function p1(x: number): number {
  return (x ^ rotateLeft(x, 15) ^ rotateLeft(x, 23)) >>> 0;
}

// FF 函数
function ff(x: number, y: number, z: number, j: number): number {
  if (j < 16) {
    return (x ^ y ^ z) >>> 0;
  }
  return ((x & y) | (x & z) | (y & z)) >>> 0;
}

// GG 函数
function gg(x: number, y: number, z: number, j: number): number {
  if (j < 16) {
    return (x ^ y ^ z) >>> 0;
  }
  return ((x & y) | (~x & z)) >>> 0;
}

// 消息填充
function padMessage(message: number[]): number[] {
  const len = message.length;
  const bitLen = len * 8;

  // 添加 0x80
  const padded = [...message, 0x80];

  // 计算需要填充的 0 字节数
  // 总长度需要 ≡ 448 mod 512（即 56 mod 64 字节）
  // 最后 8 字节（64 位）存放原始消息长度
  let padLen = 64 - (padded.length % 64);
  if (padLen < 8) {
    padLen += 64;
  }
  padLen -= 8;

  for (let i = 0; i < padLen; i++) {
    padded.push(0);
  }

  // 添加消息长度（64 位，大端序）
  // 对于大于 2^53 的长度，需要特殊处理，但我们的场景不会遇到
  const high = Math.floor(bitLen / 0x100000000);
  const low = bitLen >>> 0;
  padded.push(
    (high >>> 24) & 0xff,
    (high >>> 16) & 0xff,
    (high >>> 8) & 0xff,
    high & 0xff,
    (low >>> 24) & 0xff,
    (low >>> 16) & 0xff,
    (low >>> 8) & 0xff,
    low & 0xff,
  );

  return padded;
}

// 消息扩展
function expandMessage(block: number[]): number[] {
  // block: 64 字节 = 16 个 32 位字
  const w: number[] = new Array(132).fill(0);

  // 将字节块转换为 32 位字（大端序）
  for (let i = 0; i < 16; i++) {
    w[i] =
      ((block[i * 4] << 24) |
        (block[i * 4 + 1] << 16) |
        (block[i * 4 + 2] << 8) |
        block[i * 4 + 3]) >>>
      0;
  }

  // W16 ~ W67
  for (let j = 16; j < 68; j++) {
    w[j] = (
      p1(w[j - 16] ^ w[j - 9] ^ rotateLeft(w[j - 3], 15)) ^
      rotateLeft(w[j - 13], 7) ^
      w[j - 6]
    ) >>> 0;
  }

  // W'0 ~ W'63
  for (let j = 0; j < 64; j++) {
    w[j + 68] = (w[j] ^ w[j + 4]) >>> 0;
  }

  return w;
}

// 压缩函数
function compress(
  v: number[],
  w: number[],
): number[] {
  let [a, b, c, d, e, f, g, h] = v;

  for (let j = 0; j < 64; j++) {
    const ss1 = rotateLeft(
      ((rotateLeft(a, 12) + e + rotateLeft(0x79cc4519, j)) & 0xffffffff) >>> 0,
      7,
    );
    const ss2 = (ss1 ^ rotateLeft(a, 12)) >>> 0;
    const tt1 = (ff(a, b, c, j) + d + ss2 + w[j + 68]) & 0xffffffff;
    const tt2 = (gg(e, f, g, j) + h + ss1 + w[j]) & 0xffffffff;

    d = c;
    c = rotateLeft(b, 9);
    b = a;
    a = tt1 >>> 0;
    h = g;
    g = rotateLeft(f, 19);
    f = e;
    e = p0(tt2);
  }

  return [
    (a ^ v[0]) >>> 0,
    (b ^ v[1]) >>> 0,
    (c ^ v[2]) >>> 0,
    (d ^ v[3]) >>> 0,
    (e ^ v[4]) >>> 0,
    (f ^ v[5]) >>> 0,
    (g ^ v[6]) >>> 0,
    (h ^ v[7]) >>> 0,
  ];
}

// SM3 哈希主函数
export function sm3Hash(input: string | number[]): number[] {
  // 将输入转换为字节数组
  let bytes: number[];
  if (typeof input === "string") {
    bytes = Array.from(new TextEncoder().encode(input));
  } else {
    bytes = input;
  }

  // 填充消息
  const padded = padMessage(bytes);

  // 初始化寄存器
  let v = [...SM3_IV];

  // 按 512 位（64 字节）分块处理
  for (let i = 0; i < padded.length; i += 64) {
    const block = padded.slice(i, i + 64);
    const w = expandMessage(block);
    v = compress(v, w);
  }

  // 将结果转换为字节数组（大端序）
  const result: number[] = [];
  for (const word of v) {
    result.push(
      (word >>> 24) & 0xff,
      (word >>> 16) & 0xff,
      (word >>> 8) & 0xff,
      word & 0xff,
    );
  }

  return result;
}

// SM3 哈希并返回十六进制字符串
export function sm3Hex(input: string | number[]): string {
  const result = sm3Hash(input);
  return result.map((b) => b.toString(16).padStart(2, "0")).join("");
}
