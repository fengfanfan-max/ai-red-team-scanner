# ai-red-team-scanner

> 开源的 AI 红队安全扫描平台：对用户自有的 AI 模型执行多维度安全评测（内容安全、隐私、合规、幻觉等），产出安全评分、风险分布与失败用例。

[![CI](https://github.com/your-org/ai-red-team-scanner/actions/workflows/ci.yml/badge.svg)](https://github.com/your-org/ai-red-team-scanner/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## 它能做什么（v1 路线图）

- **AI 应用管理**：注册任意 OpenAI 兼容模型端点（OpenAI / Anthropic / Gemini / Ollama 本地模型……），密钥加密存储、响应脱敏
- **安全扫描**：内置风险数据集（内容安全、隐私、合规、幻觉等类别）+ 自定义数据集导入，对目标模型发起评测
- **Judge 评测**：独立裁判模型对每条回答打分（0-10 + 理由），评分与目标模型解耦——可以用便宜或本地模型控成本
- **结果洞察**：整体安全评分、按类别风险分布、失败用例清单（prompt/answer/score/reason）
- **Dashboard**：扫描统计、最近扫描、风险趋势
- **灵活部署**：本地零依赖起步（SQLite），生产可切 PostgreSQL；`AUTH_MODE=disabled` 免登录模式

## 快速开始

### 前置要求

- Python >= 3.11（推荐 [uv](https://docs.astral.sh/uv/)）
- Node.js >= 22

### 裸跑（开发模式）

```bash
# 1. 启动后端（http://localhost:8000）
cd backend
uv sync
uv run uvicorn app.main:app --reload

# 2. 启动前端（http://localhost:5173，/api 代理到后端）
cd frontend
npm install
npm run dev
```

打开 http://localhost:5173 即可看到 hello 页与后端健康检查连通。

### Docker Compose（生产形态）

```bash
docker compose up --build          # SQLite 模式（单服务）
docker compose --profile postgres up --build   # PostgreSQL 模式
```

### 环境变量

| 变量 | 默认 | 说明 |
|---|---|---|
| `DATABASE_URL` | `sqlite+aiosqlite:///./data.db` | SQLAlchemy 连接串（Postgres 见 ADR-0002） |
| `AUTH_MODE` | `enabled` | `disabled` = 免登录模式（本地/演示） |
| `JWT_SECRET` | （必填，生产） | 签名密钥 |
| `ENCRYPTION_KEY` | （必填，生产） | 应用 API key 加密密钥（Fernet） |
| `SIMULATE_SCAN` | `false` | `true` = 模拟扫描引擎（演示/测试，不调 LLM） |

## 项目结构

```
├── backend/          # FastAPI 应用（REST API + 扫描引擎 + 静态托管前端）
│   ├── app/
│   ├── alembic/      # 数据库迁移
│   └── tests/
├── frontend/         # React 19 + Vite 7 SPA
│   └── src/
├── docs/
│   ├── CONTEXT.md    # 领域词汇表
│   ├── PLAN.md       # 开发计划与里程碑
│   └── adr/          # 架构决策记录
└── .github/workflows # CI
```

## 文档

- [开发计划与里程碑](docs/PLAN.md)
- [架构决策记录（ADR）](docs/adr/)
- [领域词汇表](docs/CONTEXT.md)
- [贡献指南](CONTRIBUTING.md)

## 路线图

- **v1（当前）**：认证 → AI 应用 → 扫描向导 → 扫描结果 → Dashboard（MVP 核心闭环）
- **v2 候选**：多租户 + RBAC、多模态媒体评测、PDF/CSV/ZIP 报告、WebSocket 实时进度

## 许可

[MIT](LICENSE)。内置数据集内容同样以 MIT 许可随仓库分发。
