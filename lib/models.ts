import db from './db';

export interface Image {
  id: number;
  filename: string;
  filepath: string;
  mime_type: string;
  size: number;
  created_at: string;
}

export interface LLMInteraction {
  id: number;
  image_id: number;
  model: string;
  prompt: string;
  response: string;
  tokens_used: number | null;
  cost: number | null;
  created_at: string;
}

export interface FlashcardSet {
  id: number;
  title: string;
  description: string | null;
  llm_interaction_id: number;
  created_at: string;
}

export interface Flashcard {
  id: number;
  set_id: number;
  question: string;
  answer: string;
  order_index: number;
  created_at: string;
}

// Image operations
export const ImageModel = {
  create: (data: {
    filename: string;
    filepath: string;
    mime_type: string;
    size: number;
  }): Image => {
    const stmt = db.prepare(`
      INSERT INTO images (filename, filepath, mime_type, size)
      VALUES (?, ?, ?, ?)
    `);
    const result = stmt.run(data.filename, data.filepath, data.mime_type, data.size);
    return ImageModel.findById(result.lastInsertRowid as number)!;
  },

  findById: (id: number): Image | undefined => {
    const stmt = db.prepare('SELECT * FROM images WHERE id = ?');
    return stmt.get(id) as Image | undefined;
  },

  findAll: (): Image[] => {
    const stmt = db.prepare('SELECT * FROM images ORDER BY created_at DESC');
    return stmt.all() as Image[];
  },
};

// LLM Interaction operations
export const LLMInteractionModel = {
  create: (data: {
    image_id: number;
    model: string;
    prompt: string;
    response: string;
    tokens_used?: number;
    cost?: number;
  }): LLMInteraction => {
    const stmt = db.prepare(`
      INSERT INTO llm_interactions (image_id, model, prompt, response, tokens_used, cost)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      data.image_id,
      data.model,
      data.prompt,
      data.response,
      data.tokens_used ?? null,
      data.cost ?? null
    );
    return LLMInteractionModel.findById(result.lastInsertRowid as number)!;
  },

  findById: (id: number): LLMInteraction | undefined => {
    const stmt = db.prepare('SELECT * FROM llm_interactions WHERE id = ?');
    return stmt.get(id) as LLMInteraction | undefined;
  },

  findByImageId: (imageId: number): LLMInteraction[] => {
    const stmt = db.prepare('SELECT * FROM llm_interactions WHERE image_id = ? ORDER BY created_at DESC');
    return stmt.all(imageId) as LLMInteraction[];
  },
};

// Flashcard Set operations
export const FlashcardSetModel = {
  create: (data: {
    title: string;
    description?: string;
    llm_interaction_id: number;
  }): FlashcardSet => {
    const stmt = db.prepare(`
      INSERT INTO flashcard_sets (title, description, llm_interaction_id)
      VALUES (?, ?, ?)
    `);
    const result = stmt.run(data.title, data.description ?? null, data.llm_interaction_id);
    return FlashcardSetModel.findById(result.lastInsertRowid as number)!;
  },

  findById: (id: number): FlashcardSet | undefined => {
    const stmt = db.prepare('SELECT * FROM flashcard_sets WHERE id = ?');
    return stmt.get(id) as FlashcardSet | undefined;
  },

  findAll: (): FlashcardSet[] => {
    const stmt = db.prepare('SELECT * FROM flashcard_sets ORDER BY created_at DESC');
    return stmt.all() as FlashcardSet[];
  },

  delete: (id: number): void => {
    const stmt = db.prepare('DELETE FROM flashcard_sets WHERE id = ?');
    stmt.run(id);
  },
};

// Flashcard operations
export const FlashcardModel = {
  create: (data: {
    set_id: number;
    question: string;
    answer: string;
    order_index: number;
  }): Flashcard => {
    const stmt = db.prepare(`
      INSERT INTO flashcards (set_id, question, answer, order_index)
      VALUES (?, ?, ?, ?)
    `);
    const result = stmt.run(data.set_id, data.question, data.answer, data.order_index);
    return FlashcardModel.findById(result.lastInsertRowid as number)!;
  },

  findById: (id: number): Flashcard | undefined => {
    const stmt = db.prepare('SELECT * FROM flashcards WHERE id = ?');
    return stmt.get(id) as Flashcard | undefined;
  },

  findBySetId: (setId: number): Flashcard[] => {
    const stmt = db.prepare('SELECT * FROM flashcards WHERE set_id = ? ORDER BY order_index');
    return stmt.all(setId) as Flashcard[];
  },

  bulkCreate: (flashcards: {
    set_id: number;
    question: string;
    answer: string;
    order_index: number;
  }[]): void => {
    const stmt = db.prepare(`
      INSERT INTO flashcards (set_id, question, answer, order_index)
      VALUES (?, ?, ?, ?)
    `);

    const transaction = db.transaction((cards) => {
      for (const card of cards) {
        stmt.run(card.set_id, card.question, card.answer, card.order_index);
      }
    });

    transaction(flashcards);
  },
};
