"""
This module handles interactions with the Sonarr API, including fetching series and episode data.
"""

import logging
import requests
from ..config import SONARR_URL, SONARR_API_KEY, TIMEOUT

logger = logging.getLogger(__name__)

def fetch_series_data(sonarr_url=None, api_key=None):
    """Fetch series data from the Sonarr API."""
    try:
        url = f"http://{sonarr_url or SONARR_URL}/api/v3/series"
        headers = {'X-Api-Key': api_key or SONARR_API_KEY}
        logger.info("Fetching series data from: %s", url)
        response = requests.get(url, headers=headers, timeout=TIMEOUT)
        response.raise_for_status()
        data = response.json()
        if not isinstance(data, list):
            logger.error("Unexpected response format from Sonarr API: %s", data)
            return None
        return data
    except requests.exceptions.RequestException as e:
        logger.error("Error fetching series data from Sonarr: %s", str(e))
        return None
    except Exception as e:
        logger.error("Unexpected error fetching series data: %s", str(e))
        return None

def fetch_episodes_with_files(show_id, sonarr_url=None, api_key=None):
    """Fetch episodes with files for a given show ID from the Sonarr API."""
    url = f"http://{sonarr_url or SONARR_URL}/api/v3/episode?seriesId={show_id}"
    headers = {'X-Api-Key': api_key or SONARR_API_KEY}
    logger.info("Fetching episodes from: %s", url)
    episodes_response = requests.get(
        url,
        headers=headers,
        timeout=TIMEOUT
    )
    episodes_response.raise_for_status()
    episodes_data = episodes_response.json()
    return [ep for ep in episodes_data if ep['hasFile']]

def process_episode_file(episode):
    """Process an episode file by fetching its data and storing it in the database."""
    try:
        episode_file_id = episode.get('episodeFileId')
        if episode_file_id:
            url = f"http://{SONARR_URL}/api/v3/episodefile?episodeFileIds={episode_file_id}"
            logger.info("Fetching file info from: %s", url)
            file_response = requests.get(
                url,
                headers={'X-Api-Key': SONARR_API_KEY},
                timeout=TIMEOUT
            )
            if file_response.status_code == 400:
                logger.warning(
                    "Bad Request for episode file ID %d: %s",
                    episode_file_id,
                    file_response.text
                )
                return None
            file_response.raise_for_status()
            file_data = file_response.json()
            logger.info("File data for episode file ID %d: %s", episode_file_id, file_data)
            return file_data
        return None
    except requests.exceptions.RequestException as e:
        logger.error("Error processing episode file: %s", str(e))
        return None

def fetch_json(endpoint):
    """Fetch JSON data from a specified Sonarr API endpoint."""
    try:
        url = f"http://{SONARR_URL}/api/v3/{endpoint}"
        headers = {'X-Api-Key': SONARR_API_KEY}
        logger.info("Fetching JSON from: %s", url)
        response = requests.get(url, headers=headers, timeout=TIMEOUT)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        logger.error("Error fetching JSON from endpoint %s: %s", endpoint, str(e))
        raise
