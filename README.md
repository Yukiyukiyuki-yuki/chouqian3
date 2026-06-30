# 🔮 玄学大师 - AI 赋能六大玄学

AI 看手相 · AI 看面相 · 隔空摇签 · 八字命理 · 紫微斗数 · 星座运势

---

## 🚀 三步部署到 Vercel（推荐）

### 第一步：上传代码到 GitHub

1. 在 GitHub 创建一个新仓库（如 `fortune-master`）
2. 把这个项目文件夹 push 上去：

```bash
cd fortune-master
git init
git add .
git commit -m "🔮 玄学大师初始化"
git branch -M main
git remote add origin https://github.com/你的用户名/fortune-master.git
git push -u origin main
```

### 第二步：在 Vercel 部署

1. 访问 [vercel.com](https://vercel.com)，用 GitHub 账号登录
2. 点击 **"Add New Project"**
3. 选择刚才的 `fortune-master` 仓库
4. Framework 会自动检测为 Vite，直接点 **"Deploy"**

### 第三步：配置 API Key

1. 部署完成后，进入项目 → **Settings** → **Environment Variables**
2. 添加以下变量：

**使用 DeepSeek（默认）：**
| Key | Value |
|-----|-------|
| `API_PROVIDER` | `deepseek` |
| `DEEPSEEK_API_KEY` | `sk-xxx`（你的 DeepSeek API Key） |
| `DEEPSEEK_MODEL` | `deepseek-chat`（可选，默认值） |

**使用 Claude：**
| Key | Value |
|-----|-------|
| `API_PROVIDER` | `claude` |
| `ANTHROPIC_API_KEY` | `sk-ant-xxx`（你的 Claude API Key） |

3. 点击 **Save**
4. 回到 **Deployments** 页面，点击最新部署旁的 **⋯** → **Redeploy**

> 💡 手相/面相功能需要 AI 模型支持图片输入。DeepSeek 的 `deepseek-chat` 已支持多模态，Claude 全系列支持。

✅ 部署完成！访问 Vercel 给你的域名即可使用。

> 摄像头功能需要 HTTPS 环境，Vercel 自动提供 HTTPS，所以隔空摇签功能部署后即可正常使用。

---

## 💻 本地开发

```bash
# 安装依赖
npm install

# 复制环境变量文件并填入你的 API Key
cp .env.example .env
# 编辑 .env 填入 ANTHROPIC_API_KEY=sk-ant-xxxxx

# 启动开发服务器
npm run dev
```

> ⚠️ 本地开发时 API 代理需要额外启动一个后端服务。最简单的方式是用 Vercel CLI：
>
> ```bash
> npm i -g vercel
> vercel dev
> ```
>
> 这会同时启动前端 + serverless function。

---

## 📁 项目结构

```
fortune-master/
├── api/
│   └── chat.js          ← Claude API 代理（Vercel Serverless Function）
├── src/
│   ├── App.jsx          ← 主组件（六大功能模块）
│   ├── main.jsx         ← React 入口
│   └── index.css        ← 全局样式
├── index.html           ← HTML 入口
├── package.json
├── vite.config.js
├── vercel.json          ← Vercel 部署配置
└── .env.example         ← 环境变量示例
```

---

## 🔐 安全说明

- Claude API Key 存储在 Vercel 的环境变量中，**不会暴露到前端代码**
- 前端通过 `/api/chat` 接口与后端通信，后端再转发给 Claude API
- 如需增加访问限制（如 IP 白名单、Token 验证），可在 `api/chat.js` 中添加

---

## 📱 功能说明

| 功能 | 交互方式 | 说明 |
|------|---------|------|
| 🤚 AI 看手相 | 上传/拍照 | 上传手掌照片，AI 分析掌纹 |
| 🧿 AI 看面相 | 上传/拍照 | 上传面部照片，AI 分析五官 |
| 🎋 隔空摇签 | 摄像头/鼠标/键盘 | 挥手摇签，帧差检测动作幅度 |
| 📜 八字命理 | 表单输入 | 输入生辰排盘解读 |
| ⭐ 紫微斗数 | 表单输入 | 紫微排盘十二宫位 |
| ♈ 星座运势 | 选择星座 | 今日/本周/本月运势 |

---

Built with React + Vite + Claude API ✨
