"use client";

import { useUser } from "@clerk/nextjs";
import { Id } from "../../convex/_generated/dataModel";
import { useAction, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Button } from "./ui/button";
import { Loader2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const PurchaseButton = ({ courseId }: { courseId: Id<"courses"> }) => {
  const { user } = useUser();
  const [isLoading, setIsLoading] = useState(false);
  const userData = useQuery(api.user.getUserByClerkId, {
    clerkId: user?.id || "",
  });
  const userAccess = useQuery(
    api.user.getUserAccess,
    userData
      ? {
          courseId: courseId,
          userId: userData?._id,
        }
      : "skip"
  ) || { hasAccess: false, accessType: "none" };
  const createCheckoutSession = useAction(api.stripe.createCheckoutSession);
  const handlePurchase = async () => {
    if (!user) {
      return toast.error("Please log in to purchase this course");
    }
    try {
      setIsLoading(true);
      const { checkoutUrl } = await createCheckoutSession({
        courseId: courseId,
      });

      if (checkoutUrl) {
        window.location.href = checkoutUrl;
      } else {
        toast.error("Something went wrong. Please try again later.");
      }
    } catch (e: any) {
      setIsLoading(false);
      toast.error(e.message || "Something went wrong. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  };
  if (!userAccess.hasAccess) {
    return (
      <Button variant={"outline"} onClick={handlePurchase} disabled={isLoading}>
        Enroll Now
      </Button>
    );
  }

  if (userAccess.hasAccess) {
    return <Button variant={"outline"}>Enrolled</Button>;
  }
  if (isLoading) {
    return (
      <Button>
        <Loader2Icon className="mr-2 size-4 animate-spin" />
        Processing...
      </Button>
    );
  }
};
export default PurchaseButton;
