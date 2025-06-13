from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
import os

# Use SQLite for development
DATABASE_URL = os.getenv('DATABASE_URL', 'sqlite+aiosqlite:////app/data/cliparr.db')

# Create async engine
engine = create_async_engine(
    DATABASE_URL, 
    echo=True,  # Set to False in production
    connect_args={'check_same_thread': False} if 'sqlite' in DATABASE_URL else {}
)

# Create async session factory
AsyncSessionLocal = async_sessionmaker(
    engine, 
    class_=AsyncSession, 
    expire_on_commit=False
)

# Declarative base for models
Base = declarative_base()

async def init_db():
    """Initialize the database"""
    async with engine.begin() as conn:
        # Create all tables defined in models
        await conn.run_sync(Base.metadata.create_all)

async def get_db():
    """Dependency to get database session"""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close() 