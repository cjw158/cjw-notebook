# 部署指南

本文档介绍如何将应用部署到各种托管平台。

## 快速部署选项

### 1. Netlify（推荐）

最简单的部署方式：

#### 方法 A: 通过 Netlify CLI

```bash
# 安装 Netlify CLI
npm install -g netlify-cli

# 登录
netlify login

# 构建应用
npm run build

# 部署
netlify deploy --prod --dir=dist
```

#### 方法 B: 通过 Git 集成

1. 推送代码到 GitHub
2. 访问 [Netlify](https://www.netlify.com/)
3. 点击 "New site from Git"
4. 连接你的 GitHub 仓库
5. 设置构建命令：`npm run build`
6. 设置发布目录：`dist`
7. 点击 "Deploy site"

---

### 2. Vercel

另一个优秀的免费选项：

#### 通过 Vercel CLI

```bash
# 安装 Vercel CLI
npm install -g vercel

# 登录
vercel login

# 部署
vercel --prod
```

#### 通过 Git 集成

1. 访问 [Vercel](https://vercel.com/)
2. 导入你的 GitHub 仓库
3. Vercel 会自动检测配置
4. 点击 "Deploy"

---

### 3. GitHub Pages

完全免费，适合静态网站：

```bash
# 安装 gh-pages
npm install -g gh-pages

# 构建
npm run build

# 部署到 gh-pages 分支
gh-pages -d dist

# 应用将在以下地址访问：
# https://你的用户名.github.io/仓库名/
```

#### 配置 GitHub Pages：

1. 访问仓库的 Settings > Pages
2. Source 选择 `gh-pages` 分支
3. 点击 Save

#### 注意事项：

如果你的应用不在根路径，需要更新 `vite.config.ts`：

```typescript
export default defineConfig({
  base: '/your-repo-name/',
  // ... 其他配置
});
```

---

### 4. Firebase Hosting

Google 的托管服务：

```bash
# 安装 Firebase CLI
npm install -g firebase-tools

# 登录
firebase login

# 初始化
firebase init hosting

# 选择或创建项目
# 设置 public 目录为 dist
# 配置为单页应用：Yes

# 构建
npm run build

# 部署
firebase deploy
```

---

## 生产环境配置

### 构建优化：

在部署前确保构建是优化的：

```bash
npm run build
```

这会生成：
- 压缩的 JavaScript
- 优化的 CSS
- 压缩的 HTML
- Service Worker
- Manifest 文件
- 图标文件

### 环境要求：

- Node.js 18+ 或 20+
- npm 或 yarn
- HTTPS 连接（PWA 要求）

---

## 自定义域名

### Netlify:

1. 在 Netlify 控制台选择你的站点
2. 进入 Domain settings
3. 添加自定义域名
4. 更新 DNS 记录

### Vercel:

1. 在项目设置中选择 Domains
2. 添加域名
3. 按照指示配置 DNS

### GitHub Pages:

1. 在仓库根目录创建 `CNAME` 文件
2. 内容为你的域名，如：`example.com`
3. 在域名提供商配置 DNS 指向 GitHub Pages

---

## 环境变量

目前应用不需要环境变量，但如果将来需要：

### Netlify:

```bash
# 通过 UI 设置
Site settings > Build & deploy > Environment variables

# 或通过 CLI
netlify env:set VAR_NAME value
```

### Vercel:

```bash
# 通过 UI 设置
Project Settings > Environment Variables

# 或通过 CLI
vercel env add VAR_NAME
```

---

## 持续部署 (CI/CD)

### 自动部署：

当你推送到 main/master 分支时，Netlify 和 Vercel 会自动重新部署。

### GitHub Actions 示例：

创建 `.github/workflows/deploy.yml`：

```yaml
name: Deploy

on:
  push:
    branches: [ main ]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '20'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Build
      run: npm run build
    
    - name: Deploy to GitHub Pages
      uses: peaceiris/actions-gh-pages@v3
      with:
        github_token: ${{ secrets.GITHUB_TOKEN }}
        publish_dir: ./dist
```

---

## SSL/HTTPS

所有推荐的平台都自动提供免费 SSL 证书：

- Netlify: 自动 Let's Encrypt
- Vercel: 自动 SSL
- GitHub Pages: 自动 SSL
- Firebase: 自动 SSL

---

## 性能优化

### 1. 启用 Gzip/Brotli 压缩

大多数平台默认启用，无需配置。

### 2. 配置缓存头

#### Netlify (`netlify.toml`):

```toml
[[headers]]
  for = "/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"

[[headers]]
  for = "/sw.js"
  [headers.values]
    Cache-Control = "public, max-age=0, must-revalidate"
```

#### Vercel (`vercel.json`):

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    },
    {
      "source": "/sw.js",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=0, must-revalidate"
        }
      ]
    }
  ]
}
```

---

## 监控和分析

### Google Analytics:

在 `index.html` 中添加：

```html
<!-- Google Analytics -->
<script async src="https://www.googletagmanager.com/gtag/js?id=YOUR-GA-ID"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'YOUR-GA-ID');
</script>
```

### Netlify Analytics:

内置分析功能，无需代码修改。

---

## 故障排除

### 问题：PWA 不工作

检查：
- 应用是否通过 HTTPS 访问
- Service Worker 是否正确注册
- Manifest 文件是否可访问
- 图标文件是否存在

### 问题：部署后页面空白

检查：
- 浏览器控制台错误
- 资源路径是否正确
- `base` 配置是否正确（GitHub Pages）

### 问题：Service Worker 更新不生效

解决：
- 清除浏览器缓存
- 在开发者工具中点击 "Update on reload"
- 关闭所有页面标签后重新打开

---

## 下一步

部署完成后：

1. 测试 PWA 功能（安装、离线等）
2. 使用 Lighthouse 检查性能
3. 配置自定义域名（可选）
4. 使用 PWA Builder 生成 Android APK（参见 BUILD_APK.md）

---

## 推荐流程

**最快部署方式：**

```bash
# 1. 构建
npm run build

# 2. 部署到 Netlify
npm install -g netlify-cli
netlify deploy --prod --dir=dist

# 3. 获取 URL
# 4. 在 PWA Builder 生成 APK
```

这样你就有了：
- ✅ 在线可访问的 PWA
- ✅ 可以生成 Android APK 的 URL
- ✅ 自动 HTTPS
- ✅ 全球 CDN
- ✅ 持续部署

完全免费！
