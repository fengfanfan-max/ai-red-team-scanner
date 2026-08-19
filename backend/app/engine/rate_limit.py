import asyncio
import time


class TokenBucket:
    """Async rate limiter: allows `qpm` tokens per minute (burst = qpm).

    Single writer (the scan engine) — the lock guards against concurrent
    acquirers within the same process.
    """

    def __init__(self, qpm: int) -> None:
        self.capacity = max(1, qpm)
        self.rate = qpm / 60.0
        self._tokens = float(self.capacity)
        self._updated = time.monotonic()
        self._lock = asyncio.Lock()

    async def acquire(self) -> None:
        async with self._lock:
            while True:
                now = time.monotonic()
                self._tokens = min(self.capacity, self._tokens + (now - self._updated) * self.rate)
                self._updated = now
                if self._tokens >= 1:
                    self._tokens -= 1
                    return
                await asyncio.sleep((1 - self._tokens) / self.rate)
