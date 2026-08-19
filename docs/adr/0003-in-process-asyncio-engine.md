# ADR-0003: 扫描任务用进程内 asyncio 后台任务 + DB 断点，不用 Celery/Redis

扫描在 FastAPI 进程内以 asyncio 后台任务运行，进度与断点持久化在 DB（completed/total），前端轮询进度；服务重启后从断点恢复。引擎暴露 `ScanEngine` 接口（OpenAIChatEngine / SimulatedEngine）。

**Considered Options**

- Celery + Redis + worker 容器：生产级横向扩展，但引入两个基础设施依赖，本地开发复杂度上升，超出 v1 单节点场景的需求。
- 同步串行：实现最简单但无并发，扫描速度不可接受。

**Consequences**

- 单进程内任务与 API 共享事件循环：长扫描任务必须全程 `await`（httpx async），任何同步阻塞调用都会卡住整个 API——代码审查红线。
- 多 worker 部署（uvicorn --workers > 1）会重复启动任务：v1 文档明确单 worker 运行，横向扩展留给 v2（届时 Engine 接口不变，替换执行后端即可）。
- 断点恢复在"任务被 kill"场景下可能残留 running 状态，启动时统一将 pending/running 收拢为可恢复状态。
