# ADR-0002: SQLite 为默认数据库，PostgreSQL 为可选生产配置

采用 SQLAlchemy 2.0 + Alembic，方言按 `DATABASE_URL` 切换：未配置时默认 `sqlite:///data.db`（零依赖起步），生产配置 PostgreSQL。

**Considered Options**

- 仅 PostgreSQL：与参考项目一致，但本地起步强制依赖 Docker/本地 PG，开源项目采纳门槛高。
- 仅 SQLite：部署形态单一，但并发写入与生产健壮性不足。

**Consequences**

- 方言差异（JSON 支持、并发模型）必须在开发期持续测试——CI 增加一个 PG 方言的测试 job（可用服务容器）防方言漂移。
- SQLite 下 asyncio 并发写需注意连接串参数（`check_same_thread=False` 等），引擎层已按单写事务设计。
