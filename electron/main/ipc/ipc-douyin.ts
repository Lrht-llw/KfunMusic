import { app, ipcMain, dialog } from "electron";
import { readFile, mkdir, copyFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { DouyinMusicService, DouyinMusicItem } from "../../../src/dyapi/douyinMusicService";
import { ipcLog } from "../logger";

const getAppRootPath = (): string => {
  if (app.isPackaged) {
    return dirname(app.getPath("exe"));
  }
  return process.cwd();
};

// 抖音收藏列表响应类型（保持与原有格式兼容）
interface DouyinFavoriteResponse {
  message: string;
  data: {
    mc_list: DouyinMusicItem[];
    cursor: number;
    has_more: number;
  } | null;
  params: {
    cookie: string;
    proxy: string;
    source: boolean;
    pages: number | null;
    cursor: number;
    count: number;
  };
}

interface DouyinFavoriteParams {
  cursor: string;
  count: number;
}

// 从 Netscape 格式 Cookie 文件提取抖音 Cookie
function getDouyinCookieFromNetscape(content: string): string {
  const lines = content.split(/\r\n|\r|\n/);
  const cookies: string[] = [];

  for (const line of lines) {
    if (line.startsWith("#") || line.trim() === "") {
      continue;
    }

    const parts = line.split("\t");
    if (parts.length >= 7) {
      const domain = parts[0].trim();
      const name = parts[5].trim();
      const value = parts[6].trim();

      if (
        domain.includes("douyin.com") ||
        domain.includes(".douyin.com") ||
        domain.includes("iesdouyin.com")
      ) {
        cookies.push(`${name}=${value}`);
      }
    }
  }

  return cookies.join("; ");
}

export function registerDouyinIpc() {
  // 让用户选择 Cookie 文件并复制到 cookies 目录
  ipcMain.handle("douyin-select-and-copy-cookie", async () => {
    const appRoot = getAppRootPath();
    const targetDir = join(appRoot, "cookies");
    const targetPath = join(targetDir, "cookies.txt");

    ipcLog.info(`[Douyin] Opening file picker for cookie file selection`);

    // 弹出文件选择对话框
    const result = await dialog.showOpenDialog({
      title: "选择抖音 Cookie 文件",
      buttonLabel: "选择此文件",
      filters: [{ name: "文本文件", extensions: ["txt"] }],
      properties: ["openFile"],
    });

    if (result.canceled || result.filePaths.length === 0) {
      ipcLog.info(`[Douyin] User canceled file selection`);
      return { success: false, canceled: true, message: "已取消选择文件", path: null };
    }

    const sourcePath = result.filePaths[0];
    ipcLog.info(`[Douyin] Selected source file: ${sourcePath}`);
    ipcLog.info(`[Douyin] Target path: ${targetPath}`);

    try {
      // 创建 cookies 目录（如不存在）
      await mkdir(targetDir, { recursive: true });
      ipcLog.info(`[Douyin] Directory ready: ${targetDir}`);

      // 复制文件到目标位置
      await copyFile(sourcePath, targetPath);
      ipcLog.info(`[Douyin] File copied successfully to: ${targetPath}`);

      return {
        success: true,
        canceled: false,
        message: "Cookie 文件已加载",
        path: targetPath,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      ipcLog.error(`[Douyin] Failed to copy cookie file: ${errorMessage}`);
      return {
        success: false,
        canceled: false,
        message: `复制文件失败: ${errorMessage}`,
        path: null,
      };
    }
  });

  ipcMain.handle(
    "douyin-get-favorite",
    async (_, params: DouyinFavoriteParams): Promise<DouyinFavoriteResponse | null> => {
      try {
        const appRoot = getAppRootPath();
        ipcLog.info(`[Douyin] App root path: ${appRoot}`);

        // 读取 Cookie 文件
        const filePath = join(appRoot, "cookies", "cookies.txt");
        ipcLog.info(`[Douyin] Cookie file path: ${filePath}`);

        let content: string;
        try {
          content = await readFile(filePath, "utf-8");
          ipcLog.info(`[Douyin] Cookie file read successfully, length: ${content.length}`);
        } catch (fileErr) {
          const fileErrorMessage = fileErr instanceof Error ? fileErr.message : "File read error";
          ipcLog.error(`[Douyin] Failed to read cookie file: ${fileErrorMessage}`);
          return {
            message: `读取 Cookie 文件失败: ${fileErrorMessage}`,
            data: null,
            params: {
              cookie: "",
              proxy: "",
              source: false,
              pages: null,
              cursor: 0,
              count: params.count,
            },
          };
        }

        const cookie = getDouyinCookieFromNetscape(content);

        if (!cookie) {
          ipcLog.warn("[Douyin] 未找到有效的抖音 Cookie");
          return {
            message: "未找到有效的抖音 Cookie，请检查 cookies.txt 文件内容",
            data: null,
            params: {
              cookie: "",
              proxy: "",
              source: false,
              pages: null,
              cursor: 0,
              count: params.count,
            },
          };
        }

        ipcLog.info(`[Douyin] Cookie loaded, length: ${cookie.length}`);

        // 使用内置的 DouyinMusicService 直接调用抖音 API
        ipcLog.info("[Douyin] Calling Douyin Web API directly via DouyinMusicService");

        try {
          const service = new DouyinMusicService(cookie);
          const cursor = parseInt(params.cursor) || 0;
          const response = await service.getFavoriteList(cursor, params.count);

          ipcLog.info(`[Douyin] API response status: 200`);
          ipcLog.info(`[Douyin] API response message: 获取数据成功！`);
          ipcLog.info(
            `[Douyin] Pagination - requestCursor=${cursor}, responseCursor=${response.cursor}, responseHasMore=${response.has_more}`,
          );

          if (response.mc_list && response.mc_list.length > 0) {
            ipcLog.info(`[Douyin] Data count: ${response.mc_list.length}`);

            const firstItem = response.mc_list[0];
            ipcLog.info(
              `[Douyin] First music item keys: ${Object.keys(firstItem || {}).join(", ")}`,
            );
            ipcLog.info(
              `[Douyin] First music item: ${JSON.stringify(firstItem).substring(0, 300)}`,
            );
          } else {
            ipcLog.info(`[Douyin] API response mc_list is empty`);
          }

          return {
            message: "获取数据成功！",
            data: {
              mc_list: response.mc_list,
              cursor: response.cursor,
              has_more: response.has_more,
            },
            params: {
              cookie: "",
              proxy: "",
              source: true,
              pages: 1,
              cursor: response.cursor,
              count: params.count,
            },
          };
        } catch (apiError) {
          const errorMsg =
            apiError instanceof Error ? apiError.message : String(apiError);
          ipcLog.error(`[Douyin] API error: ${errorMsg}`);
          return {
            message: `抖音 API 请求失败: ${errorMsg}`,
            data: null,
            params: {
              cookie: "",
              proxy: "",
              source: false,
              pages: null,
              cursor: 0,
              count: params.count,
            },
          };
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        ipcLog.error("[Douyin] 获取收藏音乐列表失败:", errorMessage);
        return {
          message: `请求失败: ${errorMessage}`,
          data: null,
          params: {
            cookie: "",
            proxy: "",
            source: false,
            pages: null,
            cursor: 0,
            count: params.count,
          },
        };
      }
    },
  );

  ipcLog.info("[Douyin] IPC handlers registered");
}

export default registerDouyinIpc;
