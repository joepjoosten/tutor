# Quick Start Guide

## Prerequisites

Make sure you have:
- Node.js 18+ installed
- An OpenRouter API key (sign up at https://openrouter.ai/)

## Setup (5 minutes)

### 1. Set up your API key

Create a `.env` file in the root directory:

```bash
echo "OPENROUTER_API_KEY=your_api_key_here" > .env
```

Replace `your_api_key_here` with your actual OpenRouter API key.

### 2. Start the development server

```bash
npm run dev
```

The app will open at http://localhost:3000

## Using the App

### Create Flashcards

1. Go to http://localhost:3000
2. Click to upload images or take photos
   - **Mobile**: Opens camera to take photos directly
   - **Desktop**: Select image files
   - Multiple images can be selected at once
   - Large images are automatically compressed to ~1MB
3. Add more images if needed by clicking upload again
4. Review your uploaded images and remove any mistakes (hover and click X)
5. Select an AI model (Gemini Flash 1.5 is recommended for speed)
6. (Optional) Add custom instructions:
   - "Focus on vocabulary definitions"
   - "Include step-by-step solutions for math problems"
   - "Make questions suitable for a 5th grader"
7. Click "Generate Flashcards from X Image(s)"
8. Wait 10-30 seconds for the AI to analyze and create flashcards
9. Review your flashcards!

### Study Flashcards

1. Click "My Flashcards" in the navigation
2. Click "Study" on any flashcard set
3. Click the card to flip between question and answer
4. Use the navigation buttons to move between cards

### Tips

- **Model Selection**:
  - Gemini Flash 1.5: Fast and affordable, great for most homework
  - Claude 3.5 Sonnet: Better for complex material, slower
  - GPT-4 Omni Mini: Good balance of speed and quality

- **Best Images**:
  - Clear, well-lit photos
  - Text should be readable
  - Multiple pages? Upload them all at once!
  - The AI will combine content from all images into one cohesive flashcard set

- **Cost**:
  - Each generation costs a few cents depending on the model
  - Check OpenRouter pricing for exact rates
  - Gemini Flash 1.5 is the most economical

## Troubleshooting

### "OpenRouter API key not configured"
- Make sure your `.env` file exists and has the correct key
- Restart the dev server after creating `.env`

### "Failed to upload file"
- Check that `public/uploads/` directory exists
- Make sure the file is an image (JPG, PNG, etc.)

### Build issues
```bash
# Clear cache and rebuild
rm -rf .next
npm run build
```

### Database issues
```bash
# Reset the database
rm -rf data/
# Restart the app - it will recreate the database
npm run dev
```

## Production Deployment

To run in production:

```bash
npm run build
npm start
```

The app will run on http://localhost:3000

For deployment to a server, make sure to:
1. Set the `OPENROUTER_API_KEY` environment variable
2. Create the `data/` and `public/uploads/` directories
3. Run `npm run build` before starting

## Need Help?

- Check the main README.md for full documentation
- Visit OpenRouter docs: https://openrouter.ai/docs
- Check Next.js docs: https://nextjs.org/docs

Enjoy studying with AI-powered flashcards!
