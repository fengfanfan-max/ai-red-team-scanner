#!/usr/bin/env bash
# 一键启动开发环境（后端 + 前端并行，Ctrl+C 全部停止）
#
# 用法:
#   ./dev.sh           # demo 模式：模拟扫描引擎 + 免登录（零配置，无需 API key）
#   ./dev.sh real      # 完整模式：真实 LLM + 认证（需在应用里配置真实 key）
#
# 可用环境变量覆盖: SIMULATE_SCAN, AUTH_MODE, DATABASE_URL,
#                   BACKEND_PORT (默认 8000), FRONTEND_PORT (默认 5173)

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"

MODE="${1:-demo}"
case "$MODE" in
  demo)
    export SIMULATE_SCAN="${SIMULATE_SCAN:-true}"
    export AUTH_MODE="${AUTH_MODE:-disabled}"
    ;;
  real)
    export SIMULATE_SCAN="${SIMULATE_SCAN:-false}"
    export AUTH_MODE="${AUTH_MODE:-enabled}"
    ;;
  *)
    echo "unknown mode: $MODE (expected: demo | real)" >&2
    exit 1
    ;;
esac

# ---------- 前置检查 ----------
command -v uv >/dev/null 2>&1 || { echo "✗ uv not found (https://docs.astral.sh/uv/)" >&2; exit 1; }
command -v node >/dev/null 2>&1 || { echo "✗ node not found (>= 22)" >&2; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "✗ npm not found" >&2; exit 1; }
for port in "$BACKEND_PORT" "$FRONTEND_PORT"; do
  if lsof -i ":$port" >/dev/null 2>&1; then
    echo "✗ port $port is already in use — stop the other process or set BACKEND_PORT/FRONTEND_PORT" >&2
    exit 1
  fi
done

# ---------- 首次安装 ----------
if [ ! -d "$ROOT/backend/.venv" ]; then
  echo "→ installing backend dependencies (uv sync)…"
  (cd "$ROOT/backend" && uv sync)
fi
if [ ! -d "$ROOT/frontend/node_modules" ]; then
  echo "→ installing frontend dependencies (npm install)…"
  (cd "$ROOT/frontend" && npm install)
fi

# ---------- 数据库迁移 ----------
echo "→ applying database migrations…"
(cd "$ROOT/backend" && uv run alembic upgrade head)

# ---------- 启动 ----------
BACKEND_PID=""
FRONTEND_PID=""
cleanup() {
  # 1) 主进程（exec 后的服务本体）
  [ -n "$BACKEND_PID" ] && kill "$BACKEND_PID" 2>/dev/null
  [ -n "$FRONTEND_PID" ] && kill "$FRONTEND_PID" 2>/dev/null
  sleep 1
  # 2) 子进程（uvicorn --reload 的 worker、vite 的 node 等）
  [ -n "$BACKEND_PID" ] && pkill -P "$BACKEND_PID" 2>/dev/null
  [ -n "$FRONTEND_PID" ] && pkill -P "$FRONTEND_PID" 2>/dev/null
  # 3) 按命令兜底（端口限定，避免误杀其他项目进程）
  pkill -f "app.main:app --port $BACKEND_PORT" 2>/dev/null
  pkill -f "vite --port $FRONTEND_PORT" 2>/dev/null
  echo ""
  echo "⏹  stopped."
}
trap cleanup EXIT INT TERM

# exec 保证 $! 就是服务进程本身（避免管道/进程替换下 PID 错位杀不掉服务）。
# 日志直接混流输出——uvicorn/vite 的行自带服务标识，可读性足够。
(cd "$ROOT/backend" && exec uv run uvicorn app.main:app --port "$BACKEND_PORT" --reload) &
BACKEND_PID=$!

(cd "$ROOT/frontend" && exec npm run dev -- --port "$FRONTEND_PORT") &
FRONTEND_PID=$!

echo ""
echo "🚀 dev environment ready (mode: $MODE)"
echo "   backend  http://localhost:$BACKEND_PORT  (simulate=$SIMULATE_SCAN, auth=$AUTH_MODE)"
echo "   frontend http://localhost:$FRONTEND_PORT"
echo "   API docs http://localhost:$BACKEND_PORT/docs"
echo "   Ctrl+C to stop everything"
echo ""

wait || true
