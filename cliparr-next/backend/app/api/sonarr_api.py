"""
This module handles interactions with the Sonarr API, including fetching series and episode data.
"""

import logging
import requests
from ..config import SONARR_URL, SONARR_API_KEY, TIMEOUT


def fetch_series_data(sonarr_url=None, api_key=None):
    """Fetch series data from the Sonarr API."""
    url = f"http://{sonarr_url or SONARR_URL}/api/v3/series"
    headers = {'X-Api-Key': api_key or SONARR_API_KEY}
    logging.info("Fetching series data from: %s", url)
    response = requests.get(url, headers=headers, timeout=TIMEOUT)
    response.raise_for_status()
    return response.json()


def fetch_episodes_with_files(show_id, sonarr_url=None, api_key=None):
    """Fetch episodes with files for a given show ID from the Sonarr API."""
    episodes_url = f"http://{sonarr_url or SONARR_URL}/api/v3/episode?seriesId={show_id}"
    headers = {'X-Api-Key': api_key or SONARR_API_KEY}
    logging.info("Fetching episodes from: %s", episodes_url)
    episodes_response = requests.get(
        episodes_url,
        headers=headers,
        timeout=TIMEOUT
    )
    episodes_response.raise_for_status()
    episodes_data = episodes_response.json()

    return [ep for ep in episodes_data if ep['hasFile']]


def process_episode_file(episode):
    """Process an episode file by fetching its data and storing it in the database."""
    episode_file_id = episode.get('episodeFileId')
    if episode_file_id:
        file_url = f"http://{SONARR_URL}/api/v3/episodefile?episodeFileIds={episode_file_id}"
        logging.info("Fetching file info from: %s", file_url)
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
            logging.info("File data for episode file ID %d: %s", episode_file_id, file_data)


def fetch_json(endpoint):
    """Fetch JSON data from a specified Sonarr API endpoint."""
    url = f"http://{SONARR_URL}/api/v3/{endpoint}"
    headers = {'X-Api-Key': SONARR_API_KEY}
    response = requests.get(url, headers=headers, timeout=TIMEOUT)
    response.raise_for_status()
    return response.json()
