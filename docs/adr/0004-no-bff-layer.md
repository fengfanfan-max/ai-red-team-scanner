# ADR-0004: 不设 BFF 层，FastAPI 直接托管前端构建产物

参考项目采用 Hono BFF（Cookie 会话、按路由分级上游超时、跨服务代理）。本项目的 v1 架构里：单租户 + JWT Bearer（无 Cookie 会话）+ 单后端服务 + 同源部署（FastAPI 挂载 `frontend/dist`），BFF 成为纯转发层，故不做；Vite dev 模式用 `/api` 代理指向后端。

**Considered Options**

- Hono BFF（参考项目同构）：在 v1 中无独立价值，多一个服务、多一层部署与配置。
- Next.js 全栈：前后端边界模糊，与"分别深入学习前后端"的目标冲突。

**Consequences**

- 超时策略在 FastAPI 侧用 per-endpoint 超时配置实现（test-chat 等长调用单独放宽），不需要代理层。
- 未来引入多租户独立 auth 服务或需 Cookie 会话时，再引入 BFF（届时同步评估 ADR-0001）。
