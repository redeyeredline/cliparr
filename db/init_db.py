import os
import sqlite3
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def init_db():
    """Initialize the database with the schema."""
    # Get the path to the schema file
    schema_path = os.path.join(os.path.dirname(__file__), 'schema.sql')
    # Get the path to the database file
    db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data', 'cliprr.db')
    
    # Ensure the data directory exists
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    
    try:
        # Read the schema file
        with open(schema_path, 'r') as f:
            schema = f.read()
        
        # Connect to the database and create tables
        conn = sqlite3.connect(db_path)
        conn.executescript(schema)
        conn.close()
        
        logging.info(f"Database initialized successfully at {db_path}")
    except Exception as e:
        logging.error(f"Error initializing database: {e}")
        raise

if __name__ == '__main__':
    init_db() 