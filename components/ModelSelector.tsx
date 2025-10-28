'use client';

interface ModelSelectorProps {
  value: string;
  onChange: (model: string) => void;
  disabled?: boolean;
}

const MODELS = [
  {
    id: 'google/gemini-flash-1.5',
    name: 'Gemini Flash 1.5',
    description: 'Fast, good for most tasks',
  },
  {
    id: 'google/gemini-pro-1.5',
    name: 'Gemini Pro 1.5',
    description: 'More capable, slower',
  },
  {
    id: 'anthropic/claude-3.5-sonnet',
    name: 'Claude 3.5 Sonnet',
    description: 'Excellent reasoning',
  },
  {
    id: 'anthropic/claude-3-haiku',
    name: 'Claude 3 Haiku',
    description: 'Fast and affordable',
  },
  {
    id: 'openai/gpt-4o',
    name: 'GPT-4 Omni',
    description: 'OpenAI flagship model',
  },
  {
    id: 'openai/gpt-4o-mini',
    name: 'GPT-4 Omni Mini',
    description: 'Fast and cost-effective',
  },
];

export default function ModelSelector({ value, onChange, disabled }: ModelSelectorProps) {
  return (
    <div className="w-full">
      <label className="block text-sm font-medium mb-2">
        Select AI Model
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {MODELS.map((model) => (
          <option key={model.id} value={model.id}>
            {model.name} - {model.description}
          </option>
        ))}
      </select>
      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
        Different models have different capabilities and costs
      </p>
    </div>
  );
}
