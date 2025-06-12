"""
This module handles the integration with the Sonarr API to fetch and store TV series information.
It includes endpoints for scanning shows, fetching show details, and importing data from Sonarr.
"""

import os
import sqlite3
import subprocess
import logging
from flask import Flask, jsonify, redirect, g, request
import requests
from dotenv import load_dotenv
from api.sonarr_api import (
    fetch_series_data, fetch_episodes_with_files, process_episode_file, fetch_json
)
from db.manager import (
    get_db, insert_show, insert_season, insert_episode, insert_episode_file,
    process_show_data, store_data_in_db, get_imported_shows_from_db
)
from log.logging_config import configure_logging

load_dotenv()

app = Flask(__name__)

# Add timeout to requests.get calls
TIMEOUT = 10

SONARR_URL = os.getenv('SONARR_URL')
SONARR_API_KEY = os.getenv('SONARR_API_KEY')

from config import DB_PATH

# Call the logging configuration function
configure_logging()

# Register teardown function
@app.teardown_appcontext
def close_db(_):
    """Close the database connection at the end of the request."""
    db = g.pop('db', None)
    if db is not None:
        db.close()
        logging.info("Database connection closed.")

@app.route('/shows', methods=['GET'])
def get_shows():
    """Fetch and return a list of shows from the database."""
    try:
        shows = get_imported_shows_from_db()
        if shows is None:
            return jsonify({'error': 'Failed to fetch shows from database'}), 500
        return jsonify(shows)
    except Exception as e:
        logging.error("Error fetching shows: %s", str(e))
        return jsonify({'error': f"Error fetching shows: {str(e)}"}), 500

@app.route('/fetch-and-store', methods=['GET'])
def fetch_and_store():
    """Fetch data from Sonarr and store it in the database."""
    try:
        data = fetch_sonarr_data()
        store_data_in_db(data)
        return jsonify({'status': 'success'})
    except (requests.RequestException, sqlite3.Error) as e:
        return jsonify({'error': f"Error fetching and storing data: {e}"}), 500

def fetch_sonarr_data():
    """Fetch data from Sonarr API and process it."""
    try:
        logging.info("Fetching data from Sonarr...")
        series_data = fetch_series_data()

        if series_data:
            first_show = series_data[0]
            logging.info("Processing first show: %s", first_show['title'])

            episodes_with_files = fetch_episodes_with_files(first_show['id'])

            for episode in episodes_with_files:
                process_episode_file(episode)

        return series_data
    except requests.RequestException as e:
        logging.error("Error fetching data from Sonarr: %s", e)
        return []

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    """Serve the application, redirecting non-API requests to the Vite dev server."""
    # Redirect only non-API requests to Vite dev server
    if not path.startswith('api'):
        return redirect(f"http://localhost:5173/{path}")
    return jsonify({'error': 'Invalid API request'}), 404

# New endpoint to handle scanning
@app.route('/scan', methods=['POST'])
def scan_shows():
    """Scan selected shows' files using FFmpeg."""
    show_ids = request.json.get('show_ids', [])
    if not show_ids:
        return jsonify({'error': 'No shows selected'}), 400

    # Fetch show details from the database
    db = get_db()
    cursor = db.cursor()
    query = f"SELECT * FROM shows WHERE id IN ({','.join('?' * len(show_ids))})"
    cursor.execute(query, show_ids)
    shows = cursor.fetchall()

    # Scan each show's files with FFmpeg
    for show in shows:
        scan_files_with_ffmpeg(show['path'])

    return jsonify({'status': 'scanning started'})

def scan_files_with_ffmpeg(show_path):
    """Scan files with FFmpeg to create an audio fingerprint."""
    # Example FFmpeg command to create an audio fingerprint
    # Adjust the command as needed for your specific use case
    try:
        result = subprocess.run(
            ['ffmpeg', '-i', show_path, '-af', 'ashowinfo', '-f', 'null', '-'],
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
        print(f"FFmpeg output for {show_path}:\n{result.stderr.decode()}")
    except subprocess.CalledProcessError as e:
        print(f"Error scanning {show_path} with FFmpeg:\n{e.stderr.decode()}")

@app.route('/show/<int:show_id>', methods=['GET'])
def get_show_details(show_id):
    """Get details of a specific show by its ID."""
    try:
        db = get_db()
        if db is None:
            return jsonify({'error': 'Database connection error'}), 500
        cursor = db.cursor()
        cursor.execute('SELECT * FROM shows WHERE id = ?', (show_id,))
        show = cursor.fetchone()
        if show is None:
            return jsonify({'error': 'Show not found'}), 404
        show_details = {
            'id': show[0],
            'title': show[1],
            'seasons': show[2],
            'episodes': show[3],
            'sizeOnDisk': show[4],
            'path': show[5]
        }
        return jsonify(show_details)
    except sqlite3.Error as e:
        return jsonify({'error': f"Error fetching show details: {e}"}), 500

def update_database_schema():
    """Update the database schema by adding new columns or tables if needed."""
    try:
        with app.app_context():
            db = get_db()
            if db is None:
                return
            cursor = db.cursor()
            # Example: Add a new column if it doesn't exist
            cursor.execute('ALTER TABLE shows ADD COLUMN new_column_name TEXT')
            # Example: Create a new table if it doesn't exist
            cursor.execute('''
            CREATE TABLE IF NOT EXISTS new_table (
                id INTEGER PRIMARY KEY,
                name TEXT
            )
            ''')
            db.commit()
    except sqlite3.Error as e:
        print(f"Database schema update error: {e}")

def import_from_sonarr():
    """Import TV series data from Sonarr into the local database."""
    try:
        logging.info("Fetching data from Sonarr...")
        shows = fetch_json('series')

        conn = sqlite3.connect(DB_PATH)
        cur = conn.cursor()

        for show in shows:
            process_show_data(cur, show)

        conn.commit()
        logging.info("Data import completed successfully.")
    except requests.RequestException as e:
        logging.error("Error fetching data from Sonarr: %s", e)
    except sqlite3.Error as e:
        logging.error("Database error: %s", e)

def process_show(cur, show):
    """Process a show by inserting it into the database and processing its seasons."""
    show_id = insert_show(cur, show)
    if not show_id:
        logging.warning("Show insertion failed or already exists: %s", show.get('title'))
        return
    for season in show.get('seasons', []):
        process_season(cur, show_id, season)

def process_season(cur, show_id, season):
    """Process a season by inserting it into the database and processing its episodes."""
    season_number = season.get('seasonNumber')
    logging.info("Attempting to insert season: %d for show ID: %d", season_number, show_id)
    season_id = insert_season(cur, show_id, season_number)
    if not season_id:
        logging.warning("Season insertion failed or already exists: %s", season_number)
        return
    for episode in season.get('episodes', []):
        process_episode(cur, season_id, episode)

def process_episode(cur, season_id, episode):
    """Process an episode by inserting it into the database and processing its files."""
    episode_number = episode.get('episodeNumber')
    episode_title = episode.get('title')
    logging.info(
    "Attempting to insert episode: %s, Season: %d, Episode: %d",
    episode_title,
    season_id,
    episode_number
)
    episode_id = insert_episode(cur, season_id, episode)
    if not episode_id:
        logging.warning("Episode insertion failed or already exists: %s", episode_title)
        return
    for file in episode.get('fileInfo', []):
        process_file(cur, episode_id, file)

def process_file(cur, episode_id, file):
    """Process a file by inserting it into the database."""
    logging.info(
    "Attempting to insert file info for episode ID: %d, Path: %s, Size: %d, Quality: %s",
    episode_id,
    file['path'],
    file['size'],
    file['quality']
)
    insert_episode_file(cur, episode_id, file)
    if not cur.lastrowid:
        logging.warning(
    "File info insertion failed or already exists for episode ID: %s",
    episode_id
)

def initialize_database():
    """Initialize the database by creating necessary tables."""
    try:
        logging.info("Initializing database at path: %s", DB_PATH)
        os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
        conn = sqlite3.connect(DB_PATH)
        cur = conn.cursor()
        logging.info("Connected to the database.")

        # Check if tables exist
        cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='shows'")
        if not cur.fetchone():
            logging.info("Creating database tables...")
            cur.executescript("""
            CREATE TABLE IF NOT EXISTS shows (
              id INTEGER PRIMARY KEY,
              title TEXT NOT NULL,
              sonarr_id INTEGER UNIQUE,
              overview TEXT,
              path TEXT
            );
            CREATE TABLE IF NOT EXISTS seasons (
              id INTEGER PRIMARY KEY,
              show_id INTEGER,
              season_number INTEGER,
              FOREIGN KEY(show_id) REFERENCES shows(id)
            );
            CREATE TABLE IF NOT EXISTS episodes (
              id INTEGER PRIMARY KEY,
              season_id INTEGER,
              episode_number INTEGER,
              title TEXT,
              air_date TEXT,
              sonarr_episode_id INTEGER,
              FOREIGN KEY(season_id) REFERENCES seasons(id)
            );
            CREATE TABLE IF NOT EXISTS episode_files (
              id INTEGER PRIMARY KEY,
              episode_id INTEGER,
              file_path TEXT,
              size INTEGER,
              quality TEXT,
              FOREIGN KEY(episode_id) REFERENCES episodes(id)
            );
            """)
            conn.commit()
            logging.info("Tables created successfully.")
        else:
            logging.info("Database tables already exist.")
    except sqlite3.Error as e:
        logging.error("Database initialization error: %s", e)
        raise
    finally:
        if 'conn' in locals() and conn:
            conn.close()
        logging.info("Database connection closed.")

def test_sonarr_api_calls():
    """Test API calls to Sonarr to ensure data can be fetched correctly."""
    try:
        series_data = fetch_series_data_for_test()

        # Process only the first show
        if series_data:
            first_show = series_data[0]
            logging.info("Processing first show: %s", first_show['title'])

            episodes_with_files = fetch_episodes_for_test(first_show['id'])

            for episode in episodes_with_files:
                process_episode_file_for_test(episode)
    except requests.RequestException as e:
        logging.error("Error during API call: %s", e)


def fetch_series_data_for_test():
    """Fetch series data for testing purposes."""
    url = f"http://{SONARR_URL}/api/v3/series"
    headers = {'X-Api-Key': SONARR_API_KEY}
    logging.info("Fetching series data from: %s", url)
    response = requests.get(url, headers=headers, timeout=TIMEOUT)
    response.raise_for_status()
    return response.json()


def fetch_episodes_for_test(show_id):
    """Fetch episodes for a given show ID for testing purposes."""
    episodes_url = f"http://{SONARR_URL}/api/v3/episode?seriesId={show_id}"
    logging.info("Fetching episodes from: %s", episodes_url)
    episodes_response = requests.get(
        episodes_url,
        headers={'X-Api-Key': SONARR_API_KEY},
        timeout=TIMEOUT
    )
    episodes_response.raise_for_status()
    episodes_data = episodes_response.json()

    # Filter episodes with files
    episodes_with_files = [ep for ep in episodes_data if ep['hasFile']]
    logging.info(
        "Episodes with files: %s",
        [
            (ep['title'], ep['seasonNumber'], ep['episodeNumber'])
            for ep in episodes_with_files
        ]
    )
    return episodes_with_files


def process_episode_file_for_test(episode):
    """Process an episode file for testing purposes."""
    episode_file_id = episode.get('episodeFileId')
    if episode_file_id:
        file_url = f"http://{SONARR_URL}/api/v3/episodefile?episodeFileIds={episode_file_id}"
        logging.info(
            "Fetching file info from: %s",
            file_url
        )
        file_response = requests.get(
            file_url,
            headers={'X-Api-Key': SONARR_API_KEY},
            timeout=TIMEOUT
        )
        if file_response.status_code == 400:
            logging.info(
                "Bad Request for episode file ID %d: %s",
                episode_file_id,
                file_response.text
            )
        else:
            file_response.raise_for_status()
            file_data = file_response.json()
            logging.info(
                "File data for episode file ID %d: %s",
                episode_file_id,
                file_data
            )

def get_imported_shows_from_db():
    """Get all imported shows from the database."""
    try:
        db = get_db()
        cursor = db.cursor()
        cursor.execute('''
            SELECT id, title, path, sonarr_id 
            FROM shows 
            ORDER BY title
        ''')
        results = [dict(row) for row in cursor.fetchall()]
        logging.info("Retrieved %d shows from database", len(results))
        return results
    except Exception as e:
        logging.error("Error getting imported shows: %s", str(e))
        raise

@app.route('/api/imported-shows', methods=['GET'])
def get_imported_shows():
    try:
        db = get_db()
        cursor = db.cursor()
        cursor.execute('SELECT id, title, path, sonarr_id FROM shows ORDER BY title')
        shows = cursor.fetchall()
        result = []
        for show in shows:
            # Count episodes in DB
            cursor.execute('SELECT COUNT(*) FROM episodes WHERE season_id IN (SELECT id FROM seasons WHERE show_id=?)', (show['id'],))
            db_episode_count = cursor.fetchone()[0]
            # Fetch episode count from Sonarr
            sonarr_episode_count = 0
            try:
                sonarr_episodes = fetch_json(f'episode?seriesId={show["sonarr_id"]}')
                sonarr_episode_count = len(sonarr_episodes)
            except Exception:
                pass
            result.append({
                'id': show['id'],
                'title': show['title'],
                'path': show['path'],
                'db_episode_count': db_episode_count,
                'sonarr_episode_count': sonarr_episode_count,
            })
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/sonarr/unimported', methods=['GET'])
def get_unimported_shows():
    """Return shows from Sonarr that are not yet fully imported into the local database (missing or partial)."""
    try:
        sonarr_shows = fetch_series_data()
        db = get_db()
        cursor = db.cursor()
        # Get all imported shows and their episode counts
        cursor.execute('SELECT sonarr_id, id FROM shows')
        show_id_map = {row['sonarr_id']: row['id'] for row in cursor.fetchall()}
        # Get episode counts for each show in DB
        db_episode_counts = {}
        for sonarr_id, local_id in show_id_map.items():
            cursor.execute('SELECT COUNT(*) FROM episodes e JOIN seasons s ON e.season_id = s.id WHERE s.show_id = ?', (local_id,))
            db_episode_counts[sonarr_id] = cursor.fetchone()[0]
        # Build list of shows that are missing or partial
        unimported = []
        for show in sonarr_shows:
            sonarr_episode_count = show.get('statistics', {}).get('episodeFileCount', 0)
            db_count = db_episode_counts.get(show['id'], 0)
            if db_count < sonarr_episode_count:
                unimported.append(show)
        return jsonify(unimported)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/sonarr/import', methods=['POST'])
def import_selected_shows():
    """Import selected shows or missing episodes from Sonarr into the local database."""
    try:
        data = request.get_json()
        show_ids = data.get('showIds', [])
        if not show_ids:
            return jsonify({'error': 'No show IDs provided'}), 400
        sonarr_shows = fetch_series_data()
        shows_to_import = [show for show in sonarr_shows if show['id'] in show_ids]
        db = get_db()
        cur = db.cursor()
        imported_count = 0
        for show in shows_to_import:
            # Get all episodes from Sonarr for this show
            episodes = fetch_json(f'episode?seriesId={show["id"]}')
            # Get all imported episode sonarr IDs for this show
            cur.execute('SELECT s.id FROM shows s WHERE s.sonarr_id = ?', (show['id'],))
            show_row = cur.fetchone()
            if show_row:
                local_show_id = show_row[0]
                cur.execute('SELECT e.sonarr_episode_id FROM episodes e JOIN seasons s ON e.season_id = s.id WHERE s.show_id = ?', (local_show_id,))
                imported_episode_ids = set(row[0] for row in cur.fetchall())
            else:
                # Insert the show if not present
                local_show_id = insert_show(cur, show)
                imported_episode_ids = set()
            # Only import missing episodes
            missing_episodes = [ep for ep in episodes if ep['id'] not in imported_episode_ids]
            if missing_episodes:
                # Insert seasons and missing episodes
                for ep in missing_episodes:
                    season_number = ep['seasonNumber']
                    # Insert or get season
                    season_id = insert_season(cur, local_show_id, season_number)
                    # Insert episode
                    insert_episode(cur, season_id, ep)
                imported_count += 1
        db.commit()
        return jsonify({'importedCount': imported_count})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/imported-shows', methods=['DELETE'])
def delete_imported_shows():
    """Delete only the selected imported shows from the database."""
    try:
        data = request.get_json()
        show_ids = data.get('showIds', [])
        if not show_ids:
            return jsonify({'error': 'No show IDs provided'}), 400

        db = get_db()
        cursor = db.cursor()

        # Get all episode IDs for the selected shows
        cursor.execute(
            f'SELECT e.id FROM episodes e '
            f'JOIN seasons s ON e.season_id = s.id '
            f'WHERE s.show_id IN ({",".join("?" * len(show_ids))})',
            show_ids
        )
        episode_ids = [row[0] for row in cursor.fetchall()]

        # Delete episode files for these episodes
        if episode_ids:
            placeholders = ','.join(['?' for _ in episode_ids])
            cursor.execute(f'DELETE FROM episode_files WHERE episode_id IN ({placeholders})', episode_ids)

        # Delete episodes for these shows
        cursor.execute(
            f'DELETE FROM episodes WHERE season_id IN (SELECT id FROM seasons WHERE show_id IN ({",".join("?" * len(show_ids))}))',
            show_ids
        )

        # Delete seasons for these shows
        cursor.execute(
            f'DELETE FROM seasons WHERE show_id IN ({",".join("?" * len(show_ids))})',
            show_ids
        )

        # Delete the shows themselves
        cursor.execute(
            f'DELETE FROM shows WHERE id IN ({",".join("?" * len(show_ids))})',
            show_ids
        )

        db.commit()
        return jsonify({'status': 'success'})
    except sqlite3.Error as e:
        return jsonify({'error': f"Error deleting shows: {e}"}), 500

if __name__ == '__main__':
    logging.info("Starting application...")
    with app.app_context():
        try:
            logging.info("Initializing database...")
            initialize_database()
            logging.info("Testing Sonarr API calls...")
            test_sonarr_api_calls()
        except Exception as e:
            logging.error("Error during startup: %s", str(e))
            raise
    logging.info("Starting Flask server...")
    app.run(
        host='0.0.0.0',
        port=5000
    )
    