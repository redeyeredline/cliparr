import requests
import logging
import os


SONARR_URL = os.getenv('SONARR_URL')
SONARR_API_KEY = os.getenv('SONARR_API_KEY')


# Fetch series data from Sonarr

def fetch_series_data():
    """Fetch series data from Sonarr API."""
    try:
        url = f"http://{SONARR_URL}/api/v3/series"
        headers = {'X-Api-Key': SONARR_API_KEY}
        logging.info("Requesting URL: %s with headers: %s", url, headers)
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        return response.json()
    except requests.RequestException as e:
        logging.error("Error fetching series data from Sonarr: %s", e)
        return []


def fetch_episodes_with_files(series_id):
    """Fetch episodes with files for a given series ID."""
    try:
        url = f"http://{SONARR_URL}/api/v3/episode?seriesId={series_id}"
        headers = {'X-Api-Key': SONARR_API_KEY}
        logging.info("Requesting URL: %s with headers: %s", url, headers)
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        return response.json()
    except requests.RequestException as e:
        logging.error("Error fetching episodes with files from Sonarr: %s", e)
        return []


def process_episode_file(episode):
    """Process an episode file."""
    logging.info("Processing episode file: %s", episode['title'])


def fetch_json(endpoint):
    """Fetch JSON data from a given Sonarr API endpoint."""
    try:
        url = f"http://{SONARR_URL}/api/v3/{endpoint}"
        headers = {'X-Api-Key': SONARR_API_KEY}
        logging.info("Requesting URL: %s with headers: %s", url, headers)
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        return response.json()
    except requests.RequestException as e:
        logging.error("Error fetching JSON data from Sonarr: %s", e)
        return [] 