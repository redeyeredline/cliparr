import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { query } from './manager.js';
import { logger } from '../logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Initialize the database schema
 * This should be called once when the application starts
 */
export async function initializeSchema() {
  try {
    const schemaDir = path.join(__dirname, 'schema');
    logger.info(`Reading schema files from ${schemaDir}`);
    
    const files = await fs.readdir(schemaDir);
    logger.info(`Found ${files.length} schema files`);
    
    // Sort files to ensure correct order
    const schemaFiles = files
      .filter(f => f.endsWith('.sql'))
      .sort();
    
    if (schemaFiles.length === 0) {
      throw new Error('No schema files found');
    }

    for (const file of schemaFiles) {
      logger.info(`Processing schema file: ${file}`);
      const filePath = path.join(schemaDir, file);
      
      try {
        const sql = await fs.readFile(filePath, 'utf-8');
        
        try {
          await query('BEGIN');
          await query(sql);
          await query('COMMIT');
          logger.info(`Schema file ${file} executed successfully`);
        } catch (error) {
          await query('ROLLBACK');
          logger.error(`Error executing schema file ${file}:`, error);
          throw new Error(`Failed to execute schema file ${file}: ${error.message}`);
        }
      } catch (error) {
        if (error.code === 'ENOENT') {
          throw new Error(`Schema file not found: ${file}`);
        }
        throw error;
      }
    }
    
    logger.info('Database schema initialized successfully');
  } catch (error) {
    logger.error('Error initializing database schema:', error);
    throw new Error(`Schema initialization failed: ${error.message}`);
  }
} 