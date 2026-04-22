---
title: 基于 n8n 与 DeepSeek 构建 AI 新闻追热点 Agent
date: 2025-06-18 20:50:37
cover: https://bu.dusays.com/2026/04/18/69e38766079bb.png
top_img: https://bu.dusays.com/2026/04/18/69e38766079bb.png
tags:
---

<img src='https://bu.dusays.com/2026/04/22/69e8c471dc4e8.png' />
---

[(google云盘)操作文档.pdf](https://drive.google.com/file/d/1ODjC12EowqMWVXQ1FucVNR4k5W8cmFrS/view?usp=sharing)
# 自动化实践：基于 n8n 与 DeepSeek 构建 AI 新闻追热点 Agent
内容来源于[秋之2046](https://www.bilibili.com/video/BV1KSKwzJEEV/?spm_id_from=333.1387.upload.video_card.click)
## 📌 前置准备
1. **飞书多维表格建立**：创建一个多维表格，包含以下 6 个字段的表头即可。

---

## 第一步：安装 Docker & n8n
### 工具链接
* **Docker 官网**: [https://www.docker.com/](https://www.docker.com/)
* **n8n 官网**: [https://n8n.io/](https://n8n.io/)

### 终端部署命令
在终端执行以下命令进行安装：

```bash
# 1. 下载并运行 n8n
docker volume create n8n_data

# 标准安装命令
docker run -d --name n8n --restart unless-stopped -p 5678:5678 -v n8n_data:/home/node/.n8n docker.n8n.io/n8nio/n8n

# 如果网络环境不佳，请尝试使用以下镜像：
docker run -d --name n8n --restart unless-stopped -p 5678:5678 -v n8n_data:/home/node/.n8n n8nio/n8n
```

### 常用管理命令
* **停止 n8n**: `docker stop n8n`
* **启动 n8n**: `docker start n8n`

---

## 第二步：设置触发器 (Trigger)
在 n8n 中创建新项目，添加 **Schedule Trigger**（按计划触发器），设定 Agent 自动启动的时间点。

---

## 第三步：添加 Agent 节点
点击节点编辑器的加号，选择 **AI -> Agent**。

---

## 第四步：连接大脑 (LLM)
获取 API 密钥以驱动 AI 逻辑：
* **DeepSeek 开放平台**: [https://platform.deepseek.com/](https://platform.deepseek.com/)

---

## 第五步：记忆配置 (Memory)
在工具栏选择 **Simple Memory** 给 AI 配置上下文记忆。*(注：本案例流程简单，可根据需求选择是否配置)*。

---

## 第六步：配置工具 (Tools)

### 1. 安装飞书节点包
* **包名**: `n8n-nodes-feishu-lite`

### 2. 获取凭证
前往 [飞书开放平台](https://open.feishu.cn/) 创建应用，获取 `appid` 和 `appsecret`。

### 3. 数据过滤逻辑 (Filter)
查询多维表格中**今天**和**昨天**的数据，使用以下 JSON 配置：

```json
{
  "filter": {
    "conjunction": "or",
    "conditions": [
      {
        "field_name": "创建时间",
        "operator": "is",
        "value": ["Today"]
      },
      {
        "field_name": "创建时间",
        "operator": "is",
        "value": ["Yesterday"]
      }
    ]
  }
}
```

### 4. 获取日历日程 (Unix 时间戳)
使用 JavaScript 表达式计算时间范围：
* **今天起始**: `{{ (Math.floor((Math.floor(Date.now()/1000) + 28800) / 86400) * 86400 - 28800) }}`
* **未来 7 天**: `{{ (Math.floor((Math.floor(Date.now()/1000) + 28800) / 86400) * 86400 - 28800) + 604800 + 86399 }}`

---

## 第七步：配置 HTTP 群聊机器人 (Webhook)
在飞书群聊中添加“自定义机器人”，配置 HTTP Request 节点：
* **Header**: `Content-Type: application/json`
* **Body (卡片消息结构)**:

```json
{
  "msg_type": "interactive",
  "card": {
    "schema": "2.0",
    "header": {
      "title": { "tag": "plain_text", "content": "AI News" },
      "template": "blue"
    },
    "body": {
      "elements": [
        {
          "tag": "markdown",
          "content": "{{ $json.output ? JSON.stringify($json.output).slice(1, -1) : '' }}"
        }
      ]
    }
  }
}
```

---

## 第八步：Agent 提示词 (Prompt) 工程

### 角色定义
你是我的专属 AI 助理“新闻报通”！你的使命是帮我洞察最新的 AI 动态，并结合我的工作日程，智能推荐内容。

### 核心指令
1.  **信息收集**：调用 `news` 工具抓取近 2 天多维表格新闻；调用 `daily` 工具获取未来 7 天日程。
2.  **智能分析**：生成一段 Markdown 文本（不包含代码块包裹符）。
3.  **结构模板**：
    * `### 🚀 AI圈今日速递与【专属建议】`
    * `🌟 今日AI新闻看板` (循环展示新闻标题、摘要及链接)
    * `📅 近期日程概览`
    * `💡 综合建议与排期参考`

---

## 🚀 总结与资源
恭喜！你已完成了一套自动化的 AI 新闻订阅 Agent。

### 优质资源推荐
* **n8n 社区节点**: [awesome-n8n](https://github.com/restyler/awesome-n8n)
* **工作流模板**: [n8n Workflows](https://n8n.io/workflows/)
* **优质 RSS 源**: [top-rss-list](https://github.com/weekend-project-space/top-rss-list)
* **外部 API**: [天行 API](https://www.tianapi.com/)