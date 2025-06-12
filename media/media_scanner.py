import os
import subprocess
import requests
from dotenv import load_dotenv

load_dotenv()

SONARR_URL = os.getenv('SONARR_URL')
SONARR_API_KEY = os.getenv('SONARR_API_KEY')


def fetch_sonarr_paths():
    url = f"http://{SONARR_URL}/api/v3/series"
    headers = {'X-Api-Key': SONARR_API_KEY}
    response = requests.get(url, headers=headers)
    response.raise_for_status()
    return {show['id']: show['path'] for show in response.json()}


def scan_directory(show_path):
    media_files = []
    for root, dirs, files in os.walk(show_path):
        for file in files:
            if file.endswith(('.mkv', '.mp4')):
                media_files.append(os.path.join(root, file))
    return media_files


def scan_with_ffmpeg(file_path):
    try:
        result = subprocess.run(
            ['ffmpeg', '-i', file_path, '-af', 'ashowinfo', '-f', 'null', '-'],
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
        print(f"FFmpeg output for {file_path}:\n{result.stderr.decode()}")
    except subprocess.CalledProcessError as e:
        print(f"Error scanning {file_path} with FFmpeg:\n{e.stderr.decode()}")


def main():
    sonarr_paths = fetch_sonarr_paths()
    for show_id, show_path in sonarr_paths.items():
        media_files = scan_directory(show_path)
        for file_path in media_files:
            scan_with_ffmpeg(file_path)


if __name__ == '__main__':
    main()
    