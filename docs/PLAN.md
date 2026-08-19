# ai-red-team-scanner — 开发计划（v1）

> 状态：规划完成，待开工（M0）。
> 领域词汇见 [CONTEXT.md](./CONTEXT.md)；关键架构决策见 [adr/](./adr/)。

---

## 0. 项目定位

开源的 AI 红队安全扫描平台：用户配置自有 AI 模型（OpenAI 兼容端点），平台用内置/自定义风险数据集对其执行多维度安全评测，产出安全评分、风险分布与失败用例。

- **形态**：学习型复刻 + 开源（MIT）。代码全新编写，不复用 VirtueRed 专有代码/数据集/品牌资产。
- **目标用户**：自托管部署的团队/个人；本地 `AUTH_MODE=disabled` 零摩擦起步，部署时开启单租户认证。
- **v1 范围**：MVP 核心闭环（认证 → 应用 CRUD → 扫描向导 → 扫描列表/进度 → 结果页 → Dashboard）+ 自定义数据集导入。
- **非目标（v1 明确不做）**：多租户/RBAC、多模态媒体、PDF/CSV/ZIP 导出、暂停/续跑 UI、CI/CD 集成页、WebSocket 推送、独立 BFF、Celery/Redis。

---

## 1. 需求范围（v1）

| 模块 | 功能点 |
|---|---|
| 认证 | 注册 / 登录 / 登出 / 改密码 / JWT 会话过期；`AUTH_MODE=disabled` 免登录模式 |
| AI 应用 | CRUD；字段：name、base_url、api_key（加密存储、返回脱敏）、model_name、模态占位字段；创建后可"测试对话" |
| 数据集 | 内置 4-6 类别 × 10-20 条（JSON 随仓库发布）；自定义 JSON 导入（上传→校验→入库→参与扫描） |
| 扫描 | 创建（选应用/算法/数据集/高级设置：并发数、QPM、失败阈值）→ 列表（状态、进度、操作）→ 结果 |
| 扫描引擎 | OpenAI 兼容目标调用 + Judge LLM 打分（0-10+理由，结构化输出）；并发+限速；DB 断点；模拟模式 |
| 结果页 | 整体安全评分、按类别风险分布、失败用例清单（prompt/answer/score/reason） |
| Dashboard | 统计卡（扫描数/平均分/高风险占比）、最近扫描、类别风险分布 |
| 测试对话 | 应用配置后向目标模型发一轮试聊，验证连通性与返回格式 |
| 工程 | 三层测试 + GitHub Actions CI + Docker Compose 部署 + 全套开源文档 |

## 2. 架构总览

```
┌────────────────────────────┐
│  frontend/  React 19 SPA   │  Vite 7 + TS + Tailwind 4 + TanStack Query
│  (Vite dev / 构建产物)      │  + React Router 7 + RHF/zod + humps(蛇形↔驼峰)
└───────────┬────────────────┘
            │  /api/*  (JSON, JWT Bearer)
┌───────────▼────────────────┐
│  backend/  FastAPI 单进程   │  SQLAlchemy 2.0 + Alembic
│  ① REST API ② 静态托管前端  │  JWT auth (AUTH_MODE 开关)
│  ③ 扫描引擎(asyncio 后台任务)│  Engine 接口: OpenAI 兼容 / Simulated
└───────────┬────────────────┘
            │ SQLAlchemy（方言切换：SQLite 默认 / Postgres 可选）
     ┌──────▼──────┐     ┌─────────────────────┐
     │  数据库      │     │ data/datasets/*.json │ 内置数据集（随代码分发）
     └─────────────┘     └─────────────────────┘
```

**关键决策**（详见 ADR）：

- **无 BFF 层**：单租户 + JWT Bearer + 同源部署，FastAPI 直接托管前端构建产物（ADR-0004）。
- **进程内任务引擎**：单节点单进程 asyncio 后台任务 + DB 断点 + 前端轮询（ADR-0003）。
- **SQLite 默认 / Postgres 可选**：SQLAlchemy 方言切换，零依赖本地起步（ADR-0002）。
- **单租户认证**（ADR-0001）。

## 3. 技术栈明细

| 层 | 选型 | 备注 |
|---|---|---|
| 前端 | React 19 + TypeScript 5.9 + Vite 7 | 沿用既有技能栈 |
| 前端样式 | Tailwind CSS 4（@theme 设计令牌） | 语义化 token，不写魔法值 |
| 前端状态 | TanStack Query 5（服务端）+ Zustand 5（客户端） | 服务端数据不落客户端 store |
| 表单 | react-hook-form + zod | 与参考项目一致的模式 |
| 路由 | React Router 7 + AuthGuard/GuestGuard | 懒加载 + Suspense |
| API 转换 | humps：后端 snake_case ↔ 前端 camelCase | 单点拦截器，类型手写（v1） |
| 后端 | FastAPI + Pydantic v2 + uvicorn | |
| ORM/迁移 | SQLAlchemy 2.0 + Alembic | 方言：sqlite / postgresql |
| 认证 | python-jose (JWT) + passlib/bcrypt | AUTH_MODE 中间件开关 |
| LLM 调用 | httpx（async）OpenAI 兼容协议 | 目标与 judge 同一协议，天然支持 Ollama/vLLM |
| 任务 | asyncio 后台任务 + DB 断点 | Engine 接口抽象 |
| 测试 | pytest + pytest-asyncio / Vitest + Testing Library / Playwright | CI 用模拟引擎，无真实 key |
| CI/CD | GitHub Actions | lint + type-check + 单测 + E2E + build |
| 部署 | Docker Compose（backend + 可选 postgres profile） | 本地裸跑：`uvicorn` + `vite dev` 代理 |

## 4. 数据模型（v1）

```
users          id, email(unique), password_hash, name, created_at
ai_applications id, name, base_url, api_key_cipher, api_key_masked,
                model_name, input_modalities(json), output_modalities(json),
                created_at, updated_at
custom_datasets id, name, description, cases(json: [{subcategory, prompt}]),
                created_by → users.id, created_at
scans          id, name, status(pending|running|paused|failed|completed),
                application_id → ai_applications, algorithm, dataset_ids(json),
                concurrency, qpm, fail_threshold, judge_config(json: {base_url, model}),
                total_cases, completed_cases, passed_cases, failed_cases,
                safety_score(float, 完成时汇总), progress_pct(派生),
                error_message, created_by → users.id,
                created_at, started_at, finished_at
scan_results   id, scan_id → scans, dataset_name, subcategory, prompt(text),
                answer(text), judge_score(float|NULL), judge_reason(text|NULL),
                judge_status(passed|failed|judge_error), latency_ms,
                created_at   （index: scan_id）
```

- 内置数据集**不是** DB 行：`backend/data/datasets/*.json` 随代码分发，运行时加载；`custom_datasets` 表存用户导入。
- 模态字段仅作占位（v1 全为 `["text"]`），多模态 v2 不破坏表结构。
- `safety_score` = judge 平均分（0-10 归一化为 0-100 展示）；`failed` 判定：judge_score < fail_threshold 或 judge 判定为违规。

## 5. API 设计（REST，snake_case）

| 方法/路径 | 说明 |
|---|---|
| POST `/api/auth/register` `/api/auth/login` POST `/api/auth/logout` POST `/api/auth/change-password` GET `/api/auth/me` | 认证（AUTH_MODE=disabled 时 register/login 自动通过、me 返回匿名用户） |
| GET/POST `/api/applications` GET/PATCH/DELETE `/api/applications/{id}` | 应用 CRUD；返回时 api_key 仅 `api_key_masked` |
| POST `/api/applications/{id}/test-chat` | 测试对话：{message} → {reply} |
| GET `/api/datasets/builtin` GET `/api/datasets/custom` POST `/api/datasets/custom` DELETE `/api/datasets/custom/{id}` | 内置列表（JSON 加载）/ 自定义 CRUD（含校验） |
| POST `/api/scans` | 创建并启动扫描；响应含 `estimated_llm_calls`（成本透明） |
| GET `/api/scans` | 列表（分页 + 状态/时间过滤） |
| GET `/api/scans/{id}` GET `/api/scans/{id}/progress` | 详情 / 进度（百分比 + 剩余时间 + 完成数） |
| GET `/api/scans/{id}/results` | 结果聚合：safety_score、by_category 风险分布、失败用例分页 |
| GET `/api/dashboard` | 统计卡 + 最近扫描 + 类别风险分布 |
| GET `/api/health` | 健康检查 |

错误约定：`{detail: string}` 统一格式；401 未认证 / 403 无权限 / 404 / 422 校验 / 409 冲突。

## 6. 前端页面与路由

| 路由 | 页面 | 要点 |
|---|---|---|
| `/login` `/register` | AuthLayout | GuestGuard；免登录模式下隐藏/直通 |
| `/` | Dashboard | 统计卡、最近扫描、类别风险分布图 |
| `/applications` | AI 应用列表 + 抽屉 CRUD + 测试对话弹窗 | |
| `/scans/new` | 创建扫描向导：①选应用 → ②选算法 → ③选数据集 → ④测试对话（可选）→ ⑤高级设置（并发/QPM/阈值/judge 模型）+ 成本预估 → 提交 | 分步 store（Zustand），各步独立校验 |
| `/scans` | 扫描列表：状态徽章、进度条、轮询更新 | 轮询 2s（运行中） |
| `/scans/:id` | 结果页：评分总览、类别分布、失败用例表格 + 详情抽屉（prompt/answer/score/reason） | |
| `/datasets` | 内置数据集浏览 + 自定义导入（JSON 上传 + 校验预览） | |
| `/settings` | 改密码、用户信息 | |

## 7. 扫描引擎设计

```
ScanEngine (Protocol)
 ├─ estimate(scan) -> cost preview
 ├─ start(scan_id)          # 启动后台任务
 └─ run(scan_id)            # 主循环
     1. 加载数据集用例 → 构造任务队列 (dataset, subcategory, prompt)
     2. asyncio.Semaphore(concurrency) 并发 + QPM 令牌桶限速
     3. 每条：调用目标模型(httpx, OpenAI 兼容 chat/completions)
             → 调用 judge 模型(独立端点, 结构化输出 JSON: {score, reason, verdict})
             → 写 scan_results 行 + 更新 scan.completed_cases / 断点
     4. 异常：单条失败重试(1 次)后标记失败条目继续；judge 失败标 judge_error
     5. 完成：汇总 safety_score / by_category → 状态 completed
OpenAIChatEngine   # 真实实现
SimulatedEngine    # SIMULATE=true：确定性伪回答+伪评分（演示/测试/CI）
```

- **进度**：`progress_pct = completed/total`，`remaining_time` 用滑动平均吞吐估算。
- **断点**：所有进度在 DB，服务重启后扫描任务可从 `completed_cases` 续跑（v1 提供"启动时恢复 pending/running 任务"机制）。
- **成本透明**：创建扫描响应含 `estimated_llm_calls = total_cases × 2`（目标+judge），前端在向导第⑤步展示。
- **API key 安全**：应用创建时加密存储（Fernet，key 来自环境变量），任何 API 响应只返回脱敏尾缀；日志禁止打印 key。

## 8. 里程碑（每阶段含 DoD）

> 每个里程碑 = 一组可独立 review 的 PR；DoD 满足才算完成。

**M0 — 工程基建**
- [x] 初始化 repo（MIT LICENSE、README、CONTRIBUTING、.gitignore、.editorconfig）
- [x] backend 骨架：FastAPI + health + SQLAlchemy + Alembic + pytest 冒烟
- [x] frontend 骨架：Vite + React + Tailwind + 路由壳 + 布局
- [x] GitHub Actions：lint / type-check / 单测 / build
- [x] Docker Compose（backend 服务 + postgres profile）
- DoD：CI 全绿；`docker compose up` 与本地裸跑都出 hello 页
  - ✅ 本地裸跑验证通过（vite dev → /api 代理 → FastAPI /api/health 200）
  - ⚠️ Docker 部分已写好但本机无 Docker，待有 Docker 环境时验证（Dockerfile 用官方 uv 多阶段模式）

**M1 — 认证**
- [x] users 表 + JWT 签发/校验 + AUTH_MODE 开关中间件
- [x] register/login/logout/change-password/me API + pytest
- [x] 前端登录注册页、AuthGuard/GuestGuard、token 拦截器与 401 处理
- DoD：登录闭环可用；免登录模式可用；后端 API 带鉴权测试
  - ✅ 11 个后端测试 + 9 个前端测试全绿；真实服务器 E2E 验证全部通过（含免登录 guest 模式）

**M2 — AI 应用 + 测试对话**
- [x] ai_applications 表 + CRUD API（加密存储、脱敏返回）+ pytest
- [x] 前端应用列表/新建/编辑/删除（表单 zod 校验）
- [x] test-chat API（OpenAI 兼容调用，超时与错误处理）+ 前端试聊弹窗
- DoD：真实 key 可连通测试对话；无 key 时模拟模式可演示
  - ✅ 21 后端测试 + 12 前端测试全绿；E2E：CRUD + 模拟试聊 + 更新保留密钥 + 删除 204
  - ✅ 密钥：Fernet 加密存储（开发模式从 JWT_SECRET 派生），响应只返回解密后掩码（sk-****abcd）

**M3 — 数据集 + 扫描引擎**
- [x] 内置数据集 JSON（5 类别 × 3 子类目 × 5 条，共 75 条，MIT 内容）+ 加载器
- [x] custom_datasets 表 + 导入/校验 API + 前端上传导入页
- [x] 引擎：Engine 接口 + SimulatedEngine + OpenAIChatEngine（并发/限速/judge 流水线/断点/恢复）
- [x] scans/scan_results 表 + 创建/列表/进度/结果聚合 API + 集成测试（模拟引擎）
- DoD：模拟引擎下可跑通"创建→进度→结果"全链路；真实引擎单测覆盖限速/重试/judge 容错
  - ✅ 37 后端测试 + 16 前端测试全绿；E2E：内置+自定义混合扫描 17/17 完成、评分与分类统计正确
  - ✅ SQLite WAL + busy_timeout（引擎并发写）；CI 增加 Postgres 方言 job（ADR-0002）
  - ✅ 启动恢复：pending/running 扫描自动续跑（DB 断点）；app logger 配置修复（引擎错误不再静默）

**M4 — 扫描向导 + 扫描列表**
- [ ] 创建扫描向导前端（5 步 + store + 成本预估展示）
- [ ] 扫描列表页（状态/进度/轮询）+ 空态/错误态
- DoD：E2E：注册→建应用→模拟扫描→列表看到进度到 100%

**M5 — 结果页 + Dashboard**
- [ ] 结果页（评分总览、类别分布图、失败用例表格 + 详情抽屉）
- [ ] Dashboard（统计卡、最近扫描、风险分布图）
- DoD：E2E 主路径完整跑通；空数据态、错误态齐备

**M6 — 打磨与 v1.0.0 发布**
- [ ] Playwright E2E 全量固化（CI 内跑）
- [ ] 文档完善：README 快速开始（两种部署）、架构说明、数据集贡献指南
- [ ] 错误文案/加载态/无障碍走查；CHANGELOG；GitHub release v1.0.0
- DoD：新用户按 README 十分钟跑通全流程；CI 全绿；release 发布

## 9. 测试策略

| 层 | 工具 | 覆盖 |
|---|---|---|
| 后端单元 | pytest | 限速器、评分聚合、数据集校验、key 加解密、认证 |
| 后端集成 | pytest + SimulatedEngine | API 全链路（CI 无真实 key） |
| 前端单元 | Vitest + Testing Library | 表单校验、分步 store、工具函数 |
| E2E | Playwright | 注册→建应用→扫描→结果主路径；免登录模式路径 |
| CI | GitHub Actions | 三层全跑 + type-check + build |

## 10. 开源发布清单

- [ ] MIT LICENSE（含数据集内容许可说明）
- [ ] CONTRIBUTING.md（PR 流程、测试要求、行为准则 CODE_OF_CONDUCT）
- [ ] SECURITY.md（密钥泄露/漏洞上报路径）
- [ ] README：徽章（CI/许可）、截图、快速开始（bare-metal + Docker）、FAQ
- [ ] CHANGELOG.md + release workflow（tag → 自动发版）
- [ ] 环境变量文档：`DATABASE_URL`、`JWT_SECRET`、`ENCRYPTION_KEY`、`AUTH_MODE`、`SIMULATE_SCAN`

## 11. v2 候选（记录不承诺）

多租户 + RBAC、多模态（媒体上传/回放）、PDF/CSV/ZIP 导出、暂停/续跑 UI、WebSocket 实时进度、独立 BFF、Celery 横向扩展、数据集 HuggingFace 化、i18n。
