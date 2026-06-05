import type { Configuration } from "electron-builder";

const config: Configuration = {
  // 应用程序的唯一标识符
  appId: "com.imsyy.splayer",
  // 应用程序的产品名称
  productName: "SPlayer",
  copyright: "Copyright © imsyy 2023",
  // 构建资源所在的目录
  directories: {
    buildResources: "build",
  },
  // 包含在最终应用程序构建中的文件列表
  // 使用通配符 ! 表示排除不需要的文件
  files: [
    "public/**",
    "out/**",
    "!**/.vscode/*",
    "!src/*",
    "!electron.vite.config.{js,ts,mjs,cjs}",
    "!{.eslintignore,.eslintrc.cjs,.prettierignore,.prettierrc.yaml,dev-app-update.yml,CHANGELOG.md,README.md}",
    "!{.env,.env.*,.npmrc,pnpm-lock.yaml}",
  ],
  // 哪些文件将不会被压缩，而是解压到构建目录
  asarUnpack: ["public/**"],
  // 将原生插件作为外部资源复制
  extraResources: [
    {
      from: "native/external-media-integration",
      to: "native",
      filter: ["*.node"],
    },
    {
      from: "native/taskbar-lyric",
      to: "native",
      filter: ["*.node"],
    },
    {
      from: "native/tools",
      to: "native",
      filter: ["*.node"],
    },
  ],
  win: {
    // 可执行文件名
    executableName: "SPlayer",
    // 应用程序的图标文件路径
    icon: "public/icons/logo.ico",
    // Windows 平台全局文件名模板
    artifactName: "${productName}-${version}-${arch}.${ext}",
    // 是否对可执行文件进行签名和编辑
    // signAndEditExecutable: false,
    // 构建类型（架构由命令行参数 --x64 或 --arm64 指定）
    target: [
      // 安装版
      {
        target: "nsis",
        arch: ["x64", "arm64"],
      },
      // 打包版
      {
        target: "portable",
        arch: ["x64", "arm64"],
      },
    ],
    // 注册协议
    protocols: [
      {
        name: "Orpheus Protocol",
        schemes: ["orpheus"],
      },
    ],
  },
  // NSIS 安装器配置
  nsis: {
    // 是否一键式安装
    oneClick: false,
    // 安装程序的生成名称
    artifactName: "${productName}-${version}-${arch}-setup.${ext}",
    // 创建的桌面快捷方式名称
    shortcutName: "${productName}",
    // 卸载时显示的名称
    uninstallDisplayName: "${productName}",
    // 创建桌面图标
    createDesktopShortcut: "always",
    // 是否允许 UAC 提升权限
    allowElevation: true,
    // 是否允许用户更改安装目录
    allowToChangeInstallationDirectory: true,
    // 安装包图标
    installerIcon: "public/icons/favicon.ico",
    // 卸载命令图标
    uninstallerIcon: "public/icons/favicon.ico",
  },
  // Portable 便携版配置
  portable: {
    // 便携版文件名
    artifactName: "${productName}-${version}-${arch}-portable.${ext}",
  },
  // 是否在构建之前重新编译原生模块
  npmRebuild: false,
  // Electron 下载镜像配置
  electronDownload: {
    mirror: "https://npmmirror.com/mirrors/electron/",
  },
  // 发布配置
  // 先留空，不自动上传
  publish: [],
};

export default config;
