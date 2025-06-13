"""
This module handles the integration with the Sonarr API to fetch and store TV series information.
It includes endpoints for scanning shows, fetching show details, and importing data from Sonarr.
"""

# Standard library imports
import asyncio
import datetime
import logging
import os
import platform
import sqlite3
import sys
import time
import traceback
from contextlib import asynccontextmanager
from typing import List, Dict, Optional

# Third-party imports
import fastapi
from dotenv import load_dotenv
from fastapi import FastAPI, Request, HTTPException, Depends, BackgroundTasks, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
import hypercorn.asyncio
import socketio
import uvicorn
from fastapi.templating import Jinja2Templates
from fastapi.websockets import WebSocketState
import json

# Local imports
from .config import (
    DB_PATH,
    LOG_DIR,
    CONFIG_DIR,
    SONARR_URL,
    SONARR_API_KEY,
    TIMEOUT,
    IMPORT_MODE,
    ENV,
    DEBUG,
    HOST,
    PORT,
    CLIPARR_IMPORT_MODE
)
from .db.settings import set_import_mode, get_import_mode
from .db.manager import (
    get_db,
    insert_show,
    insert_season,
    insert_episode,
    process_show_data,
    store_data_in_db,
    get_imported_shows_optimized
)
from .api.sonarr_api import fetch_series_data, fetch_json
from .log.logging_config import configure_logging
from .media.audio_analysis_jobs import AudioAnalysisJobManager
from .db.init_db import init_db

load_dotenv()

# Configure logging
configure_logging()
logger = logging.getLogger(__name__)

# Debug: Print environment and paths
logger.info("Environment: %s", ENV)
logger.info("DB_PATH: %s", DB_PATH)
logger.info("LOG_DIR: %s", LOG_DIR)
logger.info("CONFIG_DIR: %s", CONFIG_DIR)

# Debug: Check if directories exist
for path in [os.path.dirname(DB_PATH), LOG_DIR, CONFIG_DIR]:
    logger.info("Checking directory: %s", path)
    if os.path.exists(path):
        logger.info("Directory exists: %s", path)
    else:
        logger.info("Directory does not exist: %s", path)

# Initialize FastAPI with performance optimizations
app = FastAPI(
    title="Cliparr",
    description="Media Management Application",
    version="0.1.0",
    docs_url=None,  # Disable Swagger UI in production
    redoc_url=None,  # Disable ReDoc
)

# Mount static files for assets
app.mount("/assets", StaticFiles(directory="static/assets"), name="assets")

# Serve index.html for all other routes
@app.get("/{path:path}")
async def serve_spa(path: str):
    return FileResponse("static/index.html")

# Add performance middleware
app.add_middleware(CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)
app.add_middleware(GZipMiddleware, minimum_size=1000)  # Compress responses larger than 1000 bytes

# Configure socket.io with performance settings
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    ping_timeout=30,  # Increased timeout
    ping_interval=60,  # Increased interval
    logger=True,  # Enable logging for debugging
    engineio_logger=True,  # Enable engine.io logging
    max_http_buffer_size=1024 * 1024,  # 1MB max buffer size
    async_handlers=True,  # Use async handlers
    cors_credentials=True  # Allow credentials
)
socket_app = socketio.ASGIApp(sio, app, socketio_path='/socket.io')

# Initialize audio analysis job manager
audio_job_manager = AudioAnalysisJobManager()

# Global flag to control background task
background_task_running = False
background_task_thread = None

# Initialize database
try:
    logger.info("Initializing database...")
    init_db()
    logger.info("Database initialized successfully")
except Exception as e:
    logger.error("Failed to initialize database: %s", e)
    raise

# Set the import mode from the database or environment
current_mode = get_import_mode()
set_import_mode(current_mode)

async def background_import_task():
    """
    Background task for automatic import and scanning.
    """
    global background_task_running
    while background_task_running:
        try:
            # Use the current import mode from the database
            current_mode = get_import_mode()
            if current_mode == 'auto':
                logging.info("Running auto import scan...")
                sonarr_shows = fetch_series_data()
                db = get_db()
                cur = db.cursor()
                # Existing import logic remains the same
                for show in sonarr_shows:
                    episodes = fetch_json(f'episode?seriesId={show["id"]}')
                    cur.execute('SELECT s.id FROM shows s WHERE s.sonarr_id = ?', (show['id'],))
                    show_row = cur.fetchone()
                    if show_row:
                        local_show_id = show_row[0]
                        cur.execute('SELECT e.sonarr_episode_id FROM episodes e JOIN seasons s ON e.season_id = s.id WHERE s.show_id = ?', (local_show_id,))
                        imported_episode_ids = set(row[0] for row in cur.fetchall())
                    else:
                        local_show_id = insert_show(cur, show)
                        imported_episode_ids = set()

                    missing_episodes = [ep for ep in episodes if ep['id'] not in imported_episode_ids]

                    if missing_episodes:
                        for ep in missing_episodes:
                            season_number = ep['seasonNumber']
                            season_id = insert_season(cur, local_show_id, season_number)
                            insert_episode(cur, season_id, ep)

                db.commit()

                # Use async emit for WebSocket
                await sio.emit('show_imported', {'status': 'scan_complete'})

            elif current_mode == 'import':
                # Handle import mode - only scan imported shows
                logging.info("Running import mode scan...")
                db = get_db()
                cur = db.cursor()
                cur.execute('SELECT sonarr_id FROM shows')
                imported_sonarr_ids = [row[0] for row in cur.fetchall()]

                for sonarr_id in imported_sonarr_ids:
                    episodes = fetch_json(f'episode?seriesId={sonarr_id}')
                    cur.execute('SELECT s.id FROM shows s WHERE s.sonarr_id = ?', (sonarr_id,))
                    show_row = cur.fetchone()

                    if show_row:
                        local_show_id = show_row[0]
                        cur.execute('SELECT e.sonarr_episode_id FROM episodes e JOIN seasons s ON e.season_id = s.id WHERE s.show_id = ?', (local_show_id,))
                        imported_episode_ids = set(row[0] for row in cur.fetchall())
                        missing_episodes = [ep for ep in episodes if ep['id'] not in imported_episode_ids]

                        if missing_episodes:
                            for ep in missing_episodes:
                                season_number = ep['seasonNumber']
                                season_id = insert_season(cur, local_show_id, season_number)
                                insert_episode(cur, season_id, ep)
                    db.commit()
                                # Use async emit for WebSocket
                await sio.emit('show_imported', {'status': 'scan_complete'})

            await asyncio.sleep(300)  # Sleep for 5 minutes between scans

        except Exception as e:
            logging.error(f"Error in background import task: {e}")
            await asyncio.sleep(300)  # Sleep even on error to prevent rapid retries

def start_background_task():
    global background_task_running, background_task_thread
    if not background_task_running:
        background_task_running = True
        # Use asyncio to run the background task
        asyncio.create_task(background_import_task())

def stop_background_task():
    global background_task_running
    background_task_running = False

@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        # Simplified database initialization with minimal logging
        logging.info(f"Initializing application with import mode: {IMPORT_MODE}")
        logging.info(f"Environment: {ENV}")
        init_db()

        # Start background task based on import mode
        if IMPORT_MODE in ("auto", "import"):
            try:
                start_background_task()
            except Exception as e:
                logging.error(f"Failed to start background task: {e}")
        else:
            logging.info("Background task not started due to import mode")
    except Exception as e:
        logging.error(f"Critical startup error: {e}", exc_info=True)
        # Consider raising an exception to prevent app startup if critical
    yield
    # Shutdown code
    stop_background_task()

def log_performance(func):
    async def wrapper(*args, **kwargs):
        start_time = time.time()
        try:
            result = await func(*args, **kwargs)
            end_time = time.time()
            logging.info(f"Performance: {func.__name__} took {(end_time - start_time) * 1000:.2f} ms")
            return result
        except Exception as e:
            logging.error(f"Error in {func.__name__}: {e}")
            raise
    return wrapper

@log_performance
async def get_imported_shows(page: Optional[int] = 1, page_size: Optional[int] = 100):
    """
    Retrieve paginated list of imported shows with comprehensive error handling.
    
    :param page: Page number (default: 1)
    :param page_size: Number of shows per page (default: 100)
    :return: Paginated list of imported shows
    """
    # Ensure page and page_size are positive integers
    page = max(1, page or 1)
    page_size = max(1, page_size or 100)

    conn = None
    try:
        # Detailed logging for database connection
        logging.info(f"Attempting to connect to database at {DB_PATH}")

        # Validate database path
        if not os.path.exists(DB_PATH):
            logging.error(f"Database file does not exist: {DB_PATH}")
            return {
                "error": "Database file not found",
                "details": f"Path: {DB_PATH}",
                "shows": [],
                "total": 0,
                "page": page,
                "page_size": page_size,
                "total_pages": 0
            }

        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row  # Enable dictionary-like access
        cursor = conn.cursor()

        # Comprehensive database diagnostics
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = cursor.fetchall()
        logging.info(f"Existing tables: {[table[0] for table in tables]}")

# Validate shows table exists
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='shows'")
        shows_table_exists = cursor.fetchone() is not None

        if not shows_table_exists:
            logging.warning("Shows table does not exist. Attempting to create.")
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS shows (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    title TEXT NOT NULL,
                    sonarr_id INTEGER UNIQUE,
                    path TEXT
                )
            ''')
            conn.commit()

        # Performance tracking for count query
        count_start = time.time()
        cursor.execute('SELECT COUNT(*) FROM shows')
        total_shows = cursor.fetchone()[0]
        count_duration = time.time() - count_start
        logging.info(f"Count query took {count_duration * 1000:.2f} ms")

        # Calculate total pages
        total_pages = max(1, (total_shows + page_size - 1) // page_size)

        # Ensure page is within valid range
        page = min(page, total_pages)

        # Calculate offset
        offset = (page - 1) * page_size

        # Performance tracking for fetch query
        fetch_start = time.time()
        cursor.execute('''
            SELECT id, title, sonarr_id, path 
            FROM shows 
            ORDER BY title 
            LIMIT ? OFFSET ?
        ''', (page_size, offset))

        shows_rows = cursor.fetchall()
        fetch_duration = time.time() - fetch_start
        logging.info(f"Fetch query took {fetch_duration * 1000:.2f} ms")

        shows = []
        for row in shows_rows:
            try:
                show = {
                    'id': row['id'],
                    'title': row['title'],
                    'sonarr_id': row['sonarr_id'],
                    'path': row['path']
                }

                # Fetch season and episode count
                season_stats_start = time.time()
                cursor.execute('''
                    SELECT 
                        COUNT(DISTINCT s.id) as season_count,
                        COUNT(e.id) as episode_count
                    FROM seasons s
                    LEFT JOIN episodes e ON e.season_id = s.id
                    WHERE s.show_id = ?
                ''', (row['id'],))

                season_stats = cursor.fetchone()
                season_stats_duration = time.time() - season_stats_start
                logging.info(f"Season stats query took {season_stats_duration * 1000:.2f} ms")

                show['seasons_count'] = season_stats[0] if season_stats else 0
                show['episodes_count'] = season_stats[1] if season_stats else 0

                shows.append(show)
            except Exception as row_error:
                logging.error(f"Error processing show row: {row_error}", exc_info=True)

        # Comprehensive response logging
        response = {
            "shows": shows,
            "total": total_shows,
            "page": page,
            "page_size": page_size,
            "total_pages": total_pages,
            "performance": {
                "count_query_ms": count_duration * 1000,
                "fetch_query_ms": fetch_duration * 1000,
                "season_stats_query_ms": season_stats_duration * 1000
            }
        }

        logging.info(f"Returning {len(shows)} shows out of {total_shows}")

        return response

    except sqlite3.Error as e:
        logging.error(f"SQLite error fetching imported shows: {e}", exc_info=True)
        return {
            "error": f"Database error: {str(e)}",
            "error_type": "sqlite_error",
            "shows": [],
            "total": 0,
            "page": page,
            "page_size": page_size,
            "total_pages": 0
        }
    except Exception as e:
        logging.error(f"Unexpected error fetching imported shows: {e}", exc_info=True)
        return {
            "error": f"Unexpected error: {str(e)}",
            "error_type": "unexpected_error",
            "shows": [],
            "total": 0,
            "page": page,
            "page_size": page_size,
            "total_pages": 0
        }
    finally:
        if conn:
            conn.close()

@app.get('/api/sonarr/unimported')
@log_performance
async def get_unimported_shows():
    try:
        sonarr_shows = fetch_series_data()
        db = get_db()
        cursor = db.cursor()
        cursor.execute('SELECT sonarr_id, id FROM shows')
        show_id_map = {row['sonarr_id']: row['id'] for row in cursor.fetchall()}
        db_episode_counts = {}
        for sonarr_id, local_id in show_id_map.items():
            cursor.execute('SELECT COUNT(*) FROM episodes e JOIN seasons s ON e.season_id = s.id WHERE s.show_id = ?', (local_id,))
            db_episode_counts[sonarr_id] = cursor.fetchone()[0]
        unimported = []
        for show in sonarr_shows:
            sonarr_episode_count = show.get('statistics', {}).get('episodeFileCount', 0)
            db_count = db_episode_counts.get(show['id'], 0)
            if db_count < sonarr_episode_count:
                unimported.append(show)
        return unimported
    except Exception as e:
        logging.error(f"Error fetching unimported shows: {e}")
        return {"error": str(e)}

@app.post('/api/sonarr/import')
async def import_selected_shows(request: Request):
    try:
        data = await request.json()
        show_ids = data.get('showIds', [])
        if not show_ids:
            return {"error": "No show IDs provided"}
        sonarr_shows = fetch_series_data()
        shows_to_import = [show for show in sonarr_shows if show['id'] in show_ids]
        db = get_db()
        cur = db.cursor()
        imported_shows = []
        for show in shows_to_import:
            episodes = fetch_json(f'episode?seriesId={show["id"]}')
            cur.execute('SELECT s.id FROM shows s WHERE s.sonarr_id = ?', (show['id'],))
            show_row = cur.fetchone()
            if show_row:
                local_show_id = show_row[0]
                cur.execute('SELECT e.sonarr_episode_id FROM episodes e JOIN seasons s ON e.season_id = s.id WHERE s.show_id = ?', (local_show_id,))
                imported_episode_ids = set(row[0] for row in cur.fetchall())
            else:
                local_show_id = insert_show(cur, show)
                imported_episode_ids = set()
            missing_episodes = [ep for ep in episodes if ep['id'] not in imported_episode_ids]
            if missing_episodes:
                for ep in missing_episodes:
                    season_number = ep['seasonNumber']
                    season_id = insert_season(cur, local_show_id, season_number)
                    insert_episode(cur, season_id, ep)
                imported_shows.append({
                    'id': show['id'],
                    'title': show['title'],
                    'episodesImported': len(missing_episodes)
                })
        db.commit()
        return {
            "importedCount": len(imported_shows),
            "importedShows": imported_shows
        }
    except Exception as e:
        logging.error(f"Error importing shows: {e}")
        return {"error": str(e)}

@app.post('/api/imported-shows')
async def delete_imported_shows(request: Request):
    try:
        data = await request.json()
        show_ids = data.get('showIds', [])
        if not show_ids:
            logging.error("No show IDs provided for deletion")
            return {"error": "No show IDs provided"}

        logging.info(f"Attempting to delete shows with IDs: {show_ids}")
        db = get_db()
        cursor = db.cursor()

        # First get episode IDs
        cursor.execute(
            f'SELECT e.id FROM episodes e JOIN seasons s ON e.season_id = s.id WHERE s.show_id IN ({",".join("?" * len(show_ids))})',
            show_ids
        )
        episode_ids = [row[0] for row in cursor.fetchall()]
        logging.info(f"Found {len(episode_ids)} episodes to delete")

        # Delete episode files
        if episode_ids:
            placeholders = ','.join(['?' for _ in episode_ids])
            cursor.execute(f'DELETE FROM episode_files WHERE episode_id IN ({placeholders})', episode_ids)
            logging.info(f"Deleted episode files for {len(episode_ids)} episodes")

        # Delete episodes
        cursor.execute(
            f'DELETE FROM episodes WHERE season_id IN (SELECT id FROM seasons WHERE show_id IN ({",".join("?" * len(show_ids))}))',
            show_ids
        )
        logging.info(f"Deleted episodes for shows {show_ids}")

        # Delete seasons
        cursor.execute(
            f'DELETE FROM seasons WHERE show_id IN ({",".join("?" * len(show_ids))})',
            show_ids
        )
        logging.info(f"Deleted seasons for shows {show_ids}")

        # Finally delete shows
        cursor.execute(
            f'DELETE FROM shows WHERE id IN ({",".join("?" * len(show_ids))})',
            show_ids
        )
        logging.info(f"Deleted shows {show_ids}")

        db.commit()
        logging.info("Successfully committed all deletions")
        return {"status": "success"}
    except sqlite3.Error as e:
        logging.error(f"Database error while deleting shows: {e}")
        return {"error": f"Error deleting shows: {e}"}
    except Exception as e:
        logging.error(f"Unexpected error while deleting shows: {e}")
        return {"error": f"Unexpected error: {e}"}

@app.get('/api/series/{show_id}')
async def api_get_series(show_id: int):
    db = get_db()
    cursor = db.cursor()
    cursor.execute('SELECT id, title, overview, path FROM shows WHERE id = ?', (show_id,))
    show = cursor.fetchone()
    if not show:
        return {"error": "Show not found"}
    cursor.execute('SELECT id, season_number FROM seasons WHERE show_id = ? ORDER BY season_number', (show_id,))
    seasons = cursor.fetchall()
    season_list = []
    for season in seasons:
        season_id, season_number = season['id'], season['season_number']
        cursor.execute('SELECT episode_number, title FROM episodes WHERE season_id = ? ORDER BY episode_number', (season_id,))
        episodes = [{'episodeNumber': ep['episode_number'], 'title': ep['title']} for ep in cursor.fetchall()]
        season_list.append({
            'seasonNumber': season_number,
            'episodes': episodes
        })
    return {
        'id': show['id'],
        'title': show['title'],
        'overview': show['overview'],
        'path': show['path'],
        'seasons': season_list
    }

@app.get('/api/settings/import-mode')
async def get_import_mode():
    from app.config import IMPORT_MODE
    return {"mode": IMPORT_MODE}

@app.post('/api/settings/import-mode')
async def update_import_mode(request: Request):
    data = await request.json()
    mode = data.get('mode', 'none').lower()
    if mode not in ('auto', 'import', 'none'):
        return {"error": "Invalid mode"}
    try:
        set_import_mode(mode)
        logging.info(f"Import mode set to: {mode}")
        # Handle background task based on mode
        if mode in ('auto', 'import'):
            start_background_task()
            # Trigger immediate scan
            try:
                sonarr_shows = fetch_series_data()
                db = get_db()
                cur = db.cursor()
                for show in sonarr_shows:
                    episodes = fetch_json(f'episode?seriesId={show["id"]}')
                    cur.execute('SELECT s.id FROM shows s WHERE s.sonarr_id = ?', (show['id'],))
                    show_row = cur.fetchone()
                    if show_row:
                        local_show_id = show_row[0]
                        cur.execute('SELECT e.sonarr_episode_id FROM episodes e JOIN seasons s ON e.season_id = s.id WHERE s.show_id = ?', (local_show_id,))
                        imported_episode_ids = set(row[0] for row in cur.fetchall())
                    else:
                        local_show_id = insert_show(cur, show)
                        imported_episode_ids = set()
                    missing_episodes = [ep for ep in episodes if ep['id'] not in imported_episode_ids]
                    if missing_episodes:
                        for ep in missing_episodes:
                            season_number = ep['seasonNumber']
                            season_id = insert_season(cur, local_show_id, season_number)
                            insert_episode(cur, season_id, ep)
                db.commit()
                sio.emit('show_imported', {'status': 'scan_complete'})
            except Exception as e:
                logging.error(f"Error during immediate scan: {e}")
        else:
            stop_background_task()

        return {"status": "ok", "mode": mode}
    except Exception as e:
        logging.error(f'Failed to set import mode: {e}', exc_info=True)
        return {"error": f'Failed to set import mode: {e}'}

# Improved WebSocket event handlers with logging
@sio.on('connect')
async def connect(sid, environ):
    logger.info(f"WebSocket client connected: {sid}")
    try:
        # Send minimal connection confirmation
        await sio.emit('connection_status', {
            'status': 'connected', 
            'timestamp': int(time.time() * 1000)
        }, room=sid)
    except Exception as e:
        logger.error(f"WebSocket connection error: {e}")

@sio.on('disconnect')
async def disconnect(sid):
    logger.info(f"WebSocket client disconnected: {sid}")

@sio.on('connect_error')
async def connect_error(error):
    logger.error(f"WebSocket connection error: {error}", exc_info=True)

# Add a specific route to test WebSocket connection
@app.get('/api/websocket-test')
async def websocket_test():
    return {"status": "WebSocket server is running"}

@app.get('/api/audio-analysis/jobs')
async def get_audio_analysis_jobs(
    status: Optional[str] = None,
    limit: int = 100,
    offset: int = 0
) -> List[Dict]:
    """
    Retrieve audio analysis jobs.
    
    :param status: Filter by job status
    :param limit: Maximum number of jobs to return
    :param offset: Offset for pagination
    :return: List of job details
    """
    return audio_job_manager.get_jobs(status, limit, offset)

@app.post('/api/audio-analysis/schedule')
async def schedule_audio_analysis(
    show_id: int,
    show_title: str,
    episodes: List[Dict]
) -> Dict:
    """
    Schedule audio analysis for a show or specific episodes.
    
    :param show_id: ID of the show
    :param show_title: Title of the show
    :param episodes: List of episodes to analyze
    :return: Job scheduling status
    """
    try:
        # Validate episodes input
        validated_episodes = []
        for episode in episodes:
            if 'file_path' not in episode:
                raise HTTPException(status_code=400, detail="Each episode must have a file_path")
            validated_episodes.append({
                'file_path': episode['file_path'],
                'season_number': episode.get('season_number'),
                'episode_number': episode.get('episode_number')
            })

        # Schedule audio analysis
        await audio_job_manager.schedule_show_analysis(
            show_id,
            show_title,
            validated_episodes
        )

        # Emit WebSocket event for real-time updates
        await sio.emit('audio_analysis_scheduled', {
            'show_id': show_id,
            'show_title': show_title,
            'episode_count': len(validated_episodes)
        })

        return {
            "status": "success", 
            "message": f"Scheduled audio analysis for {show_title}",
            "episode_count": len(validated_episodes)
        }
    except Exception as e:
        logging.error(f"Error scheduling audio analysis: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post('/api/audio-analysis/cleanup')
async def cleanup_audio_analysis_jobs(days: int = 30) -> Dict:
    """
    Cleanup old audio analysis jobs.
    
    :param days: Number of days to keep jobs
    :return: Cleanup status
    """
    try:
        audio_job_manager.cleanup_old_fingerprints(days)
        return {
            "status": "success", 
            "message": f"Cleaned up audio analysis jobs older than {days} days"
        }
    except Exception as e:
        logging.error(f"Error cleaning up audio analysis jobs: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@sio.on('test_event')
async def handle_test_event(sid, data):
    """
    Comprehensive test event handler for diagnostics.
    """
    try:
        # Validate incoming data
        if not isinstance(data, dict):
            logging.warning(f"Invalid test_event data type: {type(data)}")
            await sio.emit('test_event_response', {
                'status': 'error', 
                'error': 'Invalid data format',
                'received_data_type': str(type(data))
            }, room=sid)
            return

        client_timestamp = data.get('timestamp')
        if not isinstance(client_timestamp, (int, float)):
            logging.warning(f"Invalid timestamp: {client_timestamp}")
            await sio.emit('test_event_response', {
                'status': 'error', 
                'error': 'Invalid timestamp',
                'received_timestamp': client_timestamp
            }, room=sid)
            return

        # Comprehensive response with additional diagnostics
        await sio.emit('test_event_response', {
            'status': 'success', 
            'serverTimestamp': int(time.time() * 1000),
            'clientTimestamp': client_timestamp,
            'serverInfo': {
                'python_version': platform.python_version(),
                'os_name': platform.system(),
                'os_version': platform.release(),
                'server_time': datetime.now().isoformat()
            }
        }, room=sid)
    except Exception as e:
        logging.error(f"Error handling test event: {e}", exc_info=True)
        await sio.emit('test_event_response', {
            'status': 'error', 
            'error': str(e),
            'details': traceback.format_exc()
        }, room=sid)

# To run: uvicorn app:socket_app --host 0.0.0.0 --port 5000

if __name__ == '__main__':
    try:
        import hypercorn.asyncio
        import hypercorn.config
        import asyncio
        config = hypercorn.config.Config()
        config.bind = ["0.0.0.0:5000"]
        asyncio.run(hypercorn.asyncio.serve(socket_app, config))
    except ImportError:
        import uvicorn
        uvicorn.run(socket_app, host="0.0.0.0", port=5000)
    