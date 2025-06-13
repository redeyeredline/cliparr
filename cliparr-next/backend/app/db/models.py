"""
SQLAlchemy models for the application database.
"""

from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime

Base = declarative_base()

class Show(Base):
    __tablename__ = 'shows'

    id = Column(Integer, primary_key=True)
    sonarr_id = Column(Integer, unique=True)
    title = Column(String)
    overview = Column(Text)
    path = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    seasons = relationship("Season", back_populates="show", cascade="all, delete-orphan")

class Season(Base):
    __tablename__ = 'seasons'

    id = Column(Integer, primary_key=True)
    show_id = Column(Integer, ForeignKey('shows.id'))
    season_number = Column(Integer)
    created_at = Column(DateTime, default=datetime.utcnow)

    show = relationship("Show", back_populates="seasons")
    episodes = relationship("Episode", back_populates="season", cascade="all, delete-orphan")

class Episode(Base):
    __tablename__ = 'episodes'

    id = Column(Integer, primary_key=True)
    season_id = Column(Integer, ForeignKey('seasons.id'))
    episode_number = Column(Integer)
    title = Column(String)
    sonarr_episode_id = Column(Integer, unique=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    season = relationship("Season", back_populates="episodes")
    files = relationship("EpisodeFile", back_populates="episode", cascade="all, delete-orphan")
    analysis_jobs = relationship("AnalysisJob", back_populates="episode", cascade="all, delete-orphan")

class EpisodeFile(Base):
    __tablename__ = 'episode_files'

    id = Column(Integer, primary_key=True)
    episode_id = Column(Integer, ForeignKey('episodes.id'))
    file_path = Column(String)
    size = Column(Integer)
    quality = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)

    episode = relationship("Episode", back_populates="files")

class AnalysisJob(Base):
    __tablename__ = 'analysis_jobs'

    id = Column(Integer, primary_key=True)
    episode_id = Column(Integer, ForeignKey('episodes.id'))
    status = Column(String)  # pending, processing, completed, failed
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    error_message = Column(Text, nullable=True)

    episode = relationship("Episode", back_populates="analysis_jobs") 