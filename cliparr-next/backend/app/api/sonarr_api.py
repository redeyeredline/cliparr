"""
This module handles interactions with the Sonarr API, including fetching series and episode data.
"""

import logging
import requests
from urllib.parse import urlparse
from ..config import SONARR_URL, SONARR_API_KEY, TIMEOUT

logger = logging.getLogger(__name__)

def _format_url(base_url: str, endpoint: str) -> str:
    """Format a Sonarr API URL properly."""
    # Remove any existing http:// or https:// from the base URL
    base_url = base_url.replace('http://', '').replace('https://', '')
    # Add http:// if not present
    if not base_url.startswith('http://') and not base_url.startswith('https://'):
        base_url = f'http://{base_url}'
    # Ensure no double slashes between base URL and endpoint
    return f"{base_url.rstrip('/')}/{endpoint.lstrip('/')}"

def fetch_series_data(sonarr_url=None, api_key=None):
    """Fetch series data from the Sonarr API."""
    try:
        url = _format_url(sonarr_url or SONARR_URL, 'api/v3/series')
        headers = {'X-Api-Key': api_key or SONARR_API_KEY}
        logger.info("Fetching series data from: %s", url)
        response = requests.get(url, headers=headers, timeout=TIMEOUT)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        logger.error("Error fetching series data: %s", str(e))
        raise


def fetch_episodes_with_files(show_id, sonarr_url=None, api_key=None):
    """Fetch episodes with files for a given show ID from the Sonarr API."""
    try:
        url = _format_url(sonarr_url or SONARR_URL, f'api/v3/episode?seriesId={show_id}')
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
    except requests.exceptions.RequestException as e:
        logger.error("Error fetching episodes for show %s: %s", show_id, str(e))
        raise


def process_episode_file(episode):
    """Process an episode file by fetching its data and storing it in the database."""
    try:
        episode_file_id = episode.get('episodeFileId')
        if episode_file_id:
            url = _format_url(SONARR_URL, f'api/v3/episodefile?episodeFileIds={episode_file_id}')
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
        url = _format_url(SONARR_URL, f'api/v3/{endpoint}')
        headers = {'X-Api-Key': SONARR_API_KEY}
        logger.info("Fetching JSON from: %s", url)
        response = requests.get(url, headers=headers, timeout=TIMEOUT)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        logger.error("Error fetching JSON from endpoint %s: %s", endpoint, str(e))
        raise
