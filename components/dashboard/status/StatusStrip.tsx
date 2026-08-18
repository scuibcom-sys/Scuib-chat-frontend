"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useAuthStore } from "@/store/authStore";
import {
  fetchStatusFeed,
  groupStatusesByAuthor,
  sortStatusFeedPinnedFirst,
  type ApiStatusRecord,
} from "@/utils/scuibStatusApi";
import { ApiError, type AuthTokens } from "@/utils/scuibApi";

/**
 * One row per author in the strip: their latest status plus whether any of
 * their statuses are unviewed (drives the solid-vs-dashed ring, matching the
 * WhatsApp-style convention from the Figma reference).
 */
export type StatusStripEntry = {
  authorId: string;
  authorName: string;
  authorAvatarUrl: string | null;
  latestStatus: ApiStatusRecord;
  hasUnviewed: boolean;
  isPinnedAuthor: boolean;
};

type StatusStripProps = {
  /** Called when the user taps their own "My Status" circle. */
  onComposeStatus: () => void;
  /** Called when the user taps someone else's circle, to open the viewer. */
  onOpenStatus: (entry: StatusStripEntry) => void;
  /** Optional — lets the parent re-fetch the strip after a successful post. */
  refreshKey?: number;
  /**
   * Optional — reports the freshly-loaded feed up to the parent, so it can
   * give StatusViewer every status from a tapped author, not just their
   * latest one. Called from inside the async fetch, never synchronously in
   * an effect body.
   */
  onFeedLoaded?: (feed: ApiStatusRecord[]) => void;
};

export function StatusStrip({ onComposeStatus, onOpenStatus, refreshKey, onFeedLoaded }: StatusStripProps) {
  const currentUser = useAuthStore((state) => state.user);
  const accessToken = useAuthStore((state) => state.accessToken);
  const refreshToken = useAuthStore((state) => state.refreshToken);
  const tokenType = useAuthStore((state) => state.tokenType);
  const setTokens = useAuthStore((state) => state.setTokens);

  const [feed, setFeed] = useState<ApiStatusRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // setTokens takes three positional args, not a single AuthTokens object —
  // this adapts the API client's onAuthRefresh callback shape to the store's
  // actual signature (see store/authStore.ts).
  const handleAuthRefresh = useCallback(
    (refreshedTokens: AuthTokens) => {
      setTokens(refreshedTokens.accessToken, refreshedTokens.refreshToken, refreshedTokens.tokenType);
    },
    [setTokens],
  );

  const [hasHydrated, setHasHydrated] = useState(
    () => useAuthStore.persist?.hasHydrated() ?? false,
  );

  useEffect(() => {
    const unsubscribe = useAuthStore.persist?.onFinishHydration(() => {
      setHasHydrated(true);
    });
    return () => unsubscribe?.();
  }, []);

  const loadFeed = useCallback(async () => {
    if (!hasHydrated) {
      // Still waiting for the auth store to finish hydrating from
      // localStorage — stay in loading state (skeletons) rather than
      // bailing out, so onFinishHydration triggers a proper re-fetch
      // instead of the user seeing a false "Request failed" error.
      setIsLoading(true);
      return;
    }

    if (!accessToken) {
      setFeed([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setLoadError(null);

    try {
      const tokens: Partial<AuthTokens> = { accessToken, refreshToken, tokenType };
      const statuses = await fetchStatusFeed(tokens, handleAuthRefresh);
      setFeed(statuses);
      onFeedLoaded?.(statuses);
    } catch (error) {
      setLoadError(
        error instanceof ApiError ? error.message : "Couldn't load statuses right now.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [hasHydrated, accessToken, refreshToken, tokenType, handleAuthRefresh, onFeedLoaded]);

  useEffect(() => {
    loadFeed();
    // refreshKey is an intentional re-fetch trigger from the parent
    // (e.g. after posting a new status), not a value read in the body.
  }, [loadFeed, refreshKey]);

  const { myEntry, otherEntries } = useMemo(() => {
    const grouped = groupStatusesByAuthor(feed);
    const entries: StatusStripEntry[] = [];

    for (const [authorId, statusesForAuthor] of grouped.entries()) {
      const latestStatus = statusesForAuthor[statusesForAuthor.length - 1];
      if (!latestStatus) continue;

      entries.push({
        authorId,
        authorName: latestStatus.authorName ?? "Unknown",
        authorAvatarUrl: latestStatus.authorAvatarUrl,
        latestStatus,
        hasUnviewed: statusesForAuthor.some((status) => !status.viewedByMe),
        isPinnedAuthor: latestStatus.isPinnedAuthor,
      });
    }

    const sorted = sortStatusFeedPinnedFirst(entries.map((entry) => entry.latestStatus));
    const sortedAuthorIds = sorted.map((status) => status.authorId ?? status.id);
    entries.sort((a, b) => sortedAuthorIds.indexOf(a.authorId) - sortedAuthorIds.indexOf(b.authorId));

    const mine = currentUser
      ? entries.find(
          (entry) =>
            entry.authorId === currentUser.id ||
            (currentUser.email && entry.authorId === currentUser.email) ||
            (currentUser.username && entry.authorId === currentUser.username)
        )
      : undefined;
    const others = currentUser
      ? entries.filter(
          (entry) =>
            entry.authorId !== currentUser.id &&
            (!currentUser.email || entry.authorId !== currentUser.email) &&
            (!currentUser.username || entry.authorId !== currentUser.username)
        )
      : entries;

    return { myEntry: mine ?? null, otherEntries: others };
  }, [feed, currentUser]);

  if (loadError) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 text-sm text-red-600">
        <span>{loadError}</span>
        <button type="button" onClick={loadFeed} className="font-semibold underline">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex gap-4 overflow-x-auto px-4 py-3 scrollbar-none">
      <StatusStripItem
        label="My Status"
        avatarUrl={myEntry?.authorAvatarUrl ?? currentUser?.avatarUrl ?? null}
        ringState={myEntry ? "mine-posted" : "mine-empty"}
        onClick={myEntry ? () => onOpenStatus(myEntry) : onComposeStatus}
        showAddBadge={!myEntry}
      />

      {isLoading
        ? Array.from({ length: 4 }).map((_, index) => <StatusStripSkeleton key={index} />)
        : otherEntries.map((entry) => (
            <StatusStripItem
              key={entry.authorId}
              label={entry.authorName}
              avatarUrl={entry.authorAvatarUrl}
              ringState={entry.hasUnviewed ? "unviewed" : "viewed"}
              onClick={() => onOpenStatus(entry)}
            />
          ))}
    </div>
  );
}

type RingState = "unviewed" | "viewed" | "mine-empty" | "mine-posted";

const RING_CLASSES: Record<RingState, string> = {
  // Solid green ring — matches the Figma reference's unviewed-status state.
  unviewed: "border-2 border-solid border-[#3aa757]",
  // Dashed ring once every status from that author has been viewed.
  viewed: "border-2 border-dashed border-[#3aa757]",
  // No status posted yet — plain border, "+" badge invites posting.
  "mine-empty": "border-2 border-solid border-[#e2e7ee]",
  "mine-posted": "border-2 border-solid border-[#3aa757]",
};

function StatusStripItem({
  label,
  avatarUrl,
  ringState,
  onClick,
  showAddBadge = false,
}: {
  label: string;
  avatarUrl: string | null;
  ringState: RingState;
  onClick: () => void;
  showAddBadge?: boolean;
}) {
  const initial = label.trim().charAt(0).toUpperCase() || "?";

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-16 flex-shrink-0 flex-col items-center gap-1.5 text-center"
    >
      <span className={`relative flex h-16 w-16 items-center justify-center rounded-full ${RING_CLASSES[ringState]}`}>
        <span className="relative h-[58px] w-[58px] overflow-hidden rounded-full bg-[#f3f5f8]">
          {avatarUrl ? (
            <Image src={avatarUrl} alt={label} fill sizes="58px" className="object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-lg font-semibold text-[#7a8595]">
              {initial}
            </span>
          )}
        </span>

        {showAddBadge ? (
          <span className="absolute bottom-0 right-0 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-[#3aa757] text-xs font-bold text-white">
            +
          </span>
        ) : null}
      </span>

      <span className="w-full truncate text-xs text-[#1f2733]">{label}</span>
    </button>
  );
}

function StatusStripSkeleton() {
  return (
    <div className="flex w-16 flex-shrink-0 flex-col items-center gap-1.5">
      <div className="h-16 w-16 animate-pulse rounded-full bg-[#e7ebf1]" />
      <div className="h-2.5 w-10 animate-pulse rounded bg-[#e7ebf1]" />
    </div>
  );
}
