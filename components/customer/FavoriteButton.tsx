"use client";
import { SignInButton, useUser } from "@clerk/nextjs";
import { Heart } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useWishlist } from "./WishlistProvider";
export function FavoriteButton({
  productId,
  title,
  showLabel = false,
}: {
  productId: string;
  title: string;
  showLabel?: boolean;
}) {
  const { isSignedIn, isLoaded } = useUser();
  const { data, change, loading, busy, error, refresh } = useWishlist();
  const saved = data.savedIds.includes(productId);
  if (!isSignedIn)
    return (
      <SignInButton mode="modal">
        <Button
          disabled={!isLoaded}
          size={showLabel ? "default" : "icon"}
          variant="outline"
          aria-label={`Sign in to save ${title}`}
        >
          <Heart aria-hidden="true" />
          {showLabel && "Sign in to save"}
        </Button>
      </SignInButton>
    );
  if (error)
    return (
      <Button
        size={showLabel ? "default" : "icon"}
        variant="outline"
        onClick={refresh}
        aria-label="Retry loading wishlist"
      >
        <Heart aria-hidden="true" />
        {showLabel && "Retry wishlist"}
      </Button>
    );
  return (
    <Button
      size={showLabel ? "default" : "icon"}
      variant="outline"
      disabled={loading || busy}
      aria-pressed={saved}
      aria-label={`${saved ? "Remove" : "Save"} ${title}${saved ? " from" : " to"} wishlist`}
      onClick={() =>
        void change(productId, saved ? "remove" : "add").catch((error) =>
          toast.error(error.message),
        )
      }
    >
      <Heart
        aria-hidden="true"
        className={saved ? "fill-primary text-primary" : ""}
      />
      {showLabel && (saved ? "Remove from wishlist" : "Save to wishlist")}
    </Button>
  );
}
