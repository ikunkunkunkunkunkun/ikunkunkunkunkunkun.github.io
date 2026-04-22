---
title: n8n全自动AI短视频流水线搭建指南
date: 2025-01-20 21:53:48
tags: 圣地
categories: man
top_img: https://bu.dusays.com/2026/01/10/6961fed1da669.jpg
cover: https://bu.dusays.com/2026/01/10/6961fed030d47.jpg
top_single_background: https://bu.dusays.com/2026/01/10/6961fed0d6296.jpg
ai:
  - 本教程介绍了如何在博客中安装基于Hexo主题，并提供了安装、应用主题、修改配置文件、本地启动等详细步骤及技术支持方式。教程的内容针对最新的主题版本进行更新，如果你是旧版本教程会有出入。
  - 本文真不错
 
---
![n8n情况.png](https://bu.dusays.com/2026/04/18/69e33c77b8501.png)

[n8n Github](https://github.com/n8n-io/n8n)
全自动 AI 短视频工作流：n8n + MoneyPrinterTurbo 实战指南
本教程将详细介绍如何搭建一套“纯 CPU 运行、无需显卡”的短视频自动生成系统。通过 n8n 编排流程，实现从“输入话题”到“发布至 YouTube”的全自动化。

🏗️ 第一阶段：本地服务部署
1. 部署 n8n 服务
准备工作：确保本地已安装 Docker。

启动命令：
执行以下命令创建数据卷并启动容器。注意： 必须设置文件系统环境变量，否则无法处理视频文件。

Bash
# 创建数据卷
docker volume create n8n_data

# 启动 n8n 容器
docker run -d \
  --name n8n \
  --restart unless-stopped \
  -p 5678:5678 \
  -e N8N_DEFAULT_BINARY_DATA_MODE=filesystem \
  -v n8n_data:/home/node/.n8n \
  docker.n8n.io/n8nio/n8n
初始化：访问 http://localhost:5678 注册账号。

2. 部署 MoneyPrinterTurbo (视频生成服务)
源码配置：

从 GitHub 拉取代码。

将 config.sample.toml 重命名为 config.toml。

关键修改：将 subtitle 配置项复制一份到 [app] 项下方；在 [user] 项下配置 Pexels API Key。

启动服务：

Bash
docker compose up -d
基础设置：在 Web 界面配置 Google Gemini API Key 和 Pexels API Key。

🛠️ 第二阶段：n8n 工作流搭建步骤
1. 触发节点：表单提交 (Form Submission)
功能：接收视频主题。

设置：添加名为 topic 的文本字段，标题设为“视频话题”。

2. 文案生成：AI Agent 节点
提示词策略：要求 AI 生成包含“钩子”、“核心价值”和“行动号召”的文案。

模型挂载：使用 Gemini 2.0 Flash（推荐，速度快且免费额度高）。

格式化：挂载 Structured Output Parser 节点，指定输出为包含 title 和 content 的 JSON。

3. 视频生成：HTTP Request (POST)
接口地址：http://host.docker.internal:端口/generate_video

Body 参数：映射上一步生成的文案，设置视频比例（横/竖屏）、音色等。执行后获取 task_id。

4. 进度查询与循环逻辑
通过以下节点组合实现异步等待：

Wait 节点：设置等待 5 秒。

HTTP Request (GET)：调用 query_task 接口。

If 节点：判断 progress == 100。

False：连回 Wait 节点重新查询。

True：进入下一步。

5. 视频下载
HTTP Request (GET)：请求 API 返回的视频 URL，将二进制文件下载到工作流中。

6. 自动上传：YouTube 节点
API 准备：在 Google Cloud Console 开启 YouTube Data API v3，创建 OAuth 客户端 ID。

节点配置：

Resource: Video

Operation: Upload

Title: 映射 AI 生成的标题。

Binary Property: 选择下载的视频文件字段。

🚀 第三阶段：测试与限制说明
1. 运行测试
点击 Test Workflow，输入话题（如：“高效学习的 3 个习惯”），系统将自动执行：
文案创作 -> 素材匹配 -> 配音字幕 -> 合成视频 -> 自动上传。

⚠️ 重要提醒
网络通信：在 Docker 容器间通信时，务必使用 host.docker.internal 代替 127.0.0.1。

平台配额：YouTube API 每天有 10,000 点配额，通常支持每天上传 6 个 左右的视频，请勿高频触发。

存储空间：定期清理 n8n_data 卷中的临时视频文件，避免磁盘撑爆。