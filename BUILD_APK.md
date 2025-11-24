# 打包成 Android APK 应用

本文档介绍如何将 PWA 应用打包成可安装的 Android APK/AAB 文件。

## 方法概览

有三种主要方法可以将 PWA 打包成 Android 应用：

1. **PWA Builder (推荐)** - 最简单，无需编程
2. **Trusted Web Activity (TWA)** - Google 官方方法
3. **Capacitor / Cordova** - 更多原生功能

---

## 方法 1: PWA Builder（最简单）

PWA Builder 是微软提供的免费工具，可以自动将 PWA 转换为 Android 应用。

### 步骤：

1. **部署你的应用**
   - 将应用部署到可访问的 URL（如 GitHub Pages, Netlify, Vercel）
   - 确保应用通过 HTTPS 访问

2. **访问 PWA Builder**
   - 打开 https://www.pwabuilder.com/
   - 输入你的应用 URL

3. **生成 Android 包**
   - 点击 "Build My PWA"
   - 选择 Android 平台
   - 选择 "Google Play" 或 "APK" 选项
   - 配置应用信息（包名、版本等）
   - 点击 "Generate" 生成包

4. **下载并安装**
   - 下载生成的 APK 或 AAB 文件
   - APK 可直接安装测试
   - AAB 需要上传到 Google Play 商店

### 优点：
- ✅ 无需编程知识
- ✅ 自动配置
- ✅ 生成符合 Google Play 要求的包
- ✅ 支持 TWA（Trusted Web Activity）

### 缺点：
- ❌ 需要应用已部署上线
- ❌ 自定义选项较少

---

## 方法 2: Bubblewrap CLI（命令行工具）

Bubblewrap 是 Google 提供的命令行工具，用于创建 TWA 应用。

### 安装：

```bash
npm install -g @bubblewrap/cli
```

### 步骤：

1. **初始化项目**
```bash
# 在项目根目录运行
bubblewrap init --manifest https://your-domain.com/manifest.json
```

2. **配置应用信息**
```bash
# 编辑生成的 twa-manifest.json 文件
# 设置包名、应用名称、图标等
```

3. **构建 APK**
```bash
bubblewrap build
```

4. **生成签名密钥（首次）**
```bash
# 如果没有密钥，运行：
keytool -genkey -v -keystore android-release-key.keystore -alias my-key-alias -keyalg RSA -keysize 2048 -validity 10000
```

5. **安装测试**
```bash
# 安装到连接的 Android 设备
adb install app-release-signed.apk
```

### 配置示例 (twa-manifest.json)：

```json
{
  "packageId": "com.yourname.mindspace",
  "host": "your-domain.com",
  "name": "MindSpace",
  "launcherName": "MindSpace",
  "display": "standalone",
  "themeColor": "#3b82f6",
  "backgroundColor": "#ffffff",
  "startUrl": "/",
  "iconUrl": "https://your-domain.com/icon-512.png",
  "maskableIconUrl": "https://your-domain.com/icon-512.png"
}
```

---

## 方法 3: Capacitor（适合需要原生功能）

如果需要访问原生 Android 功能（如相机、文件系统等），可以使用 Capacitor。

### 安装 Capacitor：

```bash
npm install @capacitor/core @capacitor/cli
npx cap init
```

### 配置 Capacitor：

```bash
# 添加 Android 平台
npx cap add android

# 配置 capacitor.config.json
```

### capacitor.config.json 示例：

```json
{
  "appId": "com.yourname.mindspace",
  "appName": "MindSpace",
  "webDir": "dist",
  "server": {
    "androidScheme": "https"
  }
}
```

### 构建应用：

```bash
# 1. 构建 web 应用
npm run build

# 2. 同步到 Android
npx cap sync android

# 3. 在 Android Studio 中打开
npx cap open android
```

### 在 Android Studio 中：

1. 等待 Gradle 构建完成
2. 连接 Android 设备或启动模拟器
3. 点击 Run 按钮测试
4. Build > Generate Signed Bundle / APK 生成发布版本

---

## 本地测试 APK（不上传应用商店）

### 准备工作：

1. **构建生产版本**
```bash
npm run build
```

2. **部署到本地服务器或在线托管**
   - 可以使用 GitHub Pages
   - 或者使用 `npm run preview` 本地测试

### 使用 PWA Builder 生成 APK：

适合测试的最快方法：

1. 部署应用到 GitHub Pages：
```bash
# 安装 gh-pages
npm install -g gh-pages

# 部署 dist 文件夹
gh-pages -d dist
```

2. 访问 https://www.pwabuilder.com/
3. 输入 GitHub Pages URL
4. 生成并下载 APK
5. 在 Android 设备上启用"未知来源安装"
6. 传输 APK 到手机并安装

---

## 签名和发布到 Google Play

### 1. 生成签名密钥：

```bash
keytool -genkey -v \
  -keystore mindspace-release-key.keystore \
  -alias mindspace \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

### 2. 配置签名信息：

创建 `android/key.properties`：
```properties
storePassword=你的密码
keyPassword=你的密码
keyAlias=mindspace
storeFile=../mindspace-release-key.keystore
```

### 3. 生成 AAB（Android App Bundle）：

```bash
# 使用 Bubblewrap
bubblewrap build --skipPwaValidation

# 或使用 Android Studio
# Build > Generate Signed Bundle / APK > Android App Bundle
```

### 4. 上传到 Google Play Console：

1. 访问 https://play.google.com/console
2. 创建应用
3. 上传 AAB 文件
4. 填写应用信息、截图等
5. 提交审核

---

## 快速开始指南（推荐新手）

### 最简单的方法：

1. **部署应用到 Netlify（免费）**
```bash
# 安装 Netlify CLI
npm install -g netlify-cli

# 登录
netlify login

# 部署
netlify deploy --prod --dir=dist
```

2. **使用 PWA Builder 生成 APK**
   - 访问 https://www.pwabuilder.com/
   - 输入 Netlify 给你的 URL
   - 下载 APK

3. **在 Android 手机上测试**
   - 开启"允许安装未知应用"
   - 安装 APK

---

## 注意事项

### 图标要求：
- 需要 192x192 和 512x512 的 PNG 图标
- 当前项目使用 SVG，需要转换为 PNG
- 可以使用在线工具：https://cloudconvert.com/svg-to-png

### HTTPS 要求：
- PWA 必须通过 HTTPS 访问
- 本地开发可以用 localhost
- 生产环境必须有 SSL 证书

### manifest.json 要求：
- 必须包含 name, short_name, start_url, display, icons
- 当前项目已包含，但图标需要改为 PNG

### Service Worker 要求：
- 必须正确注册并工作
- 当前项目已包含，无需修改

---

## 更新现有配置

需要更新 `public/manifest.json` 中的图标格式：

```json
{
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
}
```

然后需要创建实际的 PNG 图标文件。

---

## 推荐工作流程

### 开发 → 测试 → 发布：

1. **开发阶段**
   - 本地开发：`npm run dev`
   - 使用 Chrome DevTools 测试 PWA 功能

2. **测试阶段**
   - 部署到测试环境（Netlify/Vercel）
   - 使用 PWA Builder 生成测试 APK
   - 在真实 Android 设备上测试

3. **发布阶段**
   - 创建正式图标（PNG 格式）
   - 使用 Bubblewrap 或 Capacitor 生成签名 AAB
   - 上传到 Google Play Console

---

## 常见问题

### Q: APK 和 AAB 有什么区别？
A: 
- APK：可直接安装，适合测试和分发
- AAB：必须通过 Google Play，文件更小，支持动态交付

### Q: 必须上传到 Google Play 吗？
A: 不必须。可以直接分发 APK 文件，但用户需要允许"未知来源"安装。

### Q: 生成的 APK 文件在哪里？
A: 
- PWA Builder：下载到浏览器下载目录
- Bubblewrap：项目的 `app-release-signed.apk`
- Capacitor：`android/app/build/outputs/apk/release/`

### Q: 如何更新已发布的应用？
A: 
1. 修改代码
2. 增加版本号（manifest.json 和 package.json）
3. 重新构建 APK/AAB
4. 上传新版本到 Google Play 或重新分发 APK

---

## 相关资源

- [PWA Builder](https://www.pwabuilder.com/)
- [Bubblewrap 文档](https://github.com/GoogleChromeLabs/bubblewrap)
- [Capacitor 文档](https://capacitorjs.com/docs)
- [Android Studio 下载](https://developer.android.com/studio)
- [Google Play Console](https://play.google.com/console)

---

## 总结

**推荐方案：**

- **快速测试**：PWA Builder + Netlify
- **长期维护**：Bubblewrap CLI
- **需要原生功能**：Capacitor

无论选择哪种方法，核心都是将现有的 PWA 包装成 Android 应用，保持 web 技术的优势同时获得原生应用的体验。
