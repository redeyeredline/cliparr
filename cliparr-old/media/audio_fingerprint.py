import subprocess
import logging
import json
import sqlite3
import os
from pathlib import Path
from typing import Dict, List, Tuple, Optional
import hashlib
from datetime import datetime

class AudioFingerprinter:
    def __init__(self, db_path: str = "data/audio_fingerprints.db"):
        self.db_path = db_path
        self._init_db()
        
    def _init_db(self):
        """Initialize the SQLite database for storing fingerprints."""
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()
        
        # Create tables for fingerprints and matches
        c.execute('''
            CREATE TABLE IF NOT EXISTS fingerprints (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                file_path TEXT NOT NULL,
                fingerprint_hash TEXT NOT NULL,
                start_time REAL NOT NULL,
                end_time REAL NOT NULL,
                type TEXT NOT NULL,  -- 'intro' or 'outro'
                confidence REAL NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(file_path, fingerprint_hash)
            )
        ''')
        
        c.execute('''
            CREATE TABLE IF NOT EXISTS fingerprint_matches (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                fingerprint_id INTEGER NOT NULL,
                matched_file_path TEXT NOT NULL,
                matched_start_time REAL NOT NULL,
                matched_end_time REAL NOT NULL,
                similarity_score REAL NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (fingerprint_id) REFERENCES fingerprints(id)
            )
        ''')
        
        conn.commit()
        conn.close()

    def _generate_audio_fingerprint(self, file_path: str, start_time: float, duration: float) -> Optional[str]:
        """Generate an audio fingerprint for a specific segment of the file."""
        try:
            # Extract audio segment and create fingerprint using FFmpeg
            cmd = [
                'ffmpeg', '-i', file_path,
                '-ss', str(start_time),
                '-t', str(duration),
                '-af', 'aresample=8000,asetrate=8000,astats=metadata=1:reset=1,ametadata=print:file=-',
                '-f', 'null', '-'
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True)
            
            if result.returncode != 0:
                logging.error(f"FFmpeg error for {file_path}: {result.stderr}")
                return None
                
            # Create hash from audio stats
            audio_stats = result.stderr
            fingerprint = hashlib.sha256(audio_stats.encode()).hexdigest()
            return fingerprint
            
        except Exception as e:
            logging.error(f"Error generating fingerprint for {file_path}: {str(e)}")
            return None

    def scan_episode(self, file_path: str) -> Dict:
        """Scan an episode for potential intro/outro segments."""
        try:
            # Get file duration using FFmpeg
            cmd = ['ffprobe', '-v', 'error', '-show_entries', 'format=duration', 
                  '-of', 'json', file_path]
            result = subprocess.run(cmd, capture_output=True, text=True)
            duration = float(json.loads(result.stdout)['format']['duration'])
            
            # Scan first 3 minutes for intro
            intro_fingerprint = self._generate_audio_fingerprint(file_path, 0, 180)
            
            # Scan last 3 minutes for outro
            outro_fingerprint = self._generate_audio_fingerprint(file_path, max(0, duration - 180), 180)
            
            # Store fingerprints in database
            conn = sqlite3.connect(self.db_path)
            c = conn.cursor()
            
            if intro_fingerprint:
                c.execute('''
                    INSERT OR IGNORE INTO fingerprints 
                    (file_path, fingerprint_hash, start_time, end_time, type, confidence)
                    VALUES (?, ?, ?, ?, ?, ?)
                ''', (file_path, intro_fingerprint, 0, 180, 'intro', 1.0))
                
            if outro_fingerprint:
                c.execute('''
                    INSERT OR IGNORE INTO fingerprints 
                    (file_path, fingerprint_hash, start_time, end_time, type, confidence)
                    VALUES (?, ?, ?, ?, ?, ?)
                ''', (file_path, outro_fingerprint, duration - 180, duration, 'outro', 1.0))
                
            conn.commit()
            conn.close()
            
            return {
                'file_path': file_path,
                'duration': duration,
                'intro_fingerprint': intro_fingerprint,
                'outro_fingerprint': outro_fingerprint
            }
            
        except Exception as e:
            logging.error(f"Error scanning episode {file_path}: {str(e)}")
            return None

    def find_matches(self, file_path: str) -> List[Dict]:
        """Find matching fingerprints for a given file."""
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()
        
        # Get fingerprints for the file
        c.execute('''
            SELECT id, fingerprint_hash, type, start_time, end_time
            FROM fingerprints
            WHERE file_path = ?
        ''', (file_path,))
        
        fingerprints = c.fetchall()
        matches = []
        
        for fp_id, fp_hash, fp_type, start_time, end_time in fingerprints:
            # Find similar fingerprints in other files
            c.execute('''
                SELECT f.file_path, f.start_time, f.end_time
                FROM fingerprints f
                WHERE f.fingerprint_hash = ?
                AND f.file_path != ?
            ''', (fp_hash, file_path))
            
            for match in c.fetchall():
                matches.append({
                    'fingerprint_id': fp_id,
                    'type': fp_type,
                    'original_file': file_path,
                    'original_start': start_time,
                    'original_end': end_time,
                    'matched_file': match[0],
                    'matched_start': match[1],
                    'matched_end': match[2]
                })
        
        conn.close()
        return matches

    def cleanup_old_fingerprints(self, days: int = 30):
        """Remove fingerprints older than specified days."""
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()
        
        c.execute('''
            DELETE FROM fingerprint_matches 
            WHERE created_at < datetime('now', ?)
        ''', (f'-{days} days',))
        
        c.execute('''
            DELETE FROM fingerprints 
            WHERE created_at < datetime('now', ?)
        ''', (f'-{days} days',))
        
        conn.commit()
        conn.close()

def scan_files_with_ffmpeg(show_path: str) -> Dict:
    """Legacy function maintained for backward compatibility."""
    try:
        result = subprocess.run(
            ['ffmpeg', '-i', show_path, '-af', 'ashowinfo', '-f', 'null', '-'],
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
        logging.info(f"FFmpeg output for {show_path}:\n{result.stderr.decode()}")
        return {'status': 'success', 'output': result.stderr.decode()}
    except subprocess.CalledProcessError as e:
        logging.error(f"Error scanning {show_path} with FFmpeg:\n{e.stderr.decode()}")
        return {'status': 'error', 'error': str(e)} 