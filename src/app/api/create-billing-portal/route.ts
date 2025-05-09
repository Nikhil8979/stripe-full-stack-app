import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { NextResponse } from "next/server";
import { api } from "../../../../convex/_generated/api";
import stripe from "@/lib/stripe";
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }
  try {
    const user = await convex.query(api.user.getUserByClerkId, {
      clerkId: userId,
    });
    if (!user || !user?.stripeCustomerId) {
      return NextResponse.json({
        error: "User not found or missing stripeCustomerId",
        status: 400,
      });
    }
    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing`,
    });
    return NextResponse.json({ url: session.url });
  } catch (e) {
    console.log(e);
    return new Response("Failed to create billing portal", { status: 400 });
  }
  return new Response("OK", { status: 200 });
}
