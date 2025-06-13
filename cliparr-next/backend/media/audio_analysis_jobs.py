import asyncio
import logging
import sqlite3
import uuid
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Union

from backend.media.audio_fingerprint import AudioFingerprinter

class AudioAnalysisJobManager:
    def __init__(self, db_path: str = "data/audio_analysis_jobs.db"):
        self.db_path = db_path
        self.fingerprinter = AudioFingerprinter()
        self._init_db()

    def _init_db(self):
        """Initialize the SQLite database for tracking audio analysis jobs."""
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()
        
        # Create jobs table
        c.execute('''
            CREATE TABLE IF NOT EXISTS audio_analysis_jobs (
                id TEXT PRIMARY KEY,
                show_id INTEGER,
                show_title TEXT,
                season_number INTEGER,
                episode_number INTEGER,
                file_path TEXT,
                status TEXT DEFAULT 'pending',
                progress REAL DEFAULT 0.0,
                error_message TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                completed_at TIMESTAMP
            )
        ''')
        
        # Create index for faster queries
        c.execute('''
            CREATE INDEX IF NOT EXISTS idx_audio_analysis_jobs_status 
            ON audio_analysis_jobs(status)
        ''')
        
        conn.commit()
        conn.close()

    def create_job(self, show_id: int, show_title: str, file_path: str, 
                   season_number: Optional[int] = None, 
                   episode_number: Optional[int] = None) -> str:
        """
        Create a new audio analysis job.
        
        :param show_id: ID of the show in the database
        :param show_title: Title of the show
        :param file_path: Full path to the episode file
        :param season_number: Season number (optional)
        :param episode_number: Episode number (optional)
        :return: Job ID
        """
        job_id = str(uuid.uuid4())
        
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()
        
        c.execute('''
            INSERT INTO audio_analysis_jobs 
            (id, show_id, show_title, season_number, episode_number, file_path)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (job_id, show_id, show_title, season_number, episode_number, file_path))
        
        conn.commit()
        conn.close()
        
        return job_id

    async def process_job(self, job_id: str):
        """
        Process a single audio analysis job.
        
        :param job_id: ID of the job to process
        """
        try:
            # Fetch job details
            conn = sqlite3.connect(self.db_path)
            c = conn.cursor()
            
            c.execute('SELECT file_path FROM audio_analysis_jobs WHERE id = ?', (job_id,))
            result = c.fetchone()
            
            if not result:
                logging.error(f"Job {job_id} not found")
                return
            
            file_path = result[0]
            
            # Update job status to running
            c.execute('''
                UPDATE audio_analysis_jobs 
                SET status = 'running', 
                    updated_at = CURRENT_TIMESTAMP 
                WHERE id = ?
            ''', (job_id,))
            conn.commit()
            
            # Perform audio analysis
            analysis_result = self.fingerprinter.scan_episode(file_path)
            
            if analysis_result:
                # Update job status to completed
                c.execute('''
                    UPDATE audio_analysis_jobs 
                    SET status = 'completed', 
                        progress = 100.0, 
                        updated_at = CURRENT_TIMESTAMP,
                        completed_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                ''', (job_id,))
            else:
                # Mark job as failed
                c.execute('''
                    UPDATE audio_analysis_jobs 
                    SET status = 'failed', 
                        error_message = 'Audio analysis failed',
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                ''', (job_id,))
            
            conn.commit()
            conn.close()
            
        except Exception as e:
            logging.error(f"Error processing job {job_id}: {str(e)}")
            
            # Update job status to failed
            conn = sqlite3.connect(self.db_path)
            c = conn.cursor()
            c.execute('''
                UPDATE audio_analysis_jobs 
                SET status = 'failed', 
                    error_message = ?, 
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            ''', (str(e), job_id))
            conn.commit()
            conn.close()

    def get_jobs(self, status: Optional[str] = None, 
                 limit: int = 100, 
                 offset: int = 0) -> List[Dict]:
        """
        Retrieve audio analysis jobs.
        
        :param status: Filter by job status
        :param limit: Maximum number of jobs to return
        :param offset: Offset for pagination
        :return: List of job details
        """
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()
        
        query = 'SELECT * FROM audio_analysis_jobs'
        params = []
        
        if status:
            query += ' WHERE status = ?'
            params.append(status)
        
        query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
        params.extend([limit, offset])
        
        c.execute(query, params)
        columns = [column[0] for column in c.description]
        
        jobs = []
        for row in c.fetchall():
            job_dict = dict(zip(columns, row))
            jobs.append(job_dict)
        
        conn.close()
        return jobs

    async def schedule_show_analysis(self, show_id: int, show_title: str, 
                                     episodes: List[Dict]):
        """
        Schedule audio analysis for multiple episodes of a show.
        
        :param show_id: ID of the show
        :param show_title: Title of the show
        :param episodes: List of episode dictionaries with file_path, season_number, episode_number
        """
        job_ids = []
        
        # Create jobs for each episode
        for episode in episodes:
            job_id = self.create_job(
                show_id=show_id, 
                show_title=show_title,
                file_path=episode['file_path'],
                season_number=episode.get('season_number'),
                episode_number=episode.get('episode_number')
            )
            job_ids.append(job_id)
        
        # Process jobs concurrently
        await asyncio.gather(*[self.process_job(job_id) for job_id in job_ids])

    def cleanup_old_jobs(self, days: int = 30):
        """
        Remove jobs older than specified days.
        
        :param days: Number of days to keep jobs
        """
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()
        
        c.execute('''
            DELETE FROM audio_analysis_jobs 
            WHERE created_at < datetime('now', ?)
        ''', (f'-{days} days',))
        
        conn.commit()
        conn.close()

# Global job manager instance
job_manager = AudioAnalysisJobManager() 