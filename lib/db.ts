import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dbDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'tutor.db');
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Initialize database schema
export function initDb() {
  // Images table - stores uploaded images
  db.exec(`
    CREATE TABLE IF NOT EXISTS images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      filepath TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // LLM interactions table - stores all LLM API calls
  db.exec(`
    CREATE TABLE IF NOT EXISTS llm_interactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      model TEXT NOT NULL,
      prompt TEXT NOT NULL,
      response TEXT NOT NULL,
      tokens_used INTEGER,
      cost REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Junction table - links multiple images to one interaction
  db.exec(`
    CREATE TABLE IF NOT EXISTS interaction_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      interaction_id INTEGER NOT NULL,
      image_id INTEGER NOT NULL,
      order_index INTEGER NOT NULL,
      FOREIGN KEY (interaction_id) REFERENCES llm_interactions(id) ON DELETE CASCADE,
      FOREIGN KEY (image_id) REFERENCES images(id) ON DELETE CASCADE,
      UNIQUE(interaction_id, image_id)
    )
  `);

  // Flashcard sets table - groups of flashcards
  db.exec(`
    CREATE TABLE IF NOT EXISTS flashcard_sets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      llm_interaction_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (llm_interaction_id) REFERENCES llm_interactions(id) ON DELETE CASCADE
    )
  `);

  // Flashcards table - individual flashcards
  db.exec(`
    CREATE TABLE IF NOT EXISTS flashcards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      set_id INTEGER NOT NULL,
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      order_index INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (set_id) REFERENCES flashcard_sets(id) ON DELETE CASCADE
    )
  `);

  // Create indexes for better query performance
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_interaction_images_interaction_id
    ON interaction_images(interaction_id)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_interaction_images_image_id
    ON interaction_images(image_id)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_flashcard_sets_llm_interaction_id
    ON flashcard_sets(llm_interaction_id)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_flashcards_set_id
    ON flashcards(set_id)
  `);
}

// Initialize the database on import
initDb();

export default db;
