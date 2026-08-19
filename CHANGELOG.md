# Changelog

All notable changes to this project are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); the project adheres
to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [v1.0.0] - 2026-08-19

### Added

- **认证**：注册/登录/登出/改密码（JWT，bcrypt）；`AUTH_MODE=disabled` 免登录模式（guest 用户）。
- **AI 应用管理**：CRUD + 测试对话；API key Fernet 加密存储、响应仅返回掩码（`sk-****abcd`）。
- **数据集**：5 个内置风险类别（内容安全/隐私/合规/误导/偏见，共 75 条 MIT 提示词）+ 自定义 JSON 导入（校验上限 20×200×2000）。
- **扫描引擎**：进程内 asyncio 管线（并发闸门 + QPM 令牌桶限速 + DB 断点 + 启动恢复）；OpenAI 兼容目标调用 + 独立 Judge 模型打分（0-10 + 理由，结构化 JSON）；`SimulatedEngine` 模拟模式（演示/测试/CI 零成本）。
- **扫描体验**：5 步创建向导（应用/算法/数据集/试聊/高级设置 + 成本预估）、扫描列表（状态/进度/2s 轮询）、结果页（安全评分、类别风险、失败用例 + 详情抽屉）、Dashboard（统计卡/最近扫描/风险分布）。
- **工程**：Docker Compose（SQLite/Postgres 双 profile）、GitHub Actions（lint/单测/Postgres 方言/E2E）、Playwright E2E、三层测试。

### 架构决策（ADR）

- ADR-0001 单租户认证；ADR-0002 SQLite 默认 + Postgres 可选；ADR-0003 进程内 asyncio 引擎；ADR-0004 无 BFF 层。

[v1.0.0]: https://github.com/fengfanfan-max/ai-red-team-scanner/releases/tag/v1.0.0
