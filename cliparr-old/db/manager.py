"""
This module provides functions for interacting with the SQLite database.
It includes functions to connect to the database, insert data related to 
shows, seasons, episodes, and episode files, and 
process show data fetched from the Sonarr API.
"""

import sqlite3
import logging
from config import DB_PATH
from typing import List, Dict, Any
import math
import time
from fastapi import HTTPException
from api.sonarr_api import fetch_json

def get_db(db_path: str = 'data/cliparr.db') -> sqlite3.Connection:
    """
    Create a connection to the database with optimized settings.
    """
    try:
        conn = sqlite3.connect(db_path, 
            isolation_level=None,  # Enable autocommit
            cached_statements=100,  # Increase cached prepared statements
            timeout=10  # Increase timeout for concurrent access
        )
        
        # Enable Write-Ahead Logging (WAL) for better concurrency
        conn.execute('PRAGMA journal_mode=WAL')
        
        # Optimize performance settings
        conn.execute('PRAGMA synchronous=NORMAL')
        conn.execute('PRAGMA cache_size=-16000')  # 16MB cache
        conn.execute('PRAGMA mmap_size=30000000')  # Memory-mapped I/O
        
        # Use row_factory to return dict-like rows
        conn.row_factory = sqlite3.Row
        
        return conn
    except sqlite3.Error as e:
        logging.error(f"Database connection error: {e}")
        raise


def close_db(_):
    """Close the database connection at the end of the request."""
    db = g.pop('db', None)
    if db is not None:
        db.close()
        logging.info("Database connection closed.")


def insert_show(cur, show):
    """Insert a show into the database and return the last row ID."""
    cur.execute(
        "INSERT OR REPLACE INTO shows "
        "(sonarr_id, title, overview, path) "
        "VALUES (?, ?, ?, ?)",
        (show['id'], show.get('title', ''), show.get('overview', ''), show.get('path', ''))
    )
    # If the record already existed, fetch its ID
    if cur.lastrowid == 0:
        cur.execute("SELECT id FROM shows WHERE sonarr_id = ?", (show['id'],))
        return cur.fetchone()[0]
    return cur.lastrowid


def insert_season(cur, show_id, season_number):
    """Insert a season into the database and return the last row ID."""
    cur.execute(
        "INSERT OR IGNORE INTO seasons "
        "(show_id, season_number) "
        "VALUES (?, ?)",
        (show_id, season_number)
    )
    # Now fetch the season id (whether it was just inserted or already existed)
    cur.execute(
        "SELECT id FROM seasons WHERE show_id = ? AND season_number = ?",
        (show_id, season_number)
    )
    return cur.fetchone()[0]


def insert_episode(cur, season_id, episode):
    """Insert an episode into the database and return the last row ID."""
    cur.execute(
        "INSERT OR REPLACE INTO episodes "
        "(season_id, episode_number, title, sonarr_episode_id) "
        "VALUES (?, ?, ?, ?)",
        (season_id,
         episode.get('episodeNumber'),
         episode.get('title'),
         episode['id'])
    )
    # If the record already existed, fetch its ID
    if cur.lastrowid == 0:
        cur.execute("SELECT id FROM episodes WHERE sonarr_episode_id = ?", (episode['id'],))
        return cur.fetchone()[0]
    return cur.lastrowid


def insert_episode_file(cur, episode_id, file):
    """Insert an episode file into the database and return the last row ID."""
    cur.execute(
        "INSERT INTO episode_files "
        "(episode_id, file_path, size, quality) "
        "VALUES (?, ?, ?, ?)",
        (episode_id, file.get('path'), file.get('size'), file['quality']['quality']['name'])
    )
    return cur.lastrowid


def process_show_data(cur, show):
    """
    Process a single show's data by inserting it into the database
    and processing its episodes.
    """
    logging.info("Processing series: %s", show['title'])
    show_id = insert_show(cur, show)

    episodes = fetch_json(f'episode?seriesId={show["id"]}')
    episode_map = map_episodes_to_seasons(cur, show_id, episodes)

    files = fetch_json(f'episodefile?seriesId={show["id"]}')
    process_episode_files(cur, episode_map, files)


def map_episodes_to_seasons(cur, show_id, episodes):
    """Map episodes to their respective seasons and insert them into the database."""
    episode_map = {}
    for ep in episodes:
        season_number = ep['seasonNumber']
        episode_number = ep['episodeNumber']

        season_id = insert_season(cur, show_id, season_number)
        episode_map[ep['id']] = season_id

        cur.execute(
            "INSERT OR IGNORE INTO episodes "
            "(season_id, episode_number, title, sonarr_episode_id) "
            "VALUES (?, ?, ?, ?)",
            (season_id, episode_number, ep.get('title'), ep['id'])
        )
        cur.execute("SELECT id FROM episodes WHERE sonarr_episode_id = ?", (ep['id'],))
        episode_db_id = cur.fetchone()[0]
        episode_map[ep['id']] = episode_db_id

    return episode_map


def process_episode_files(cur, episode_map, files):
    """Process episode files and insert them into the database."""
    for ef in files:
        ep_id = ef.get('episodeId')
        if ep_id not in episode_map:
            continue
        insert_episode_file(cur, episode_map[ep_id], ef)


def store_data_in_db(data):
    """Store the provided data in the database by processing each show."""
    try:
        logging.info("Storing data in the database...")
        conn = sqlite3.connect(DB_PATH)
        cur = conn.cursor()
        for show in data:
            process_show_data(cur, show)
        conn.commit()
        logging.info("Data stored successfully.")
    except sqlite3.Error as e:
        logging.error("Error storing data in database: %s", e)
    finally:
        conn.close()
        logging.info("Database connection closed.")


def log_query_performance(func):
    def wrapper(*args, **kwargs):
        start_time = time.time()
        try:
            # Log query details
            logging.info(f"Executing query: {func.__name__}")
            logging.info(f"Query arguments: {args}, {kwargs}")
            
            result = func(*args, **kwargs)
            
            end_time = time.time()
            query_time = (end_time - start_time) * 1000
            
            # Log query performance
            logging.info(f"Query {func.__name__} took {query_time:.2f} ms")
            
            # Log result size
            if isinstance(result, dict) and 'shows' in result:
                logging.info(f"Query returned {len(result['shows'])} shows")
            elif isinstance(result, list):
                logging.info(f"Query returned {len(result)} items")
            
            return result
        except Exception as e:
            logging.error(f"Error in {func.__name__}: {e}")
            raise
    return wrapper


@log_query_performance
def get_imported_shows_optimized(cursor, page=1, page_size=100) -> Dict[str, Any]:
    """
    Efficiently fetch imported shows with minimal data retrieval and pagination.
    Uses a single query with subqueries to minimize database round trips.
    """
    try:
        # Validate and sanitize input
        page = max(1, int(page)) if page is not None else 1
        page_size = max(1, int(page_size)) if page_size is not None else 100
        
        query = '''
        WITH show_episodes AS (
            SELECT 
                s.id, 
                s.title, 
                s.path, 
                s.sonarr_id,
                COUNT(DISTINCT e.id) as episode_count,
                ROW_NUMBER() OVER (ORDER BY s.title COLLATE NOCASE) as row_num
            FROM shows s
            LEFT JOIN seasons se ON se.show_id = s.id
            LEFT JOIN episodes e ON e.season_id = se.id
            GROUP BY s.id, s.title, s.path, s.sonarr_id
        )
        SELECT 
            id, 
            title, 
            path, 
            sonarr_id, 
            episode_count
        FROM show_episodes
        WHERE row_num BETWEEN ? AND ?
        ORDER BY row_num
        '''
        
        # Calculate offset and limit
        start_row = (page - 1) * page_size + 1
        end_row = start_row + page_size - 1
        
        # Log query parameters
        logging.info(f"Fetching shows: page={page}, page_size={page_size}, start_row={start_row}, end_row={end_row}")
        
        cursor.execute(query, (start_row, end_row))
        shows = [dict(row) for row in cursor.fetchall()]
        
        # Get total count for pagination metadata
        total_query = 'SELECT COUNT(*) as total FROM shows'
        cursor.execute(total_query)
        total_count = cursor.fetchone()[0]
        
        # Log results
        logging.info(f"Fetched {len(shows)} shows out of {total_count} total")
        
        return {
            'shows': shows,
            'total': total_count,
            'page': page,
            'page_size': page_size
        }
    except (sqlite3.Error, ValueError, TypeError) as e:
        logging.error(f"Error in get_imported_shows_optimized: {e}")
        raise HTTPException(status_code=500, detail=f"Database query error: {str(e)}")
    except Exception as e:
        logging.error(f"Unexpected error in get_imported_shows_optimized: {e}")
        raise HTTPException(status_code=500, detail="An unexpected error occurred")

def get_unimported_shows_optimized(cursor) -> List[Dict[str, Any]]:
    """
    Efficiently fetch unimported shows by comparing Sonarr and local databases.
    """
    query = '''
    WITH sonarr_shows AS (
        SELECT json_extract(show_data, '$.id') as sonarr_id,
               json_extract(show_data, '$.title') as title,
               json_extract(show_data, '$.path') as path,
               json_extract(show_data, '$.statistics.episodeFileCount') as sonarr_episode_count
        FROM sonarr_shows
    ),
    local_shows AS (
        SELECT sonarr_id, 
               COUNT(e.id) as local_episode_count
        FROM shows s
        LEFT JOIN seasons se ON s.id = se.show_id
        LEFT JOIN episodes e ON se.id = e.season_id
        GROUP BY s.sonarr_id
    )
    SELECT 
        ss.sonarr_id as id, 
        ss.title, 
        ss.path, 
        ss.sonarr_episode_count,
        COALESCE(ls.local_episode_count, 0) as local_episode_count
    FROM sonarr_shows ss
    LEFT JOIN local_shows ls ON ss.sonarr_id = ls.sonarr_id
    WHERE ss.sonarr_episode_count > COALESCE(ls.local_episode_count, 0)
    '''
    cursor.execute(query)
    return [dict(row) for row in cursor.fetchall()]


def batch_insert_shows(cursor, shows: List[Dict[str, Any]]):
    """
    Batch insert shows with improved performance.
    """
    cursor.execute('BEGIN TRANSACTION')
    try:
        for show in shows:
            cursor.execute('''
                INSERT OR IGNORE INTO shows 
                (title, path, sonarr_id, overview) 
                VALUES (?, ?, ?, ?)
            ''', (
                show.get('title'), 
                show.get('path'), 
                show.get('id'), 
                show.get('overview')
            ))
        cursor.execute('COMMIT')
    except sqlite3.Error as e:
        cursor.execute('ROLLBACK')
        logging.error(f"Batch insert failed: {e}")
        raise


def get_setting(key, default=None):
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute('SELECT value FROM settings WHERE key = ?', (key,))
        row = cur.fetchone()
        if row:
            return row[0]
        return default
    finally:
        conn.close()


def set_setting(key, value):
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', (key, value))
        conn.commit()
    finally:
        conn.close()
        