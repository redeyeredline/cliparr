# Cliparr Project

## Project Overview
Cliparr is a media management application that integrates with the Sonarr API to fetch and store information about TV series. It provides a web interface for users to view series details and manage their media library.

## Features
- Fetch series data from Sonarr API
- Store series information in a SQLite database
- Web interface to view series list and details
- Scan media files using FFmpeg

## Import Modes

Cliparr supports three import modes, controlled by the `CLIPARR_IMPORT_MODE` environment variable or via the Settings page in the UI:

- **none** (default):
  - Requires manual import of shows and manual selection for audio fingerprint analysis.
- **import**:
  - Automatically schedules audio fingerprint analysis for shows you import.
  - Periodically scans for new episodes for shows you have imported and schedules audio fingerprint analysis for them.
- **auto**:
  - Will sync all shows automatically from Sonarr and schedule fingerprinting for all media.
  - No changes to your data will be made.
  - Will also scan for updates to media and perform audio analysis automatically.

You can change this mode at any time from the Settings page.

## Installation
1. Clone the repository.
2. Navigate to the project directory.
3. Set up the environment variables as described below.
4. Build and run the Docker container using the provided Dockerfile and docker-compose.yml.

## Usage
- Access the web interface at `http://localhost:8484`.
- Use the API endpoints to interact with the application programmatically.
- The import mode (see above) controls how shows and audio analysis are handled.

## Environment Variables
- `SONARR_URL`: The URL of your Sonarr instance.
- `SONARR_API_KEY`: The API key for accessing Sonarr.

## API Endpoints
- `GET /shows`: Fetch all shows from Sonarr.
- `GET /fetch-and-store`: Fetch and store series data in the database.
- `POST /scan`: Scan selected shows' files with FFmpeg.
- `GET /show/<id>`: Get details of a specific show by ID.

## Technologies Used
- Flask
- React
- Vite
- SQLite
- FFmpeg

## Contributing
Contributions are welcome! Please fork the repository and submit a pull request.

## License
This project is licensed under the MIT License. 