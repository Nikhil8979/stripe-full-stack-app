import { ConvexError, v } from "convex/values";
import stripe from "../src/lib/stripe";
import { api } from "./_generated/api";
import { action } from "./_generated/server";

export const createCheckoutSession = action({
  args: {
    courseId: v.id("courses"),
  },
  handler: async (ctx, args): Promise<{ checkoutUrl: string | null }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    const user = await ctx.runQuery(api.user.getUserByClerkId, {
      clerkId: identity.subject,
    });
    if (!user) {
      throw new Error("User not found");
    }
    // todo: rate limiting
    const course = await ctx.runQuery(api.courses.getCourseById, {
      courseId: args.courseId,
    });
    if (!course) {
      throw new ConvexError("Course not found");
    }
    const session = await stripe.checkout.sessions.create({
      customer: user.stripeCustomerId,
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: course.title,
              images: [course.imageUrl],
            },
            unit_amount: Math.round(course.price * 100),
          },
          quantity: 1,
        },
      ],

      mode: "payment",
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/courses/${args.courseId}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/courses`,
      metadata: {
        courseId: course._id,
        userId: user._id,
      },
    });
    return { checkoutUrl: session.url };
  },
});
export const createProPlanCheckoutSession = action({
  args: {
    planId: v.union(v.literal("month"), v.literal("year")),
  },
  handler: async (ctx, args): Promise<{ checkoutUrl: string | null }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Not authenticated");
    }
    const user = await ctx.runQuery(api.user.getUserByClerkId, {
      clerkId: identity.subject,
    });
    if (!user) {
      throw new ConvexError("User not found");
    }

    let priceId;
    if (args.planId === "month") {
      priceId = process.env.STRIPE_MONTHLY_PRICE_ID;
    } else if (args.planId === "year") {
      priceId = process.env.STRIPE_YEARLY_PRICE_ID;
    }

    if (!priceId) {
      throw new ConvexError("PriceId not provided");
    }

    const session = await stripe.checkout.sessions.create({
      customer: user.stripeCustomerId,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/pro/success?session_id={CHECKOUT_SESSION_ID}&year=${args.planId === "year"}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pro`,

      metadata: { userId: user._id, planId: args.planId },
    });

    return { checkoutUrl: session.url };
  },
});
