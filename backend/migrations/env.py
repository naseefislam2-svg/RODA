import asyncio

from alembic import context

from app.config import get_settings
from app.db import Base, database_engine

settings = get_settings()
url = settings.database_direct_url or settings.database_url
if settings.environment == "production" and (not settings.database_direct_url or "-pooler" in url):
    raise ValueError("Migrations require DATABASE_DIRECT_URL pointing to the direct Neon endpoint")


def migrate(connection):
    context.configure(connection=connection, target_metadata=Base.metadata, compare_type=True)
    with context.begin_transaction():
        context.run_migrations()


async def run():
    engine = database_engine(url)
    async with engine.connect() as connection:
        await connection.run_sync(migrate)
    await engine.dispose()


asyncio.run(run())
