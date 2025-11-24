# AI 课题感知问答前端

基于 React + TypeScript + Vite 的前端原型，用于展示「基于学校专有知识库的个性化教案生成系统（开发阶段）」：

- 页面内容聚焦模块概述与技术路线，突出“校本专属”定位
- 客户侧输入依旧经过课题识别 + System Prompt 注入，再调用千问（DashScope）生成草案
- 预置示例场景，方便展示“优秀教案知识库 + 动态 Prompt”工作方式
- 具备流式输出、动态超时回退、错误提示等前端基础设施，便于快速演示

## 快速开始

```bash
cd frontend
cp env.example .env.local   # Windows 可使用 copy 命令
npm install
npm run dev
```

> 提示：`npm run dev -- --host 0.0.0.0 --port 5173` 可在局域网内预览。

## 环境变量

| 变量名 | 说明 |
| --- | --- |
| `VITE_DASHSCOPE_API_KEY` | DashScope API Key（可与 `src/config/gemini.ts` 中的秘钥一起轮询） |
| `VITE_DASHSCOPE_MODEL` | （可选）模型名称，默认 `qwen-plus` |
| `VITE_DASHSCOPE_BASE_URL` | （可选）接口域名，默认 `https://dashscope.aliyuncs.com/compatible-mode/v1` |
| `VITE_DASHSCOPE_MAX_OUTPUT_TOKENS` | （可选）限制返回字数，默认 `4096`（前端会自动限制在 8192 以内） |
| `VITE_DASHSCOPE_TEMPERATURE` | （可选）温度，默认 `0.6` |
| `VITE_DASHSCOPE_TIMEOUT_MS` | （可选）超时时间，默认 `20000` 毫秒，会在连续超时时自动按 20 秒递增重试 |

如需接入其他兼容接口，既可修改 `VITE_DASHSCOPE_BASE_URL`，也可直接在 `src/config/gemini.ts` 中调整默认配置。

## 核心文件

- `src/config/prompt.ts`：存放 System Prompt，并导出 `composePrompt`
- `src/config/gemini.ts`：集中配置 DashScope Base URL、模型与轮询秘钥
- `src/lib/topic.ts`：课题检测策略，可接入后端服务
- `src/services/gemini.ts`：DashScope/OpenAI 兼容请求封装
- `src/App.tsx`：主界面（Prompt 预览、聊天窗口、输入面板）

> 如果需要按年级/学科切换不同 Prompt，可在 `src/config/prompt.ts` 中读取额外配置或加一个下拉菜单覆盖 `BASE_SYSTEM_PROMPT`。

## 展示内容与扩展

- 页面顶部概述了“模块介绍 + 分阶段技术路线（微调、知识库、迭代）”
- 第二块面板使用列表呈现微调/知识库/RAG/智能评估等关键步骤，可按需扩展
- 底部对话区仍可实时调用千问 API，演示“输入课题 → 检索校本经验 → 生成教案”流程原型
- `src/services/gemini.ts` 会对 `src/config/gemini.ts` 中的秘钥做**轮询访问**：若当前 Key 未响应或返回错误，立即切换下一个；成功后会顺延到下一枚 Key，以均衡调用频次。

若要进一步贴合真实项目，可：

- 将 `detectTopic` 替换为学校内部的课题分类服务
- 接入真实的校本知识库（RAG）和微调模型接口
- 根据展示需求调整模块描述与 Roadmap 内容
