# Contributing

感谢你对 ai-red-team-scanner 的兴趣！请先阅读 [CONTEXT.md](docs/CONTEXT.md)（领域词汇）与 [PLAN.md](docs/PLAN.md)（里程碑与 DoD）。

## 开发环境

见 [README 快速开始](README.md#快速开始)。本地建议用 `SIMULATE_SCAN=true` 与 `AUTH_MODE=disabled` 跑通主流程，无需真实 LLM key。

## 提交 PR 前

1. **后端**：`uv run pytest` 全绿；`uv run ruff check` 无告警
2. **前端**：`npm run type-check`、`npm run lint`、`npm test`、`npm run build` 全绿
3. 涉及行为变化请补测试（后端 pytest / 前端 Vitest）
4. 里程碑相关改动需满足对应 DoD（见 PLAN.md）

## 代码约定（红线）

- **异步红线**：协程内禁止同步阻塞调用（`requests`、`time.sleep`、同步 DB 操作）——会卡死整个事件循环，见 ADR-0003
- **API 约定**：REST + snake_case JSON；错误统一 `{"detail": string}`；401/403/404/422/409
- **前端约定**：React 19 + Tailwind 语义 token；服务端数据走 TanStack Query，客户端状态走 Zustand；路由懒加载
- **安全**：API key 只存密文、只回脱敏尾缀；日志禁止打印密钥

## 提交信息

建议 Conventional Commits：`feat:` `fix:` `docs:` `test:` `chore:` `refactor:`。

## 行为准则

保持友善与建设性。任何形式的骚扰都是不可接受的。
