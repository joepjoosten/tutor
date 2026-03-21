import { mutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { requireUser } from "./lib";

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);
    return ctx.storage.generateUploadUrl();
  },
});

export const saveUploadedImage = mutation({
  args: {
    storageId: v.id("_storage"),
    filename: v.string(),
    mimeType: v.string(),
    size: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const imageId = await ctx.db.insert("images", {
      userId,
      filename: args.filename,
      mimeType: args.mimeType,
      size: args.size,
      storageId: args.storageId,
      createdAt: Date.now(),
    });

    const image = await ctx.db.get(imageId);
    if (!image) {
      throw new Error("Uploaded image could not be saved.");
    }
    const url = await ctx.storage.getUrl(args.storageId);

    return {
      ...image,
      url,
    };
  },
});

export const deleteImage = mutation({
  args: {
    imageId: v.id("images"),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const image = await ctx.db.get(args.imageId);

    if (!image || image.userId !== userId) {
      return;
    }

    await ctx.storage.delete(image.storageId);
    await ctx.db.delete(args.imageId);
  },
});

export const getImagesForGeneration = internalQuery({
  args: {
    userId: v.string(),
    imageIds: v.array(v.id("images")),
  },
  handler: async (ctx, args) => {
    const images = await Promise.all(args.imageIds.map((imageId) => ctx.db.get(imageId)));
    return images.map((image, index) => {
      if (!image || image.userId !== args.userId) {
        throw new Error(`Image not found: ${String(args.imageIds[index])}`);
      }
      return image;
    });
  },
});
