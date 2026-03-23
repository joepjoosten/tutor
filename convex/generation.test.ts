import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockRequireUser, mockDecryptSecret, mockBlobToBase64 } = vi.hoisted(
  () => ({
    mockRequireUser: vi.fn(),
    mockDecryptSecret: vi.fn(),
    mockBlobToBase64: vi.fn(),
  })
);

vi.mock("./lib", () => ({
  requireUser: mockRequireUser,
  decryptSecret: mockDecryptSecret,
  blobToBase64: mockBlobToBase64,
}));

import { generateFlashcards } from "./generation";

type ImageRecord = {
  _id: string;
  filename: string;
  mimeType: string;
  size: number;
  storageId: string;
  userId: string;
  createdAt: number;
};

function createActionCtx(options?: {
  encryptedKey?: string | null;
  images?: ImageRecord[];
  storageBlob?: Blob | null;
  mutationResult?: unknown;
}) {
  const runQuery = vi.fn();
  runQuery.mockResolvedValueOnce(
    options && "encryptedKey" in options ? options.encryptedKey : "encrypted-key"
  );
  runQuery.mockResolvedValueOnce(
    options && "images" in options ? options.images : []
  );

  const get = vi.fn().mockResolvedValue(
    options?.storageBlob ?? new Blob(["image-bytes"], { type: "image/png" })
  );
  const runMutation = vi
    .fn()
    .mockResolvedValue(options?.mutationResult ?? { ok: true });

  return {
    ctx: {
      auth: {},
      runQuery,
      runMutation,
      storage: {
        get,
      },
    },
    runQuery,
    runMutation,
    get,
  };
}

describe("generation:generateFlashcards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    mockRequireUser.mockResolvedValue("user-123");
    mockDecryptSecret.mockResolvedValue("openrouter-key");
    mockBlobToBase64.mockResolvedValue("aW1hZ2UtYmFzZTY0");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fails before model execution when the user has no stored OpenRouter key", async () => {
    const { ctx, runQuery, runMutation, get } = createActionCtx({
      encryptedKey: null,
    });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      generateFlashcards._handler(ctx as never, {
        imageIds: ["image-1"] as never,
        model: "openai/gpt-4o-mini",
      })
    ).rejects.toThrow(
      "Add your OpenRouter API key before generating flashcards."
    );

    expect(mockRequireUser).toHaveBeenCalledWith(ctx);
    expect(runQuery).toHaveBeenCalledTimes(1);
    expect(mockDecryptSecret).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(runMutation).not.toHaveBeenCalled();
    expect(get).not.toHaveBeenCalled();
  });

  it("surfaces provider-specific OpenRouter image errors", async () => {
    const images: ImageRecord[] = [
      {
        _id: "image-1",
        filename: "worksheet.png",
        mimeType: "image/png",
        size: 123,
        storageId: "storage-1",
        userId: "user-123",
        createdAt: 1,
      },
    ];
    const { ctx } = createActionCtx({ images });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        error: {
          message: "Provider returned error",
          metadata: {
            provider_name: "Anthropic",
            raw: { message: "image inputs are not supported" },
          },
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      generateFlashcards._handler(ctx as never, {
        imageIds: ["image-1"] as never,
        model: "anthropic/claude-3.5-sonnet",
      })
    ).rejects.toThrow(
      "Anthropic rejected the image request: image inputs are not supported"
    );
  });

  it("builds the OpenRouter request and persists parsed flashcards on success", async () => {
    vi.stubEnv("SITE_URL", "https://tutor.example");

    const images: ImageRecord[] = [
      {
        _id: "image-1",
        filename: "page-1.png",
        mimeType: "image/png",
        size: 123,
        storageId: "storage-1",
        userId: "user-123",
        createdAt: 1,
      },
      {
        _id: "image-2",
        filename: "page-2.jpeg",
        mimeType: "image/jpeg",
        size: 456,
        storageId: "storage-2",
        userId: "user-123",
        createdAt: 2,
      },
    ];
    const mutationResult = {
      flashcardSet: { _id: "set-1", title: "Biology", flipMode: false, createdAt: 1 },
      flashcards: [{ _id: "card-1", question: "Q1", answer: "A1", orderIndex: 0 }],
    };
    const { ctx, runQuery, runMutation, get } = createActionCtx({
      images,
      mutationResult,
    });

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        usage: { total_tokens: 321 },
        choices: [
          {
            message: {
              content: `Here is the result:
{
  "title": "Biology",
  "description": "Chapter 1",
  "flashcards": [
    {
      "question": "Q1",
      "answer": "A1"
    }
  ]
}`,
            },
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateFlashcards._handler(ctx as never, {
      imageIds: ["image-1", "image-2"] as never,
      model: "openai/gpt-4o-mini",
      customInstructions: "Focus on definitions.",
    });

    expect(result).toBe(mutationResult);
    expect(mockRequireUser).toHaveBeenCalledWith(ctx);
    expect(mockDecryptSecret).toHaveBeenCalledWith("encrypted-key");
    expect(runQuery).toHaveBeenNthCalledWith(1, expect.anything(), {
      userId: "user-123",
    });
    expect(runQuery).toHaveBeenNthCalledWith(2, expect.anything(), {
      userId: "user-123",
      imageIds: ["image-1", "image-2"],
    });
    expect(get).toHaveBeenCalledTimes(2);
    expect(mockBlobToBase64).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(request.method).toBe("POST");
    expect(request.headers).toMatchObject({
      Authorization: "Bearer openrouter-key",
      "Content-Type": "application/json",
      "HTTP-Referer": "https://tutor.example",
      "X-Title": "Tutor App",
    });

    const body = JSON.parse(String(request.body)) as {
      model: string;
      messages: Array<{
        role: string;
        content: Array<
          | { type: "text"; text: string }
          | { type: "image_url"; image_url: { url: string } }
        >;
      }>;
      provider: { require_parameters: boolean };
    };

    expect(body.model).toBe("openai/gpt-4o-mini");
    expect(body.provider).toEqual({ require_parameters: true });
    expect(body.messages).toHaveLength(1);
    expect(body.messages[0].role).toBe("user");
    expect(body.messages[0].content[0]).toEqual(
      expect.objectContaining({
        type: "text",
        text: expect.stringContaining("Please look at ALL 2 images carefully"),
      })
    );
    expect(body.messages[0].content[0]).toEqual(
      expect.objectContaining({
        text: expect.stringContaining(
          "Special Instructions: Focus on definitions."
        ),
      })
    );
    expect(body.messages[0].content[1]).toEqual({
      type: "image_url",
      image_url: {
        url: "data:image/png;base64,aW1hZ2UtYmFzZTY0",
      },
    });
    expect(body.messages[0].content[2]).toEqual({
      type: "image_url",
      image_url: {
        url: "data:image/jpeg;base64,aW1hZ2UtYmFzZTY0",
      },
    });

    expect(runMutation).toHaveBeenCalledWith(expect.anything(), {
      userId: "user-123",
      model: "openai/gpt-4o-mini",
      prompt: expect.stringContaining("Please look at ALL 2 images carefully"),
      response: expect.stringContaining('"title": "Biology"'),
      imageIds: ["image-1", "image-2"],
      tokensUsed: 321,
      customInstructions: "Focus on definitions.",
      title: "Biology",
      description: "Chapter 1",
      flashcards: [{ question: "Q1", answer: "A1" }],
    });
  });
});
