export interface SharedStudyProgressPayload {
  version: 1;
  dontKnowCardIds: string[];
  updatedAt: number;
}

export type SharedStudyProgressMap = Record<string, boolean>;

export function getSharedStudyProgressStorageKey(slug: string) {
  return `shared-study-progress:${slug}`;
}

export function parseSharedStudyProgress(
  rawValue: string | null | undefined
): SharedStudyProgressMap {
  if (!rawValue) {
    return {};
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<SharedStudyProgressPayload>;
    if (
      parsed.version !== 1 ||
      !Array.isArray(parsed.dontKnowCardIds) ||
      !parsed.dontKnowCardIds.every((value) => typeof value === "string")
    ) {
      return {};
    }

    return Object.fromEntries(parsed.dontKnowCardIds.map((cardId) => [cardId, true]));
  } catch {
    return {};
  }
}

export function serializeSharedStudyProgress(
  progressMap: SharedStudyProgressMap
) {
  const payload: SharedStudyProgressPayload = {
    version: 1,
    dontKnowCardIds: Object.entries(progressMap)
      .filter(([, shouldReview]) => shouldReview)
      .map(([cardId]) => cardId),
    updatedAt: Date.now(),
  };

  return JSON.stringify(payload);
}
