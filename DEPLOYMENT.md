# 项目部署方案

## 方案一：Vercel（推荐 ⭐⭐⭐⭐⭐）

**优点：**
- 免费，自动 HTTPS
- 部署简单，支持 Git 自动部署
- 支持环境变量配置
- 全球 CDN 加速
- 国内访问速度一般

**部署步骤：**

### 1. 准备项目
```bash
# 确保项目可以正常构建
cd frontend
npm run build
```

### 2. 注册并部署
1. 访问 [Vercel](https://vercel.com)
2. 使用 GitHub/GitLab/Bitbucket 账号登录
3. 点击 "New Project"
4. 导入你的 Git 仓库（如果没有，可以先推送到 GitHub）
5. 配置项目：
   - **Framework Preset**: Vite
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
6. 添加环境变量（在项目设置中）：
   - `VITE_DASHSCOPE_API_KEY`
   - `VITE_DASHSCOPE_MODEL`
   - `VITE_DASHSCOPE_BASE_URL`
   - `VITE_DASHSCOPE_MAX_OUTPUT_TOKENS`
   - `VITE_DASHSCOPE_TEMPERATURE`
   - `VITE_DASHSCOPE_TIMEOUT_MS`
7. 点击 "Deploy"

### 3. 自动部署
- 每次推送到 Git 仓库，Vercel 会自动重新部署
- 部署完成后会获得一个 `*.vercel.app` 的域名

---

## 方案二：Netlify（推荐 ⭐⭐⭐⭐）

**优点：**
- 免费，自动 HTTPS
- 部署简单，支持拖拽部署
- 支持环境变量
- 国内访问速度一般

**部署步骤：**

### 1. 构建项目
```bash
cd frontend
npm run build
```

### 2. 注册并部署
1. 访问 [Netlify](https://www.netlify.com)
2. 注册账号（支持 GitHub 登录）
3. 选择部署方式：
   - **方式A（拖拽部署）**：
     - 点击 "Add new site" → "Deploy manually"
     - 将 `frontend/dist` 文件夹拖拽到页面
   - **方式B（Git 部署）**：
     - 点击 "Add new site" → "Import an existing project"
     - 连接 Git 仓库
     - 配置：
       - **Base directory**: `frontend`
       - **Build command**: `npm run build`
       - **Publish directory**: `frontend/dist`
4. 配置环境变量：
   - 进入 Site settings → Environment variables
   - 添加所有 `VITE_*` 开头的环境变量
5. 部署完成

---

## 方案三：GitHub Pages（免费 ⭐⭐⭐）

**优点：**
- 完全免费
- 与 GitHub 集成
- 国内访问可能较慢

**部署步骤：**

### 1. 安装 GitHub Actions
创建 `.github/workflows/deploy.yml`（已自动创建）

### 2. 配置 GitHub Pages
1. 在 GitHub 仓库设置中启用 Pages
2. 选择 Source: `GitHub Actions`
3. 推送代码后自动部署

### 3. 配置环境变量
在 GitHub 仓库 Settings → Secrets 中添加环境变量

---

## 方案四：云服务器 + Nginx（适合国内 ⭐⭐⭐⭐）

**优点：**
- 完全控制
- 国内访问速度快
- 需要服务器和域名

**部署步骤：**

### 1. 构建项目
```bash
cd frontend
npm run build
```

### 2. 上传到服务器
```bash
# 使用 scp 或 FTP 工具上传 dist 文件夹到服务器
scp -r dist/* user@your-server:/var/www/html/
```

### 3. 配置 Nginx
```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    root /var/www/html;
    index index.html;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

### 4. 配置环境变量
由于是静态部署，环境变量需要在构建时注入，或使用运行时配置。

---

## 方案五：阿里云/腾讯云 OSS + CDN（适合国内 ⭐⭐⭐⭐⭐）

**优点：**
- 国内访问速度快
- 成本低（OSS 存储便宜）
- 需要配置 CDN

**部署步骤：**

### 1. 构建项目
```bash
cd frontend
npm run build
```

### 2. 上传到 OSS
1. 在阿里云/腾讯云创建 OSS 存储桶
2. 设置静态网站托管
3. 上传 `dist` 文件夹内容
4. 配置 CDN 加速

### 3. 环境变量处理
需要在构建时注入，或使用配置文件。

---

## 环境变量配置说明

⚠️ **重要**：所有 `VITE_*` 开头的环境变量需要在部署平台配置，否则前端无法访问 API。

### Vercel/Netlify 配置方法：
1. 进入项目设置
2. 找到 "Environment Variables"
3. 添加以下变量：
   ```
   VITE_DASHSCOPE_API_KEY=你的API密钥
   VITE_DASHSCOPE_MODEL=qwen-max
   VITE_DASHSCOPE_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
   VITE_DASHSCOPE_MAX_OUTPUT_TOKENS=16384
   VITE_DASHSCOPE_TEMPERATURE=0.6
   VITE_DASHSCOPE_TIMEOUT_MS=200000
   ```

---

## 推荐方案对比

| 方案 | 难度 | 速度 | 成本 | 推荐度 |
|------|------|------|------|--------|
| Vercel | ⭐ | 一般 | 免费 | ⭐⭐⭐⭐⭐ |
| Netlify | ⭐ | 一般 | 免费 | ⭐⭐⭐⭐ |
| GitHub Pages | ⭐⭐ | 慢 | 免费 | ⭐⭐⭐ |
| 云服务器 | ⭐⭐⭐⭐ | 快 | 付费 | ⭐⭐⭐⭐ |
| OSS + CDN | ⭐⭐⭐ | 快 | 低 | ⭐⭐⭐⭐⭐ |

---

## 快速开始（Vercel）

1. 确保代码已推送到 GitHub
2. 访问 https://vercel.com 并登录
3. 点击 "New Project"
4. 导入仓库，配置环境变量
5. 点击 "Deploy"
6. 等待部署完成，获得公网地址

**完成！** 🎉

