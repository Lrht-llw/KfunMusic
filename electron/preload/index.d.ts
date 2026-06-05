import { ElectronAPI } from "@electron-toolkit/preload";
import type { StoreType } from "../main/store";

// TikTokDownloader API 响应格式
interface DouyinFavoriteResponse {
  message: string;
  data: any[] | null;
  params: {
    cookie: string;
    proxy: string;
    source: boolean;
    pages: number | null;
    cursor: number;
    count: number;
  };
}

declare global {
  interface Window {
    electron: ElectronAPI;
    api: {
      store: {
        get<K extends keyof StoreType>(key: K): Promise<StoreType[K]>;
        set<K extends keyof StoreType>(key: K, value: StoreType[K]): Promise<boolean>;
        has(key: keyof StoreType): Promise<boolean>;
        delete(key: keyof StoreType): Promise<boolean>;
        reset(keys?: (keyof StoreType)[]): Promise<boolean>;
        export(data: any): Promise<{ success: boolean; path?: string; error?: string }>;
        import(): Promise<{ success: boolean; data?: any; error?: string }>;
      };
      file: {
        exists(path: string): Promise<boolean>;
        read(path: string, encoding?: BufferEncoding): Promise<string | null>;
      };
      cookie: {
        fileExists(): Promise<boolean>;
        readFile(): Promise<string | null>;
        selectAndCopyFile(): Promise<{ success: boolean; canceled: boolean; message: string; path: string | null }>;
      };
      douyin: {
        getFavorite(cursor: string, count: number): Promise<DouyinFavoriteResponse | null>;
        getFavoriteWithCookie(cookie: string, cursor: string, count: number): Promise<DouyinFavoriteResponse | null>;
      };
    };
    // logs
    logger: {
      info: (message: string, ...args: unknown[]) => void;
      warn: (message: string, ...args: unknown[]) => void;
      error: (message: string, ...args: unknown[]) => void;
      debug: (message: string, ...args: unknown[]) => void;
    };
  }
}
