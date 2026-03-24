import { beforeEach, describe, expect, it, vi } from "vitest";

import { handlerOf } from "./testHelpers";

const { mockRequireUser } = vi.hoisted(() => ({
  mockRequireUser: vi.fn(),
}));

vi.mock("./lib", () => ({
  requireUser: mockRequireUser,
}));

import {
  deleteImage,
  generateUploadUrl,
  getImagesForGeneration,
  saveUploadedImage,
} from "./images";

function createImagesCtx(options?: {
  getById?: Record<string, unknown>;
  uploadUrl?: string;
  imageUrl?: string | null;
}) {
  const get = vi.fn(async (id: string) => options?.getById?.[id] ?? null);
  const insert = vi.fn().mockResolvedValue("image-1");
  const del = vi.fn().mockResolvedValue(undefined);
  const generateUploadUrlMock = vi
    .fn()
    .mockResolvedValue(options?.uploadUrl ?? "https://convex/upload");
  const getUrl = vi
    .fn()
    .mockResolvedValue(options?.imageUrl ?? "https://convex/image-1");
  const storageDelete = vi.fn().mockResolvedValue(undefined);

  return {
    ctx: {
      auth: {},
      db: {
        get,
        insert,
        delete: del,
      },
      storage: {
        generateUploadUrl: generateUploadUrlMock,
        getUrl,
        delete: storageDelete,
      },
    },
    get,
    insert,
    delete: del,
    generateUploadUrl: generateUploadUrlMock,
    getUrl,
    storageDelete,
  };
}

describe("images", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
    mockRequireUser.mockResolvedValue("user-123");
  });

  it("returns a Convex upload URL for authenticated users", async () => {
    const { ctx, generateUploadUrl: generateUploadUrlMock } = createImagesCtx();

    await expect(handlerOf(generateUploadUrl)(ctx as never, {} as never)).resolves.toBe(
      "https://convex/upload"
    );

    expect(mockRequireUser).toHaveBeenCalledWith(ctx);
    expect(generateUploadUrlMock).toHaveBeenCalled();
  });

  it("saves uploaded image metadata and returns the stored image with its URL", async () => {
    const storedImage = {
      _id: "image-1",
      userId: "user-123",
      filename: "page-1.png",
      mimeType: "image/png",
      size: 123,
      storageId: "storage-1",
      createdAt: 1_700_000_000_000,
    };
    const { ctx, insert, get, getUrl } = createImagesCtx({
      getById: {
        "image-1": storedImage,
      },
    });

    await expect(
      handlerOf(saveUploadedImage)(ctx as never, {
        storageId: "storage-1" as never,
        filename: "page-1.png",
        mimeType: "image/png",
        size: 123,
      })
    ).resolves.toEqual({
      ...storedImage,
      url: "https://convex/image-1",
    });

    expect(insert).toHaveBeenCalledWith("images", {
      userId: "user-123",
      filename: "page-1.png",
      mimeType: "image/png",
      size: 123,
      storageId: "storage-1",
      createdAt: 1_700_000_000_000,
    });
    expect(get).toHaveBeenCalledWith("image-1");
    expect(getUrl).toHaveBeenCalledWith("storage-1");
  });

  it("throws if the uploaded image document cannot be read back", async () => {
    const { ctx } = createImagesCtx();

    await expect(
      handlerOf(saveUploadedImage)(ctx as never, {
        storageId: "storage-1" as never,
        filename: "page-1.png",
        mimeType: "image/png",
        size: 123,
      })
    ).rejects.toThrow("Uploaded image could not be saved.");
  });

  it("deletes owned images from storage and the database", async () => {
    const { ctx, storageDelete, delete: deleteDoc } = createImagesCtx({
      getById: {
        "image-1": {
          _id: "image-1",
          userId: "user-123",
          storageId: "storage-1",
        },
      },
    });

    await handlerOf(deleteImage)(ctx as never, { imageId: "image-1" as never });

    expect(storageDelete).toHaveBeenCalledWith("storage-1");
    expect(deleteDoc).toHaveBeenCalledWith("image-1");
  });

  it("does nothing when deleting an image the user does not own", async () => {
    const { ctx, storageDelete, delete: deleteDoc } = createImagesCtx({
      getById: {
        "image-1": {
          _id: "image-1",
          userId: "other-user",
          storageId: "storage-1",
        },
      },
    });

    await handlerOf(deleteImage)(ctx as never, { imageId: "image-1" as never });

    expect(storageDelete).not.toHaveBeenCalled();
    expect(deleteDoc).not.toHaveBeenCalled();
  });

  it("returns images for generation in the requested order", async () => {
    const image1 = { _id: "image-1", userId: "user-123" };
    const image2 = { _id: "image-2", userId: "user-123" };
    const ctx = {
      db: {
        get: vi.fn(async (id: string) =>
          id === "image-1" ? image1 : id === "image-2" ? image2 : null
        ),
      },
    };

    await expect(
      handlerOf(getImagesForGeneration)(ctx as never, {
        userId: "user-123",
        imageIds: ["image-2", "image-1"] as never,
      })
    ).resolves.toEqual([image2, image1]);
  });

  it("throws when any requested generation image is missing or owned by another user", async () => {
    const ctx = {
      db: {
        get: vi.fn(async (id: string) =>
          id === "image-1" ? { _id: "image-1", userId: "other-user" } : null
        ),
      },
    };

    await expect(
      handlerOf(getImagesForGeneration)(ctx as never, {
        userId: "user-123",
        imageIds: ["image-1", "image-2"] as never,
      })
    ).rejects.toThrow("Image not found: image-1");
  });
});
