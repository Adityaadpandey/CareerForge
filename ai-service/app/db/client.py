import asyncpg
from app.config import settings

_pool: asyncpg.Pool | None = None


def _raw_url() -> str:
    return settings.DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")


async def _create_pool() -> asyncpg.Pool:
    return await asyncpg.create_pool(
        _raw_url(),
        min_size=1,
        max_size=10,
        # Drop idle connections quickly so stale ones don't accumulate
        max_inactive_connection_lifetime=30,
        # Per-query timeout (seconds)
        command_timeout=30,
    )


async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        _pool = await _create_pool()
        return _pool

    # Check if pool is still usable; recreate if not
    try:
        async with _pool.acquire(timeout=5) as con:
            await con.execute("SELECT 1")
        return _pool
    except Exception:
        # Pool is broken — close and recreate
        try:
            await _pool.close()
        except Exception:
            pass
        _pool = await _create_pool()
        return _pool


async def close_pool():
    global _pool
    if _pool:
        await _pool.close()
        _pool = None
