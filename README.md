# ai-red-team-scanner

> 开源的 AI 红队安全扫描平台：对用户自有的 AI 模型执行多维度安全评测（内容安全、隐私、合规、幻觉等），产出安全评分、风险分布与失败用例。

[![CI](https://github.com/fengfanfan-max/ai-red-team-scanner/actions/workflows/ci.yml/badge.svg)](https://github.com/fengfanfan-max/ai-red-team-scanner/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## 功能（v1 已实现）

- **AI 应用管理**：注册任意 OpenAI 兼容模型端点（OpenAI / Anthropic / Gemini / Ollama 本地模型……），密钥 Fernet 加密存储、响应仅返回掩码；创建后可测试对话
- **安全扫描**：5 步创建向导（选应用/算法/数据集/试聊/高级设置），内置 5 类风险数据集（75 条提示词）+ 自定义 JSON 导入
- **Judge 评测**：独立裁判模型对每条回答打分（0-10 + 理由，结构化输出），与目标模型解耦——可用便宜或本地模型控成本；启动前显示预计 LLM 调用量
- **实时进度**：扫描列表 2s 轮询、百分比 + 剩余时间、断点续跑（重启恢复）
- **结果洞察**：安全评分、按类别风险分布、失败用例表格 + 详情抽屉（prompt/answer/score/reason）
- **Dashboard**：统计卡（扫描数/平均分/高风险数）、最近扫描、类别风险分布
- **灵活部署**：本地零依赖起步（SQLite），生产可切 PostgreSQL；`AUTH_MODE=disabled` 免登录模式；`SIMULATE_SCAN=true` 模拟引擎（演示/测试免真实 key）

## 十分钟跑通全流程

```bash
# 前置：Python ≥ 3.11（uv）、Node ≥ 22

# 1. 后端（模拟引擎 + 免登录，无需任何 API key）
cd backend
uv sync
uv run alembic upgrade head
SIMULATE_SCAN=true AUTH_MODE=disabled uv run uvicorn app.main:app --reload

# 2. 前端
cd frontend
npm install
npm run dev
```

打开 http://localhost:5173 → 新建一个 AI 应用（key 随便填，模拟模式不调用）→ Scans → New scan → 走完向导 → 列表看到进度到 100% → 点进结果页看评分与失败用例。

> 真实扫描：去掉 `SIMULATE_SCAN=true`，在应用里填真实 OpenAI 兼容端点与 key；也可在向导第 5 步配置便宜的 judge 模型（如 Ollama 本地模型）。

### Docker Compose（生产形态）

```bash
docker compose up --build          # SQLite 模式（单服务）
docker compose --profile postgres up --build   # PostgreSQL 模式
```

> 生产必须设置 `JWT_SECRET`（≥32 字节）与 `ENCRYPTION_KEY`（Fernet key）。

### 环境变量

| 变量 | 默认 | 说明 |
|---|---|---|
| `DATABASE_URL` | `sqlite+aiosqlite:///./data.db` | SQLAlchemy 连接串（Postgres 见 ADR-0002） |
| `AUTH_MODE` | `enabled` | `disabled` = 免登录模式（本地/演示） |
| `JWT_SECRET` | （必填，生产） | 签名密钥 |
| `ENCRYPTION_KEY` | （必填，生产） | 应用 API key 加密密钥（Fernet） |
| `SIMULATE_SCAN` | `false` | `true` = 模拟扫描引擎（演示/测试，不调 LLM） |

## 测试

```bash
# 后端（39 个用例）：lint + 单测 + 迁移
cd backend && uv run ruff check . && uv run pytest -q

# 前端（23 个用例）：类型 + lint + 单测 + 构建
cd frontend && npm run type-check && npm run lint && npm test && npm run build

# E2E（需先启动两端服务器，见"十分钟跑通"；本地用系统 Chrome）
cd frontend && PLAYWRIGHT_SYSTEM_CHROME=1 npx playwright test
```

CI（GitHub Actions）覆盖：后端 lint/单测、Postgres 方言测试、前端检查、E2E（下载 Chromium）。

## 项目结构

```
├── backend/          # FastAPI 应用（REST API + 扫描引擎 + 静态托管前端）
│   ├── app/
│   │   ├── api/      # 路由（auth/applications/datasets/scans/dashboard）
│   │   ├── core/     # 配置、DB、加密、安全
│   │   ├── data/     # 内置数据集加载器
│   │   └── engine/   # 扫描引擎（限速/judge/双实现/任务管理）
│   ├── alembic/      # 数据库迁移
│   └── tests/
├── frontend/         # React 19 + Vite 7 SPA
│   ├── src/
│   └── e2e/          # Playwright 场景
├── docs/
│   ├── CONTEXT.md    # 领域词汇表
│   ├── PLAN.md       # 开发计划与里程碑
│   ├── DATASETS.md   # 数据集格式与贡献指南
│   └── adr/          # 架构决策记录
└── .github/workflows # CI + Release
```

## 文档

- [开发计划与里程碑](docs/PLAN.md)
- [架构决策记录（ADR）](docs/adr/)
- [领域词汇表](docs/CONTEXT.md)
- [数据集贡献指南](docs/DATASETS.md)
- [贡献指南](CONTRIBUTING.md)

## 路线图

- **v1（已完成）**：认证 → AI 应用 → 扫描向导 → 扫描结果 → Dashboard（MVP 核心闭环）+ 自定义数据集 + 模拟/真实双引擎
- **v2 候选**：多租户 + RBAC、多模态媒体评测、PDF/CSV/ZIP 报告、WebSocket 实时进度、算法插件化

## 许可

[MIT](LICENSE)。内置数据集内容同样以 MIT 许可随仓库分发（见 [docs/DATASETS.md](docs/DATASETS.md)）。
