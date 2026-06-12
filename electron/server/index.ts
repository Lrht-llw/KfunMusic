import { join } from "path";
import { isDev } from "../main/utils/config";
import { serverLog } from "../main/logger";
import { initNcmAPI } from "./netease";
import { initUnblockAPI } from "./unblock";
import { initControlAPI } from "./control";
import { initQQMusicAPI } from "./qqmusic";
import fastifyCookie from "@fastify/cookie";
import fastifyMultipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import fastify from "fastify";
import pkg_xeapiKey from "@neteasecloudmusicapienhanced/api/util/xeapiKey.js";
const { getXeapiPublicKey } = pkg_xeapiKey;
import pkg_main from "@neteasecloudmusicapienhanced/api/main.js";
const { register_anonimous } = pkg_main;
import pkg_util from "@neteasecloudmusicapienhanced/api/util/index.js";
const { cookieToJson, generateRandomChineseIP, generateDeviceId } = pkg_util;
import fs from "fs";
import path from "path";
import os from "os";

const tmpPath = os.tmpdir();

// 自定义初始化函数，确保顺序正确
const initNeteaseConfig = async () => {
  // 生成设备 ID
  const deviceId = generateDeviceId();
  global.deviceId = deviceId;
  serverLog.info(`📱 Generated device ID: ${deviceId}`);

  // 生成中国 IP
  global.cnIp = generateRandomChineseIP();
  serverLog.info(`🌐 Generated Chinese IP: ${global.cnIp}`);

  // 先获取 xeapi 公钥
  const xeapiPublicKeyPath = path.resolve(tmpPath, "xeapi_public_key");
  let currentPublicKey: Record<string, unknown> = {};
  try {
    currentPublicKey = JSON.parse(fs.readFileSync(xeapiPublicKeyPath, "utf-8"));
  } catch {
    // 文件不存在，使用空对象
  }

  // 如果已有公钥，跳过获取
  if (currentPublicKey.sk) {
    serverLog.info("✅ xeapi public key already cached");
  } else {
    // 尝试获取公钥，重试 3 次
    for (let i = 1; i <= 3; i++) {
      try {
        const publicKey = await getXeapiPublicKey(currentPublicKey, deviceId);
        fs.writeFileSync(xeapiPublicKeyPath, JSON.stringify(publicKey), "utf-8");
        serverLog.info(`✅ xeapi public key obtained (attempt ${i})`);
        break;
      } catch (error) {
        const err = error as Error;
        serverLog.error(`❌ Failed to get xeapi public key (attempt ${i}/3): ${err.message}`);
        if (i < 3) {
          // 等待 1 秒后重试
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
    }
  }

  // 再注册匿名用户
  try {
    const res = await register_anonimous({});
    const cookie = res.body.cookie;
    if (cookie) {
      const cookieObj = cookieToJson(cookie);
      fs.writeFileSync(path.resolve(tmpPath, "anonymous_token"), cookieObj.MUSIC_A, "utf-8");
      serverLog.info("✅ Anonymous token registered");
    }
  } catch (error) {
    const err = error as Error;
    serverLog.error(`❌ Failed to register anonymous token: ${err.message}`);
  }
};

const initAppServer = async () => {
  try {
    // 初始化网易云音乐 API 配置（生成 xeapi 公钥等）
    serverLog.info("🔧 Initializing Netease API config...");
    await initNeteaseConfig();
    serverLog.info("✅ Netease API config initialized");

    const server = fastify({
      routerOptions: {
        // 忽略尾随斜杠
        ignoreTrailingSlash: true,
      },
    });
    // 注册插件
    server.register(fastifyCookie);
    server.register(fastifyMultipart);
    // 生产环境启用静态文件
    if (!isDev) {
      serverLog.info("📂 Serving static files from /renderer");
      server.register(fastifyStatic, {
        root: join(__dirname, "../renderer"),
      });
    }
    // 声明
    server.get("/api", (_, reply) => {
      reply.send({
        name: "SPlayer API",
        description: "SPlayer API service",
        author: "@imsyy",
        list: [
          {
            name: "NeteaseCloudMusicApi",
            url: "/api/netease",
          },
          {
            name: "UnblockAPI",
            url: "/api/unblock",
          },
          {
            name: "ControlAPI",
            url: "/api/control",
          },
          {
            name: "QQMusicAPI",
            url: "/api/qqmusic",
          },
        ],
      });
    });
    // 注册接口
    server.register(initNcmAPI, { prefix: "/api" });
    server.register(initUnblockAPI, { prefix: "/api" });
    server.register(initControlAPI, { prefix: "/api" });
    server.register(initQQMusicAPI, { prefix: "/api" });
    // 启动端口
    const port = Number(process.env["VITE_SERVER_PORT"] || 25884);
    await server.listen({ port, host: "127.0.0.1" });
    serverLog.info(`🌐 Starting AppServer on port ${port}`);
    return server;
  } catch (error) {
    serverLog.error("🚫 AppServer failed to start");
    throw error;
  }
};

export default initAppServer;
