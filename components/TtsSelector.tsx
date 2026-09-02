'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';

interface TtsSelectorProps {
  /** Stored model, or null to show the default. */
  model: string | null;
  /** Stored voice, or null. */
  voice: string | null;
  disabled?: boolean;
}

interface SpeechModel {
  id: string;
  name: string;
  voices: string[];
  /** Prices per token as decimal strings, from OpenRouter. */
  inputPrice: string | null;
  outputPrice: string | null;
}

interface OpenRouterSpeechModel {
  id: string;
  name?: string;
  supported_voices?: string[];
  pricing?: { prompt?: string; completion?: string };
}

interface CachedPayload {
  expiresAt: number;
  models: SpeechModel[];
}

// Keep in sync with DEFAULT_TTS_MODEL / DEFAULT_TTS_VOICE in convex/audio.ts.
const DEFAULT_MODEL = 'google/gemini-3.1-flash-tts-preview';
const DEFAULT_VOICE = 'Kore';
const CACHE_KEY = 'openrouter-speech-models-v2';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function perMillion(price: string | null) {
  const value = Number(price);
  if (!price || Number.isNaN(value)) return null;
  return value * 1_000_000;
}

/** Mirrors the OpenRouter models page: input and output price per million tokens. */
function formatPrice(model: SpeechModel) {
  const input = perMillion(model.inputPrice);
  const output = perMillion(model.outputPrice);
  if (input === null && output === null) return null;
  if ((input ?? 0) === 0 && (output ?? 0) === 0) return 'free';
  const money = (value: number) => `$${value < 1 ? value.toFixed(2) : value.toFixed(0)}`;
  const parts = [
    input !== null && input > 0 ? `in ${money(input)}` : null,
    output !== null && output > 0 ? `out ${money(output)}` : null,
  ].filter((part): part is string => part !== null);
  return `${parts.join(', ')} / M`;
}

function readCache(): SpeechModel[] | null {
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw) as CachedPayload;
    if (!Array.isArray(cached.models) || cached.expiresAt <= Date.now()) {
      window.localStorage.removeItem(CACHE_KEY);
      return null;
    }
    return cached.models;
  } catch {
    return null;
  }
}

function writeCache(models: SpeechModel[]) {
  try {
    const payload: CachedPayload = { expiresAt: Date.now() + CACHE_TTL_MS, models };
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch {
    /* storage may be unavailable */
  }
}

export default function TtsSelector({ model, voice, disabled }: TtsSelectorProps) {
  const setTtsSettings = useMutation(api.settings.setTtsSettings);
  const [models, setModels] = useState<SpeechModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      const cached = readCache();
      if (cached && cached.length > 0) {
        setModels(cached);
        setLoading(false);
        return;
      }
      try {
        const response = await fetch(
          'https://openrouter.ai/api/v1/models?output_modalities=speech',
          { signal: controller.signal }
        );
        if (!response.ok) {
          throw new Error('OpenRouter speech model list request failed.');
        }
        const payload = (await response.json()) as { data?: OpenRouterSpeechModel[] };
        const next = (payload.data ?? [])
          .map((entry) => ({
            id: entry.id,
            name: entry.name?.trim() || entry.id,
            voices: entry.supported_voices ?? [],
            inputPrice: entry.pricing?.prompt ?? null,
            outputPrice: entry.pricing?.completion ?? null,
          }))
          .sort((left, right) => left.name.localeCompare(right.name));
        if (next.length === 0) {
          throw new Error('No speech models are currently available.');
        }
        setModels(next);
        writeCache(next);
      } catch (caughtError) {
        if (controller.signal.aborted) return;
        setError(
          caughtError instanceof Error ? caughtError.message : 'Unable to load speech models.'
        );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void load();
    return () => controller.abort();
  }, []);

  const selectedModelId = model ?? DEFAULT_MODEL;
  const selectedModel = useMemo(
    () => models.find((entry) => entry.id === selectedModelId) ?? null,
    [models, selectedModelId]
  );
  const selectedVoice = model ? voice ?? '' : DEFAULT_VOICE;

  const save = async (nextModel: string, nextVoice: string | undefined) => {
    setMessage(null);
    try {
      await setTtsSettings({ model: nextModel, voice: nextVoice });
      setMessage('Voice saved.');
    } catch (caughtError) {
      setMessage(caughtError instanceof Error ? caughtError.message : 'Failed to save voice.');
    }
  };

  const handleModelChange = (nextModelId: string) => {
    const nextModel = models.find((entry) => entry.id === nextModelId);
    if (!nextModel) return;
    const keepVoice = nextModel.voices.includes(selectedVoice) ? selectedVoice : nextModel.voices[0];
    void save(nextModel.id, keepVoice);
  };

  const handleVoiceChange = (nextVoice: string) => {
    void save(selectedModelId, nextVoice);
  };

  const selectClass =
    'w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed';

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2">Speech model</label>
        <select
          value={selectedModelId}
          onChange={(event) => handleModelChange(event.target.value)}
          disabled={disabled || loading || models.length === 0}
          className={selectClass}
        >
          {loading ? (
            <option value={selectedModelId}>Loading speech models...</option>
          ) : models.length > 0 ? (
            <>
              {!selectedModel && <option value={selectedModelId}>{selectedModelId}</option>}
              {models.map((entry) => {
                const price = formatPrice(entry);
                return (
                  <option key={entry.id} value={entry.id}>
                    {entry.name}
                    {price ? ` (${price})` : ''}
                  </option>
                );
              })}
            </>
          ) : (
            <option value={selectedModelId}>No speech models available</option>
          )}
        </select>
      </div>

      {selectedModel && selectedModel.voices.length > 0 && (
        <div>
          <label className="block text-sm font-medium mb-2">Voice</label>
          <select
            value={selectedVoice}
            onChange={(event) => handleVoiceChange(event.target.value)}
            disabled={disabled}
            className={selectClass}
          >
            {!selectedModel.voices.includes(selectedVoice) && (
              <option value={selectedVoice}>{selectedVoice || 'Choose a voice'}</option>
            )}
            {selectedModel.voices.map((entry) => (
              <option key={entry} value={entry}>
                {entry}
              </option>
            ))}
          </select>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Some voices are tied to one language; check the voice name.
          </p>
        </div>
      )}

      {selectedModel && selectedModel.voices.length === 0 && !loading && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          This model uses its own default voice.
        </p>
      )}

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {message && <p className="text-sm text-gray-600 dark:text-gray-300">{message}</p>}
    </div>
  );
}
