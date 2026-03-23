'use client';

import { useEffect, useMemo, useState } from 'react';

interface ModelSelectorProps {
  value: string;
  onChange: (model: string) => void;
  disabled?: boolean;
}

interface OpenRouterModel {
  id: string;
  name?: string;
  context_length?: number;
  architecture?: {
    input_modalities?: string[];
    output_modalities?: string[];
  };
  top_provider?: {
    context_length?: number;
  };
}

interface OpenRouterModelsResponse {
  data?: OpenRouterModel[];
}

interface ModelOption {
  id: string;
  name: string;
  description: string;
}

interface CachedModelsPayload {
  expiresAt: number;
  models: ModelOption[];
}

const MODEL_CACHE_KEY = 'openrouter-vision-models';
const MODEL_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function formatContextLength(contextLength?: number) {
  if (!contextLength) {
    return 'Vision input';
  }

  if (contextLength >= 1_000_000) {
    return `${(contextLength / 1_000_000).toFixed(1).replace('.0', '')}M context`;
  }

  if (contextLength >= 1_000) {
    return `${Math.round(contextLength / 1_000)}K context`;
  }

  return `${contextLength} context`;
}

function isVisionTextModel(model: OpenRouterModel) {
  const inputModalities = model.architecture?.input_modalities ?? [];
  const outputModalities = model.architecture?.output_modalities ?? [];

  return inputModalities.includes('image') && outputModalities.includes('text');
}

function toModelOption(model: OpenRouterModel): ModelOption {
  return {
    id: model.id,
    name: model.name?.trim() || model.id,
    description: formatContextLength(
      model.top_provider?.context_length ?? model.context_length
    ),
  };
}

export default function ModelSelector({ value, onChange, disabled }: ModelSelectorProps) {
  const [models, setModels] = useState<ModelOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    function readCachedModels() {
      if (typeof window === 'undefined') {
        return null;
      }

      const rawValue = window.localStorage.getItem(MODEL_CACHE_KEY);
      if (!rawValue) {
        return null;
      }

      try {
        const cachedValue = JSON.parse(rawValue) as CachedModelsPayload;
        if (
          !Array.isArray(cachedValue.models) ||
          typeof cachedValue.expiresAt !== 'number'
        ) {
          window.localStorage.removeItem(MODEL_CACHE_KEY);
          return null;
        }

        if (cachedValue.expiresAt <= Date.now()) {
          window.localStorage.removeItem(MODEL_CACHE_KEY);
          return null;
        }

        return cachedValue.models;
      } catch {
        window.localStorage.removeItem(MODEL_CACHE_KEY);
        return null;
      }
    }

    function writeCachedModels(nextModels: ModelOption[]) {
      if (typeof window === 'undefined') {
        return;
      }

      const payload: CachedModelsPayload = {
        expiresAt: Date.now() + MODEL_CACHE_TTL_MS,
        models: nextModels,
      };
      window.localStorage.setItem(MODEL_CACHE_KEY, JSON.stringify(payload));
    }

    async function loadModels() {
      setLoading(true);
      setError(null);

      const cachedModels = readCachedModels();
      if (cachedModels && cachedModels.length > 0) {
        setModels(cachedModels);
        setLoading(false);
        return;
      }

      try {
        const response = await fetch('https://openrouter.ai/api/v1/models', {
          signal: controller.signal,
        });
        const payload = (await response.json()) as OpenRouterModelsResponse;

        if (!response.ok) {
          throw new Error('OpenRouter model list request failed.');
        }

        const nextModels = (payload.data ?? [])
          .filter(isVisionTextModel)
          .map(toModelOption)
          .sort((left, right) => left.name.localeCompare(right.name));

        if (nextModels.length === 0) {
          throw new Error('No compatible image-capable models are currently available.');
        }

        setModels(nextModels);
        writeCachedModels(nextModels);
      } catch (caughtError) {
        if (controller.signal.aborted) {
          return;
        }

        setModels([]);
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : 'Unable to load compatible OpenRouter models.'
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadModels();

    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (models.length === 0) {
      return;
    }

    if (value && models.some((model) => model.id === value)) {
      return;
    }

    onChange(models[0].id);
  }, [models, onChange, value]);

  const selectedModel = useMemo(
    () => models.find((model) => model.id === value) ?? null,
    [models, value]
  );

  return (
    <div className="w-full">
      <label className="block text-sm font-medium mb-2">
        Select AI Model
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled || loading || models.length === 0}
        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <option value="">Loading OpenRouter vision models...</option>
        ) : models.length > 0 ? (
          models.map((model) => (
            <option key={model.id} value={model.id}>
              {model.name}
            </option>
          ))
        ) : (
          <option value="">No compatible models available</option>
        )}
      </select>

      {selectedModel && !loading && !error && (
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          {selectedModel.id} • {selectedModel.description}
        </p>
      )}

      {!selectedModel && !loading && !error && (
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          Models are loaded live from OpenRouter and filtered for image input plus text output.
        </p>
      )}

      {error && (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
