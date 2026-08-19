# CONTEXT.md — 项目领域词汇表

> 本文件记录项目领域术语的精确定义。新术语在讨论中定案后立即追加，避免"看似懂其实各说各话"。
> 项目定名：ai-red-team-scanner（2026-08-19）。

## 定位

- **`ai-red-team-scanner`**：开源的 AI 红队安全扫描平台——对用户自有的 AI 模型执行多维度安全评测（内容安全、隐私、合规、幻觉等）。学习型复刻项目，代码全新编写，不复用 VirtueRed 专有代码/数据集/品牌资产。

## 租户模型

- **单租户（Single-Tenant）**：一个部署实例 = 一个团队的工作空间。团队内多个用户账号，共享同一份数据（应用、扫描、结果），无组织间隔离。
- **多租户（Multi-Tenant）**：明确不在 v1 范围内；作为 v2 候选（含独立 auth 服务、tenant_id 隔离、RBAC）。
- **认证边界（v1）**：注册 / 登录 / 登出 / 改密码 / 会话过期；所有登录用户权限等同（无角色体系）。
- **免登录模式**：`AUTH_MODE=disabled` 时跳过认证（本地开发/演示），部署时开启。
- **访客用户（Guest）**：免登录模式下 `/api/auth/me` 返回 `guest=true` 的匿名用户（`id=null`）；前端守卫把它当作"已登录"处理，因此认证页在免登录模式下自然不可达。

## 核心领域术语

- **AI 应用（AI Application）**：目标模型的接入配置——base_url、api_key、model_name、输入/输出模态。用户自带 API key，属于本团队。密钥 Fernet 加密存储（开发模式密钥由 JWT_SECRET 派生），API 响应仅返回解密后掩码（如 `sk-****abcd`），日志禁止打印。
- **测试对话（Test Chat）**：对已配置应用的一轮试聊（也用于扫描启动前验证接入配置可用）；无密钥时拒绝（400），上游失败映射 502，模拟模式下返回固定回复。
- **算法（Algorithm）**：攻击/评测算法（如 "Default Tests" 基线评测、越狱攻击等），决定提示词如何构造与轮次。
- **数据集（Dataset）**：内置风险评测用例集合，按类别组织，可含子类目；v1 使用本项目自建的开源小数据集。
- **扫描（Scan）**：对某个 AI 应用执行一轮评测的任务实例。生命周期：排队 → 运行中 → 暂停/失败/完成。进度以百分比+剩余时间上报。
- **扫描结果（Scan Result）**：一轮扫描的产出——整体安全评分、按类别的风险分布、失败用例清单（prompt/answer）、数据集级统计。

## MVP 范围（v1 核心闭环）

认证（含免登录模式）→ AI 应用 CRUD → 创建扫描向导（选应用/算法/数据集/测试对话/高级设置）→ 扫描列表与进度 → 扫描结果页 → Dashboard。

## 模态范围

- **v1 仅文本模态**：扫描、测试对话、结果页只处理文本。数据模型为输入/输出模态字段预留扩展（多模态 v2 候选）。

## 评测判定（Judge）

- **Judge LLM**：目标模型回答后，由裁判模型按提示词模板打分（0-10 分 + 理由），并输出结构化 JSON。安全评分/风险分布均源自 judge 结果。
- **Judge 可配置**：judge 模型是与目标模型解耦的独立 OpenAI 兼容端点（含本地 Ollama/vLLM）；默认跟随目标模型，UI/文档引导使用便宜或本地模型以控成本。
- **成本透明**：扫描启动前预览预计 LLM 调用量（提示词数 × (目标 1 + judge 1)）。
- **Judge 容错**：judge 失败可重试、可降级——失败条目标记 `judge_error` 不计入评分，扫描继续。

## 已定案的技术决策

- 前端：React 19 + Vite（沿用既有技能栈，细节见技术栈章节）
- 后端：FastAPI（Python）
- 数据库：SQLite 默认（零依赖起步） + PostgreSQL 可选（生产），SQLAlchemy 2.0 + Alembic
- 认证：单租户 JWT，内置注册/登录/改密码；`AUTH_MODE=disabled` 免登录模式
- 项目结构：单一 repo，`frontend/` + `backend/` + `docs/`

## 数据集

- **内置小数据集**：v1 内置 5 个风险类别（内容安全/隐私/合规/误导与幻觉/偏见）× 3 子类目 × 5 条 = 75 条提示词，MIT 许可随仓库分发（`backend/data/datasets/*.json`）；运行时加载，非 DB 行。
- **自定义导入**：用户可上传自定义数据集（JSON：name/description/subcategories[{name, prompts}]），存 `custom_datasets` 表，与内置数据集同样参与扫描；校验上限：20 子类目 × 每条 200 字上限 × 总量 2000 条。
- **用例（Case）**：一次扫描的最小执行单元 = 数据集 + 子类目 + 单条提示词；以 `prompt_hash`（sha256）去重断点。
- **条目标记（judge_status）**：`passed` / `failed` / `judge_error`（裁判失败）/ `target_error`（目标调用失败）；仅 passed/failed 计入评分。

## 扫描引擎

- **执行模型**：进程内 asyncio 后台任务 + DB 断点行（completed/total → 百分比 + 剩余时间），前端轮询进度。单进程单节点即可覆盖 v1 场景。
- **抽象**：`ScanEngine` 接口 + `OpenAIChatEngine`（真实调用，OpenAI 兼容协议，asyncio 并发 + QPM 限速）+ `SimulatedEngine`（模拟模式，不调 LLM，用于演示/测试/CI）。
- **断点续跑**：扫描状态与已完条目持久化于 DB，服务重启后可恢复。

## 测试与 CI

- 三层测试：后端 pytest（单元 + 集成，用模拟引擎，CI 无需真实 key）＋ 前端 Vitest ＋ Playwright E2E（注册→建应用→扫描→结果主路径）。
- GitHub Actions 全量 CI（lint + type-check + 单测 + E2E + build）。
- 许可证：MIT。
