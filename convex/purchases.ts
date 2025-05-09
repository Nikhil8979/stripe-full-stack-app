import { v } from "convex/values";
import { mutation } from "./_generated/server";

export const createPurchase = mutation({
  args: {
    price: v.number(),
    courseId: v.id("courses"),
    userId: v.id("users"),
    stripePurchaseId: v.string(),
  },
  handler: async (ctx, args) => {
    const { price, courseId, userId, stripePurchaseId } = args;
    const existingPurchase = await ctx.db
      .query("purchases")
      .withIndex("by_userId_courseId", (q) =>
        q.eq("userId", userId).eq("courseId", courseId)
      )
      .unique();
    if (existingPurchase) {
      return existingPurchase._id;
    }
    const purchaseId = await ctx.db.insert("purchases", {
      price: price,
      courseId: courseId,
      userId: userId,
      stripePurchaseId: stripePurchaseId,
      purchaseDate: Date.now(),
    });
    return purchaseId;
  },
});
