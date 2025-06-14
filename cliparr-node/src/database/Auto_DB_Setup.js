const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const { SCHEMA } = require('./schema'); // Uses your existing schema definitions

/**
 * Automatically ensure database exists and is initialized
 * This function will:
 * 1. Create the directory if it doesn't exist
 * 2. Create the .db file if it doesn't exist
 * 3. Initialize all tables and indexes if they don't exist
 * 4. Return a ready-to-use database connection
 */
function ensureDatabase(dbPath = 'data/cliparr.db') {
  const absolutePath = path.resolve(dbPath);
  const dir = path.dirname(absolutePath);
  
  // Step 1: Ensure directory exists
  if (!fs.existsSync(dir)) {
    console.log(`Creating database directory: ${dir}`);
    fs.mkdirSync(dir, { recursive: true });
  }
  
  // Step 2: Check if database file exists
  const dbExists = fs.existsSync(absolutePath);
  if (!dbExists) {
    console.log(`Database file doesn't exist, will create: ${absolutePath}`);
  }
  
  // Step 3: Connect to database (this creates the file if it doesn't exist)
  const db = new Database(absolutePath);
  
  // Step 4: Initialize schema (safe to run multiple times)
  console.log('Initializing database schema...');
  
  const initSchema = db.transaction(() => {
    // Create all tables
    Object.entries(SCHEMA.tables).forEach(([tableName, sql]) => {
      console.log(`Creating table: ${tableName}`);
      db.exec(sql);
    });

    // Create all indexes
    SCHEMA.indexes.forEach((sql, index) => {
      console.log(`Creating index: ${index + 1}/${SCHEMA.indexes.length}`);
      db.exec(sql);
    });
  });

  // Execute the schema initialization
  initSchema();
  
  console.log(`Database ready at: ${absolutePath}`);
  return db;
}

/**
 * Get a database connection with automatic initialization
 * This is the main function you should use - it handles everything
 */
function getDatabase(dbPath = 'data/cliparr.db') {
  return ensureDatabase(dbPath);
}

/**
 * Singleton pattern - ensure only one database connection per path
 */
const connections = new Map();

function getDatabaseSingleton(dbPath = 'data/cliparr.db') {
  const absolutePath = path.resolve(dbPath);
  
  if (!connections.has(absolutePath)) {
    const db = ensureDatabase(absolutePath);
    connections.set(absolutePath, db);
    
    // Cleanup on process exit
    process.on('exit', () => {
      if (connections.has(absolutePath)) {
        connections.get(absolutePath).close();
        connections.delete(absolutePath);
      }
    });
  }
  
  return connections.get(absolutePath);
}

/**
 * Force recreation of database (useful for development/testing)
 */
function recreateDatabase(dbPath = 'data/cliparr.db') {
  const absolutePath = path.resolve(dbPath);
  
  // Close existing connection if any
  if (connections.has(absolutePath)) {
    connections.get(absolutePath).close();
    connections.delete(absolutePath);
  }
  
  // Delete the file if it exists
  if (fs.existsSync(absolutePath)) {
    console.log(`Deleting existing database: ${absolutePath}`);
    fs.unlinkSync(absolutePath);
  }
  
  // Create fresh database
  return ensureDatabase(absolutePath);
}

// Export functions
module.exports = {
  ensureDatabase,
  getDatabase,
  getDatabaseSingleton,
  recreateDatabase
};

// If this file is run directly, create the database
if (require.main === module) {
  console.log('Creating database automatically...');
  const db = getDatabase();
  console.log('Database created successfully!');
  db.close();
}