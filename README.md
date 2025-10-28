# Tutor App - AI Homework Flashcard Generator

A Next.js application that helps students study by automatically generating flashcards from homework images using AI vision models.

## Features

- **Multiple Image Upload**: Upload one or more images at once before generating flashcards
- **Custom Instructions**: Add specific guidance for the AI (e.g., "Focus on vocabulary", "Include step-by-step solutions")
- **Manual Submit**: Review uploaded images and instructions before generating
- **AI Analysis**: Uses vision-capable models via OpenRouter to analyze homework content
- **Smart Flashcard Generation**: Automatically creates questions and answers from images
- **Interactive Viewer**: Flip animations and easy navigation between cards
- **Persistent Storage**: Local SQLite database for all flashcard sets
- **Multiple AI Models**: Support for GPT-4, Claude, Gemini, and more
- **No Login Required**: Runs completely locally on your machine

## Tech Stack

- **Framework**: Next.js 15 with TypeScript
- **Styling**: Tailwind CSS
- **Database**: SQLite (better-sqlite3)
- **AI**: OpenRouter API (supports multiple LLM providers)
- **File Handling**: Next.js API routes with FormData

## Setup Instructions

### 1. Prerequisites

- Node.js 18+ installed
- OpenRouter API key (get one at https://openrouter.ai/)

### 2. Installation

```bash
# Dependencies are already installed, but if needed:
npm install
```

### 3. Environment Configuration

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

Edit `.env` and add your OpenRouter API key:

```
OPENROUTER_API_KEY=your_actual_api_key_here
```

### 4. Run the Development Server

```bash
npm run dev
```

The app will be available at http://localhost:3000

## Usage

### Creating Flashcards

1. Go to the home page
2. Click to upload images (you can select multiple at once)
3. Add more images if needed by clicking upload again
4. Review the uploaded images (remove any with the X button)
5. Select an AI model from the dropdown
6. (Optional) Add custom instructions in the textarea
   - Example: "Focus on vocabulary words"
   - Example: "Include step-by-step math solutions"
   - Example: "Make questions appropriate for a 5th grader"
7. Click "Generate Flashcards from X Image(s)"
8. Wait 10-30 seconds for the AI to analyze and create flashcards
9. Review your generated flashcards

### Studying Flashcards

1. Click "My Flashcards" in the navigation
2. Browse your saved flashcard sets
3. Click "Study" on any set
4. Click cards to flip between questions and answers
5. Use Previous/Next buttons or number buttons to navigate

### Managing Sets

- Delete unwanted sets using the trash icon
- Sets are stored locally in SQLite database

## Project Structure

```
tutor/
├── app/
│   ├── api/
│   │   ├── upload/              # Image upload endpoint
│   │   ├── generate-flashcards/ # Flashcard generation endpoint
│   │   └── flashcard-sets/      # CRUD operations for sets
│   ├── flashcards/              # Flashcard management page
│   ├── layout.tsx               # Root layout with navigation
│   ├── page.tsx                 # Home page (upload & generate)
│   └── globals.css              # Global styles
├── components/
│   ├── ImageUpload.tsx          # Image upload component
│   ├── ModelSelector.tsx        # AI model selection
│   └── FlashcardViewer.tsx      # Interactive flashcard display
├── lib/
│   ├── db.ts                    # SQLite database setup
│   └── models.ts                # Database models and operations
├── public/
│   └── uploads/                 # Uploaded images (gitignored)
└── data/
    └── tutor.db                 # SQLite database (gitignored)
```

## Database Schema

### Images
Stores uploaded image files and metadata

### LLM Interactions
Logs all API calls to OpenRouter with prompts and responses

### Flashcard Sets
Groups of related flashcards with title and description

### Flashcards
Individual question/answer pairs

## Available AI Models

The app supports various models through OpenRouter:

- **Gemini Flash 1.5** - Fast and affordable, good for most tasks
- **Gemini Pro 1.5** - More capable for complex materials
- **Claude 3.5 Sonnet** - Excellent reasoning and analysis
- **Claude 3 Haiku** - Fast and cost-effective
- **GPT-4 Omni** - OpenAI's flagship multimodal model
- **GPT-4 Omni Mini** - Faster, more affordable variant

Different models have different costs and capabilities. Choose based on your needs and budget.

## API Endpoints

### POST /api/upload
Upload an image file
- Accepts: FormData with 'file' field
- Returns: Image metadata and ID

### POST /api/generate-flashcards
Generate flashcards from an image
- Body: `{ imageId: number, model: string }`
- Returns: Flashcard set with all cards

### GET /api/flashcard-sets
Get all flashcard sets with their cards

### DELETE /api/flashcard-sets?id={id}
Delete a specific flashcard set

## Development

### Build for Production

```bash
npm run build
npm start
```

### Linting

```bash
npm run lint
```

## Notes

- All data is stored locally in SQLite
- Images are stored in `public/uploads/`
- No authentication/users - single-user app
- Database is automatically created on first run
- Image files are deduplicated using MD5 hashes

## Future Enhancements

Potential features to add:
- Spaced repetition algorithm
- Progress tracking and statistics
- Export flashcards to Anki format
- Support for multiple users
- Bulk image upload
- OCR text extraction
- Audio pronunciation for language learning
- Collaborative studying features

## License

MIT
