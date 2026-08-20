# ADR-0005: 引入 shadcn/ui（Radix 原语），渐进式替换手写组件

前端组件策略：以 [shadcn/ui](https://ui.shadcn.com)（Radix 原语 + Tailwind CSS 变量）为组件底座，按需渐进引入，替换重复的手写弹层/抽屉/徽章/进度条，**不整库引入、不引入重样式组件库**。

**Considered Options**

- **Ant Design / MUI 等传统组件库**：自带视觉体系（dense 主题、组件内联样式），与现有 Tailwind 语义 token（`--color-primary` 等）双体系冲突；定制视觉成本高。拒绝。
- **全量引入 shadcn**：一半组件是死代码，违背"按需"原则。拒绝。
- **继续手写**：第 3 次出现重复弹层时已证明模式稳定，但焦点陷阱/Escape/ARIA 等无障碍能力手写成本高且易错。拒绝。

**Consequences**

- 引入门槛低：组件代码复制进仓库（`src/components/ui/*`），完全可定制；CLI 依赖 `components.json` + tsconfig paths（root tsconfig 需补 `baseUrl/paths`——CLI 曾把 `@/components` 当字面路径生成到 `frontend/@/`）。
- Token 体系合并：shadcn 的 oklch 变量（`--background`/`--primary`/`--muted`…）进入 `index.css`，旧 token（`--color-surface`）映射到 `var(--card)`；深色模式沿用系统偏好（`prefers-color-scheme`），不引入 `.dark` class。视觉零破坏。
- 已替换：dialog、sheet（右侧抽屉；shadcn drawer 是底部语义，故选 sheet）、tabs、table、badge、progress（语义色经 `[&_[data-slot=progress-indicator]]` 覆盖）、button；共享化 ScanStatusBadge/ToneProgress/ConfirmDialog。
- 暂不引入：dropdown-menu、sonner（toast）——涉及行为改造，候选 v2；charts（CSS 条形够用）。
