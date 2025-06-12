"""
This module provides functions for interacting with the SQLite database.
It includes functions to connect to the database, insert data related to 
shows, seasons, episodes, and episode files, and 
process show data fetched from the Sonarr API.
"""

import sqlite3
import logging
from config import DB_PATH

def get_db():
    """Connect to the SQLite database and return the connection object."""
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row  # Enable dictionary-like access to rows
        logging.info("Database connection established.")
        return conn
    except sqlite3.Error as e:
        logging.error("Database connection error: %s", e)
        return None


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


def get_imported_shows_from_db():
    """Return all imported shows from the database."""
    conn = get_db()
    if not conn:
        return []
    
    try:
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM shows')
        shows = cursor.fetchall()
        result = []
        for show in shows:
            result.append({
                'id': show['id'],
                'title': show['title'],
                'overview': show['overview'],
                'path': show['path'],
            })
        return result
    finally:
        conn.close()
        logging.info("Database connection closed.")


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
        