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
  model: string;
  prompt: string;
  response: string;
  tokens_used: number | null;
  cost: number | null;
  custom_instructions: string | null;
  created_at: string;
}

export interface InteractionImage {
  id: number;
  interaction_id: number;
  image_id: number;
  order_index: number;
}

export interface FlashcardSet {
  id: number;
  title: string;
  description: string | null;
  llm_interaction_id: number;
  flip_mode: number;
  created_at: string;
}

export interface StudyProgress {
  id: number;
  set_id: number;
  flashcard_id: number;
  dont_know: number;
  marked_at: string;
}

export interface Flashcard {
  id: number;
  set_id: number;
  question: string;
  answer: string;
  order_index: number;
  created_at: string;
  deleted_at: string | null;
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
    model: string;
    prompt: string;
    response: string;
    image_ids: number[];
    tokens_used?: number;
    cost?: number;
    custom_instructions?: string;
  }): LLMInteraction => {
    const interactionStmt = db.prepare(`
      INSERT INTO llm_interactions (model, prompt, response, tokens_used, cost, custom_instructions)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const linkStmt = db.prepare(`
      INSERT INTO interaction_images (interaction_id, image_id, order_index)
      VALUES (?, ?, ?)
    `);

    // Use transaction to ensure both interaction and links are created together
    const transaction = db.transaction(() => {
      const result = interactionStmt.run(
        data.model,
        data.prompt,
        data.response,
        data.tokens_used ?? null,
        data.cost ?? null,
        data.custom_instructions ?? null
      );

      const interactionId = result.lastInsertRowid as number;

      // Link all images to this interaction
      data.image_ids.forEach((imageId, index) => {
        linkStmt.run(interactionId, imageId, index);
      });

      return interactionId;
    });

    const interactionId = transaction();
    return LLMInteractionModel.findById(interactionId)!;
  },

  findById: (id: number): LLMInteraction | undefined => {
    const stmt = db.prepare('SELECT * FROM llm_interactions WHERE id = ?');
    return stmt.get(id) as LLMInteraction | undefined;
  },

  findByImageId: (imageId: number): LLMInteraction[] => {
    const stmt = db.prepare(`
      SELECT DISTINCT llm_interactions.*
      FROM llm_interactions
      JOIN interaction_images ON llm_interactions.id = interaction_images.interaction_id
      WHERE interaction_images.image_id = ?
      ORDER BY llm_interactions.created_at DESC
    `);
    return stmt.all(imageId) as LLMInteraction[];
  },

  getImages: (interactionId: number): Image[] => {
    const stmt = db.prepare(`
      SELECT images.*
      FROM images
      JOIN interaction_images ON images.id = interaction_images.image_id
      WHERE interaction_images.interaction_id = ?
      ORDER BY interaction_images.order_index
    `);
    return stmt.all(interactionId) as Image[];
  },

  getRecentCustomInstructions: (limit: number = 3): string[] => {
    const stmt = db.prepare(`
      SELECT DISTINCT custom_instructions
      FROM llm_interactions
      WHERE custom_instructions IS NOT NULL AND custom_instructions != ''
      ORDER BY created_at DESC
      LIMIT ?
    `);
    const results = stmt.all(limit) as { custom_instructions: string }[];
    return results.map(r => r.custom_instructions);
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

  update: (id: number, data: { title?: string; description?: string; flip_mode?: number }): FlashcardSet | undefined => {
    const updates: string[] = [];
    const values: (string | number | null)[] = [];

    if (data.title !== undefined) {
      updates.push('title = ?');
      values.push(data.title);
    }
    if (data.description !== undefined) {
      updates.push('description = ?');
      values.push(data.description ?? null);
    }
    if (data.flip_mode !== undefined) {
      updates.push('flip_mode = ?');
      values.push(data.flip_mode);
    }

    if (updates.length === 0) return FlashcardSetModel.findById(id);

    values.push(id);
    const stmt = db.prepare(`
      UPDATE flashcard_sets
      SET ${updates.join(', ')}
      WHERE id = ?
    `);
    stmt.run(...values);
    return FlashcardSetModel.findById(id);
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
    const stmt = db.prepare('SELECT * FROM flashcards WHERE set_id = ? AND deleted_at IS NULL ORDER BY order_index');
    return stmt.all(setId) as Flashcard[];
  },

  update: (id: number, data: { question: string; answer: string }): Flashcard | undefined => {
    const stmt = db.prepare(`
      UPDATE flashcards
      SET question = ?, answer = ?
      WHERE id = ?
    `);
    stmt.run(data.question, data.answer, id);
    return FlashcardModel.findById(id);
  },

  delete: (id: number): void => {
    const stmt = db.prepare(`
      UPDATE flashcards
      SET deleted_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    stmt.run(id);
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

// Study Progress operations
export const StudyProgressModel = {
  findBySetId: (setId: number): StudyProgress[] => {
    const stmt = db.prepare('SELECT * FROM study_progress WHERE set_id = ?');
    return stmt.all(setId) as StudyProgress[];
  },

  markDontKnow: (setId: number, flashcardId: number, dontKnow: boolean): StudyProgress => {
    const stmt = db.prepare(`
      INSERT INTO study_progress (set_id, flashcard_id, dont_know, marked_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(set_id, flashcard_id) DO UPDATE SET
        dont_know = excluded.dont_know,
        marked_at = CURRENT_TIMESTAMP
    `);
    stmt.run(setId, flashcardId, dontKnow ? 1 : 0);

    const getStmt = db.prepare('SELECT * FROM study_progress WHERE set_id = ? AND flashcard_id = ?');
    return getStmt.get(setId, flashcardId) as StudyProgress;
  },

  resetProgress: (setId: number): void => {
    const stmt = db.prepare('DELETE FROM study_progress WHERE set_id = ?');
    stmt.run(setId);
  },
};
