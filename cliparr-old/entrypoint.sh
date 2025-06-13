#!/bin/sh
. /venv/bin/activate
python3 -c 'from app import initialize_database; initialize_database()'
exec python3 app.py 