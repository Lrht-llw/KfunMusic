/**
 * ABogus 签名算法
 * 基于 TikTokDownloader 的 Python 实现移植
 * 用于生成抖音 API 请求的 a_bogus 签名参数
 */

import { sm3Hash } from "./sm3";

// 初始寄存器值
const INITIAL_REG: number[] = [
  1937774191, 1226093241, 388252375, 3666478592,
  2842636476, 372324522, 3817729613, 2969243214,
];

// 自定义 Base64 字符集（s4 版本）
const S4_CHARSET =
  "Dkdpgh2ZmsQB80/MfvV36XI1R45-WUAlEixNLwoqYTOPuzKFjJnry79HbGcaStCe";

const S3_CHARSET =
  "ckdp1h4ZKsUB80/Mfvw36XIgR25+WQAlEi7NLboqYTOPuzmFjJnryx9HVGDaStCe";

// 方法后缀
const END_STRING = "cus";

// UA 加密 key
const UA_KEY = "\u0000\u0001\u000e";

// 默认浏览器信息
const DEFAULT_BROWSER =
  "1536|742|1536|864|0|0|0|0|1536|864|1536|864|1536|742|24|24|Win32";

// 默认 User-Agent
const DEFAULT_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

// 循环左移（与 Python 的 de 函数相同）
function rotateLeft(e: number, r: number): number {
  r = r % 32;
  return (((e << r) & 0xffffffff) | (e >>> (32 - r))) >>> 0;
}

// pe 函数（固定值）
function pe(e: number): number {
  return 0 <= e && e < 16 ? 2043430169 : 2055708042;
}

// he 函数
function he(e: number, r: number, t: number, n: number): number {
  if (0 <= e && e < 16) {
    return (r ^ t ^ n) >>> 0;
  } else if (16 <= e && e < 64) {
    return ((r & t) | (r & n) | (t & n)) >>> 0;
  }
  throw new Error(`he: invalid index ${e}`);
}

// ve 函数
function ve(e: number, r: number, t: number, n: number): number {
  if (0 <= e && e < 16) {
    return (r ^ t ^ n) >>> 0;
  } else if (16 <= e && e < 64) {
    return ((r & t) | (~r & n)) >>> 0;
  }
  throw new Error(`ve: invalid index ${e}`);
}

// 数据扩展函数 generate_f
function generateF(e: number[]): number[] {
  const r: number[] = new Array(132).fill(0);

  // 前 16 个字直接从输入数据获取
  for (let t = 0; t < 16; t++) {
    r[t] =
      ((e[4 * t] << 24) |
        (e[4 * t + 1] << 16) |
        (e[4 * t + 2] << 8) |
        e[4 * t + 3]) >>>
      0;
  }

  // W16 ~ W67 扩展
  for (let n = 16; n < 68; n++) {
    const a =
      ((r[n - 16] ^ r[n - 9] ^ rotateLeft(r[n - 3], 15)) ^
        rotateLeft(r[n - 16] ^ r[n - 9] ^ rotateLeft(r[n - 3], 15), 15) ^
        rotateLeft(r[n - 16] ^ r[n - 9] ^ rotateLeft(r[n - 3], 15), 23)) ^
      rotateLeft(r[n - 13], 7) ^
      r[n - 6];
    r[n] = a >>> 0;
  }

  // W'0 ~ W'63
  for (let n = 68; n < 132; n++) {
    r[n] = (r[n - 68] ^ r[n - 64]) >>> 0;
  }

  return r;
}

// 压缩函数
function compress(reg: number[], data: number[]): number[] {
  const f = generateF(data);
  const i = [...reg];

  for (let o = 0; o < 64; o++) {
    let c = rotateLeft(i[0], 12) + i[4] + rotateLeft(pe(o), o);
    c = c & 0xffffffff;
    c = rotateLeft(c, 7);
    const s = (c ^ rotateLeft(i[0], 12)) >>> 0;

    let u = he(o, i[0], i[1], i[2]);
    u = (u + i[3] + s + f[o + 68]) & 0xffffffff;

    let b = ve(o, i[4], i[5], i[6]);
    b = (b + i[7] + c + f[o]) & 0xffffffff;

    i[3] = i[2];
    i[2] = rotateLeft(i[1], 9);
    i[1] = i[0];
    i[0] = u >>> 0;

    i[7] = i[6];
    i[6] = rotateLeft(i[5], 19);
    i[5] = i[4];
    i[4] = (b ^ rotateLeft(b, 9) ^ rotateLeft(b, 17)) >>> 0;
  }

  // XOR 到原始寄存器
  const result: number[] = [];
  for (let l = 0; l < 8; l++) {
    result.push((reg[l] ^ i[l]) >>> 0);
  }
  return result;
}

// 寄存器转数组
function regToArray(a: number[]): number[] {
  const o: number[] = new Array(32).fill(0);
  for (let i = 0; i < 8; i++) {
    const c = a[i];
    o[4 * i + 3] = c & 0xff;
    o[4 * i + 2] = (c >>> 8) & 0xff;
    o[4 * i + 1] = (c >>> 16) & 0xff;
    o[4 * i] = (c >>> 24) & 0xff;
  }
  return o;
}

// 填充函数
function padArray(arr: number[], length = 60): number[] {
  const result = [...arr];
  while (result.length < length) {
    result.push(0);
  }
  return result;
}

// 写入数据并填充
function writeAndPad(data: number[], chunkSize = 60): number[] {
  const size = data.length * 8;
  let chunk = [...data, 128];
  chunk = padArray(chunk, chunkSize);
  const sizeBytes: number[] = [];
  for (let i = 0; i < 4; i++) {
    sizeBytes.push((size >>> (8 * (3 - i))) & 0xff);
  }
  return [...chunk, ...sizeBytes];
}

// SM3 两次哈希，返回字节数组
function doubleSm3(data: string): number[] {
  const first = sm3Hash(data + END_STRING);
  return sm3Hash(first);
}

// 生成随机列表
function randomList(a: number, b = 170, c = 85, d = 0, e = 0, f = 0, g = 0): number[] {
  const rVal = a;
  const v: number[] = [rVal, (rVal | 0) & 255, (rVal | 0) >> 8];
  let s = (v[1] & b) | d;
  v.push(s);
  s = (v[1] & c) | e;
  v.push(s);
  s = (v[2] & b) | f;
  v.push(s);
  s = (v[2] & c) | g;
  v.push(s);
  return v.slice(-4);
}

// 生成字符串1（随机部分）
function generateString1(): string {
  const r1 = Math.floor(Math.random() * 10000);
  const r2 = Math.floor(Math.random() * 10000);
  const r3 = Math.floor(Math.random() * 10000);

  const part1 = randomList(r1, 170, 85, 1, 2, 5, 170 & 45);
  const part2 = randomList(r2, 170, 85, 1, 0, 0, 0);
  const part3 = randomList(r3, 170, 85, 1, 0, 5, 0);

  return String.fromCharCode(...part1, ...part2, ...part3);
}

// XOR 校验值
function endCheckNum(a: number[]): number {
  let r = 0;
  for (const i of a) {
    r ^= i;
  }
  return r;
}

// 生成字符串2列表
function generateString2List(
  urlParams: string,
  method: string,
  uaCode: number[],
  _browserCode: number[],
  browserLen: number,
): number[] {
  const startTime = Date.now();
  const endTime = startTime + Math.floor(Math.random() * 4) + 4;

  const paramsArray = doubleSm3(urlParams);
  const methodArray = doubleSm3(method);

  return [
    44,
    (endTime >>> 24) & 255,
    0,
    0,
    0,
    0,
    24,
    paramsArray[21],
    browserLen,
    0,
    uaCode[23],
    (endTime >>> 16) & 255,
    0,
    0,
    0,
    1,
    0,
    239,
    paramsArray[22],
    uaCode[24],
    (endTime >>> 8) & 255,
    (endTime >>> 0) & 255,
    0,
    0,
    0,
    0,
    (startTime >>> 24) & 255,
    0,
    0,
    14,
    (startTime >>> 16) & 255,
    (startTime >>> 8) & 255,
    0,
    (startTime >>> 0) & 255,
    methodArray[21],
    3,
    methodArray[22],
    1,
    Math.floor(endTime / 256 / 256 / 256 / 256) >> 0,
    1,
    Math.floor(startTime / 256 / 256 / 256 / 256) >> 0,
    0,
    0,
    0,
  ];
}

// RC4 加密
function rc4Encrypt(plaintext: string, key: string): string {
  const s: number[] = [];
  for (let i = 0; i < 256; i++) {
    s[i] = i;
  }

  let j = 0;
  for (let i = 0; i < 256; i++) {
    j = (j + s[i] + key.charCodeAt(i % key.length)) % 256;
    [s[i], s[j]] = [s[j], s[i]];
  }

  let i = 0;
  j = 0;
  const cipher: string[] = [];

  for (let k = 0; k < plaintext.length; k++) {
    i = (i + 1) % 256;
    j = (j + s[i]) % 256;
    [s[i], s[j]] = [s[j], s[i]];
    const t = (s[i] + s[j]) % 256;
    cipher.push(String.fromCharCode(s[t] ^ plaintext.charCodeAt(k)));
  }

  return cipher.join("");
}

// 自定义 Base64 编码
function generateResult(s: string, charset: string = S4_CHARSET): string {
  const result: string[] = [];

  for (let i = 0; i < s.length; i += 3) {
    let n: number;
    if (i + 2 < s.length) {
      n =
        (s.charCodeAt(i) << 16) |
        (s.charCodeAt(i + 1) << 8) |
        s.charCodeAt(i + 2);
    } else if (i + 1 < s.length) {
      n = (s.charCodeAt(i) << 16) | (s.charCodeAt(i + 1) << 8);
    } else {
      n = s.charCodeAt(i) << 16;
    }

    for (
      let shift = 18, mask = 0xfc0000;
      shift >= 0;
      shift -= 6, mask >>>= 6
    ) {
      if (shift === 6 && i + 1 >= s.length) break;
      if (shift === 0 && i + 2 >= s.length) break;
      result.push(charset[((n & mask) >>> shift) >>> 0]);
    }
  }

  const padCount = (4 - (result.length % 4)) % 4;
  for (let i = 0; i < padCount; i++) {
    result.push("=");
  }

  return result.join("");
}

// 主类
export class ABogus {
  private uaCode: number[];
  private browserCode: number[];
  private browserLen: number;

  constructor(userAgent: string = DEFAULT_UA, platform: string | null = null) {

    // UA 编码：RC4 加密 UA -> base64(s3) -> sum
    const uaEncrypted = rc4Encrypt(userAgent, UA_KEY);
    const uaEncoded = generateResult(uaEncrypted, S3_CHARSET);
    this.uaCode = this.sum(uaEncoded);

    // 浏览器信息
    const browser = platform ? this.generateBrowserInfo(platform) : DEFAULT_BROWSER;
    this.browserLen = browser.length;
    this.browserCode = Array.from(browser).map((c) => c.charCodeAt(0));
  }

  // 生成浏览器信息
  private generateBrowserInfo(platform: string): string {
    const innerWidth = 1280 + Math.floor(Math.random() * 640);
    const innerHeight = 720 + Math.floor(Math.random() * 360);
    const outerWidth = innerWidth + Math.floor(Math.random() * 200);
    const outerHeight = innerHeight + Math.floor(Math.random() * 200);
    const screenX = 0;
    const screenY = Math.random() > 0.5 ? 30 : 0;
    return [
      innerWidth,
      innerHeight,
      outerWidth,
      outerHeight,
      screenX,
      screenY,
      0,
      0,
      outerWidth,
      outerHeight,
      outerWidth,
      outerHeight,
      innerWidth,
      innerHeight,
      24,
      24,
      platform,
    ].join("|");
  }

  // sum 函数
  private sum(e: string, length = 60): number[] {
    const data = Array.from(e).map((c) => c.charCodeAt(0));
    let reg = [...INITIAL_REG];

    // 处理大于 64 字节的块
    if (data.length > 64) {
      const chunks: number[][] = [];
      for (let i = 0; i < data.length; i += 64) {
        chunks.push(data.slice(i, i + 64));
      }
      for (let i = 0; i < chunks.length - 1; i++) {
        reg = compress(reg, chunks[i]);
      }
      const lastChunk = writeAndPad(chunks[chunks.length - 1], length);
      return regToArray(compress(reg, lastChunk));
    }

    const chunk = writeAndPad(data, length);
    return regToArray(compress(reg, chunk));
  }

  // 获取 a_bogus 值
  getValue(urlParams: string, method = "GET"): string {
    const string1 = generateString1();

    // 生成字符串2
    const list2 = generateString2List(
      urlParams,
      method,
      this.uaCode,
      this.browserCode,
      this.browserLen,
    );
    const checkNum = endCheckNum(list2);
    const extended = [...list2, ...this.browserCode, checkNum];
    const string2 = rc4Encrypt(String.fromCharCode(...extended), "y");

    const combined = string1 + string2;
    return generateResult(combined, S4_CHARSET);
  }

  // 对参数对象进行编码并获取签名
  getValueFromParams(params: Record<string, string>, method = "GET"): string {
    const encoded = Object.entries(params)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join("&");
    return this.getValue(encoded, method);
  }
}
