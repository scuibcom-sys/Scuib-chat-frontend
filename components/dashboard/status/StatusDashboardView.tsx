"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Eye,
  Folder,
  MessageCircle,
  MessageSquare,
  Plus,
  Trash2,
  X,
  Play,
  RotateCw,
} from "lucide-react";

import { useAuthStore } from "@/store/authStore";
import { ApiError, DEFAULT_GROUP_ACCENT_CHOICES, type AuthTokens } from "@/utils/scuibApi";
import {
  deleteStatus,
  fetchStatusFeed,
  fetchStatusViewers,
  groupStatusesByAuthor,
  recordStatusView,
  sortStatusFeedPinnedFirst,
  type ApiStatusRecord,
  type ApiStatusViewerRecord,
} from "@/utils/scuibStatusApi";
import { StatusCommentSheet } from "./StatusCommentSheet";
import { StatusComposer } from "./StatusComposer";

const TEXT_STATUS_DURATION_MS = 6000;
const IMAGE_STATUS_DURATION_MS = 5000;

export type StatusAuthorGroup = {
  authorId: string;
  authorName: string;
  authorAvatarUrl: string | null;
  statuses: ApiStatusRecord[];
  latestStatus: ApiStatusRecord;
  hasUnviewed: boolean;
  isPinnedAuthor: boolean;
  isCurrentUser: boolean;
};

type StatusDashboardViewProps = {
  mode: "desktop" | "mobile";
  onSwitchToMessages: () => void;
  onComposeStatus?: () => void;
  refreshKey?: number;
  onUnreadCountChange?: (count: number) => void;
};

export function StatusDashboardView({
  mode,
  onSwitchToMessages,
  onComposeStatus,
  refreshKey = 0,
  onUnreadCountChange,
}: StatusDashboardViewProps) {
  const currentUser = useAuthStore((state) => state.user);
  const accessToken = useAuthStore((state) => state.accessToken);
  const refreshToken = useAuthStore((state) => state.refreshToken);
  const tokenType = useAuthStore((state) => state.tokenType);
  const setTokens = useAuthStore((state) => state.setTokens);

  const [feed, setFeed] = useState<ApiStatusRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedAuthorId, setSelectedAuthorId] = useState<string | null>(null);
  const [activeStatusIndex, setActiveStatusIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [showViewers, setShowViewers] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [isMobileCollapsed, setIsMobileCollapsed] = useState(false);

  // Hold-to-pause & quick-tap navigation helpers
  const isHoldingRef = useRef(false);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleZonePointerDown = useCallback(() => {
    isHoldingRef.current = false;
    setIsPaused(true);
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    holdTimerRef.current = setTimeout(() => {
      isHoldingRef.current = true;
    }, 200);
  }, []);

  const handleZonePointerUp = useCallback((navigateAction?: () => void) => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    const wasHold = isHoldingRef.current;
    isHoldingRef.current = false;
    setIsPaused(false);

    if (!wasHold && navigateAction) {
      navigateAction();
    }
  }, []);

  const handleZonePointerLeave = useCallback(() => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    isHoldingRef.current = false;
    setIsPaused(false);
  }, []);

  const handleAuthRefresh = useCallback(
    (refreshedTokens: AuthTokens) => {
      setTokens(refreshedTokens.accessToken, refreshedTokens.refreshToken, refreshedTokens.tokenType);
    },
    [setTokens],
  );

  const tokens = useMemo<Partial<AuthTokens>>(
    () => ({ accessToken, refreshToken, tokenType }),
    [accessToken, refreshToken, tokenType],
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
    if (!hasHydrated || !accessToken) {
      if (!accessToken) {
        setFeed([]);
        setIsLoading(false);
      }
      return;
    }

    setIsLoading(true);
    setLoadError(null);

    try {
      const statuses = await fetchStatusFeed(tokens, handleAuthRefresh);
      setFeed(statuses);
    } catch (error) {
      setLoadError(
        error instanceof ApiError ? error.message : "Couldn't load status updates right now.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [hasHydrated, accessToken, tokens, handleAuthRefresh]);

  useEffect(() => {
    loadFeed();
  }, [loadFeed, refreshKey]);

  // Group feed into authors
  const { authorGroups, myGroup, unreadTotal } = useMemo(() => {
    const grouped = groupStatusesByAuthor(feed);
    const groups: StatusAuthorGroup[] = [];
    let unreadCount = 0;

    for (const [authorId, statusesForAuthor] of grouped.entries()) {
      if (!statusesForAuthor.length) continue;
      const latestStatus = statusesForAuthor[statusesForAuthor.length - 1];

      const isCurrent = Boolean(
        currentUser &&
          (authorId === currentUser.id ||
            (currentUser.email && authorId === currentUser.email) ||
            (currentUser.username && authorId === currentUser.username)),
      );

      const hasUnviewed = statusesForAuthor.some((s) => !s.viewedByMe);
      if (!isCurrent && hasUnviewed) {
        unreadCount += statusesForAuthor.filter((s) => !s.viewedByMe).length;
      }

      groups.push({
        authorId,
        authorName: isCurrent ? "My Status" : latestStatus.authorName ?? "Unknown",
        authorAvatarUrl: latestStatus.authorAvatarUrl ?? (isCurrent ? currentUser?.avatarUrl ?? null : null),
        statuses: statusesForAuthor,
        latestStatus,
        hasUnviewed,
        isPinnedAuthor: latestStatus.isPinnedAuthor,
        isCurrentUser: isCurrent,
      });
    }

    const sortedStatuses = sortStatusFeedPinnedFirst(groups.map((g) => g.latestStatus));
    const sortedIds = sortedStatuses.map((s) => s.authorId ?? s.id);
    groups.sort((a, b) => sortedIds.indexOf(a.authorId) - sortedIds.indexOf(b.authorId));

    const mine = groups.find((g) => g.isCurrentUser) ?? null;
    const others = groups.filter((g) => !g.isCurrentUser);

    return { authorGroups: others, myGroup: mine, unreadTotal: unreadCount };
  }, [feed, currentUser]);

  // Report unread count up to parent for Rail badge
  useEffect(() => {
    onUnreadCountChange?.(unreadTotal);
  }, [unreadTotal, onUnreadCountChange]);

  // Auto-select first author if none selected yet
  useEffect(() => {
    if (!selectedAuthorId) {
      if (authorGroups.length > 0) {
        const firstUnviewed = authorGroups.find((g) => g.hasUnviewed);
        setSelectedAuthorId(firstUnviewed ? firstUnviewed.authorId : authorGroups[0].authorId);
      } else if (myGroup && myGroup.statuses.length > 0) {
        setSelectedAuthorId(myGroup.authorId);
      }
    }
  }, [authorGroups, myGroup, selectedAuthorId]);

  // Determine currently active author & status
  const currentAuthorGroup = useMemo(() => {
    if (selectedAuthorId === myGroup?.authorId) return myGroup;
    return authorGroups.find((g) => g.authorId === selectedAuthorId) ?? null;
  }, [selectedAuthorId, myGroup, authorGroups]);

  const activeStatus = useMemo(() => {
    if (!currentAuthorGroup || !currentAuthorGroup.statuses.length) return null;
    const clampedIndex = Math.min(
      Math.max(activeStatusIndex, 0),
      currentAuthorGroup.statuses.length - 1,
    );
    return currentAuthorGroup.statuses[clampedIndex] ?? null;
  }, [currentAuthorGroup, activeStatusIndex]);

  const isOwnActiveStatus = Boolean(currentAuthorGroup?.isCurrentUser);

  // Record view on non-owned active status
  const recordedStatusIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!activeStatus || isOwnActiveStatus || !accessToken) return;
    if (recordedStatusIdsRef.current.has(activeStatus.id)) return;

    recordedStatusIdsRef.current.add(activeStatus.id);
    recordStatusView(activeStatus.id, tokens, handleAuthRefresh).catch(() => {
      recordedStatusIdsRef.current.delete(activeStatus.id);
    });
  }, [activeStatus, isOwnActiveStatus, accessToken, tokens, handleAuthRefresh]);

  // Live viewer count for own statuses — refresh every 30 s while owner is viewing
  const [liveViewCount, setLiveViewCount] = useState<number | null>(null);
  const [recentViewers, setRecentViewers] = useState<ApiStatusViewerRecord[]>([]);
  useEffect(() => {
    if (!isOwnActiveStatus || !activeStatus || !accessToken) {
      setLiveViewCount(null);
      setRecentViewers([]);
      return;
    }

    let cancelled = false;
    const fetchCount = () => {
      fetchStatusViewers(activeStatus.id, tokens, handleAuthRefresh)
        .then((result) => {
          if (!cancelled) {
            setLiveViewCount(result.viewCount ?? result.viewers.length);
            setRecentViewers(result.viewers.slice(0, 3));
          }
        })
        .catch(() => {/* silent — pill falls back to activeStatus.viewCount */});
    };

    fetchCount();
    const timer = setInterval(fetchCount, 30_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [isOwnActiveStatus, activeStatus?.id, accessToken]); // eslint-disable-line react-hooks/exhaustive-deps

  const displayViewCount = isOwnActiveStatus
    ? (liveViewCount ?? activeStatus?.viewCount ?? 0)
    : (activeStatus?.viewCount ?? 0);

  // Navigation between statuses and authors
  const goToNextStatus = useCallback(() => {
    if (!currentAuthorGroup) return;

    if (activeStatusIndex + 1 < currentAuthorGroup.statuses.length) {
      setActiveStatusIndex((prev) => prev + 1);
    } else {
      // Find next author
      const allGroups = myGroup?.statuses.length ? [myGroup, ...authorGroups] : authorGroups;
      const currentIndex = allGroups.findIndex((g) => g.authorId === currentAuthorGroup.authorId);
      if (currentIndex >= 0 && currentIndex + 1 < allGroups.length) {
        setSelectedAuthorId(allGroups[currentIndex + 1].authorId);
        setActiveStatusIndex(0);
      } else if (allGroups.length > 0) {
        // Loop back or reset
        setActiveStatusIndex(0);
      }
    }
  }, [currentAuthorGroup, activeStatusIndex, authorGroups, myGroup]);

  const goToPreviousStatus = useCallback(() => {
    if (activeStatusIndex > 0) {
      setActiveStatusIndex((prev) => prev - 1);
    } else if (currentAuthorGroup) {
      // Previous author
      const allGroups = myGroup?.statuses.length ? [myGroup, ...authorGroups] : authorGroups;
      const currentIndex = allGroups.findIndex((g) => g.authorId === currentAuthorGroup.authorId);
      if (currentIndex > 0) {
        const prevGroup = allGroups[currentIndex - 1];
        setSelectedAuthorId(prevGroup.authorId);
        setActiveStatusIndex(Math.max(0, prevGroup.statuses.length - 1));
      }
    }
  }, [activeStatusIndex, currentAuthorGroup, authorGroups, myGroup]);

  const handleSelectAuthor = useCallback((authorId: string) => {
    setSelectedAuthorId(authorId);
    setActiveStatusIndex(0);
    setShowViewers(false);
    setShowComments(false);
  }, []);

  const handleOpenComposer = useCallback(() => {
    if (onComposeStatus) {
      onComposeStatus();
    } else {
      setIsComposerOpen(true);
    }
  }, [onComposeStatus]);

  const handleDeleteActiveStatus = useCallback(async () => {
    if (!activeStatus) return;
    try {
      await deleteStatus(activeStatus.id, tokens, handleAuthRefresh);
      loadFeed();
    } catch (err) {
      console.error("Failed to delete status:", err);
    }
  }, [activeStatus, tokens, handleAuthRefresh, loadFeed]);

  // Desktop View
  if (mode === "desktop") {
    return (
      <div className="flex h-full w-full overflow-hidden bg-[#FAF7F5]">
        {/* Left Column: Vertical Story Avatar Feed (Matches Figma Desktop node-id=402-6705) */}
        <div className="flex h-full w-[130px] shrink-0 flex-col items-center border-r border-[#E8DDD5] bg-[#FFFFFF] py-6 shadow-sm xl:w-[150px]">
          <div className="flex w-full flex-1 flex-col items-center gap-7 overflow-y-auto px-2 scrollbar-none">
            {/* My Status */}
            <button
              type="button"
              onClick={() => {
                if (myGroup && myGroup.statuses.length > 0) {
                  handleSelectAuthor(myGroup.authorId);
                } else {
                  handleOpenComposer();
                }
              }}
              className="group flex flex-col items-center gap-2 text-center"
            >
              <div className="relative flex h-[62px] w-[62px] items-center justify-center rounded-full border-2 border-solid border-[#3aa757] transition-transform group-hover:scale-105">
                <div className="relative h-[54px] w-[54px] overflow-hidden rounded-full bg-[#f3f5f8]">
                  {currentUser?.avatarUrl ? (
                    <Image
                      src={currentUser.avatarUrl}
                      alt="My Status"
                      fill
                      sizes="54px"
                      className="object-cover"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-sm font-semibold text-[#5C3A26]">
                      {currentUser?.username?.charAt(0).toUpperCase() || "Me"}
                    </span>
                  )}
                </div>
                {/* Green '+' badge */}
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenComposer();
                  }}
                  className="absolute bottom-0 right-0 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-[#3aa757] text-[12px] font-bold text-white shadow-sm hover:scale-110"
                  title="Add new status"
                >
                  +
                </div>
              </div>
              <span className="w-24 truncate text-[13px] font-medium text-[#2C2420]">
                My Status
              </span>
            </button>

            {/* Separator if user has status */}
            <div className="h-px w-12 bg-[#F0E6DF]" />

            {/* Other Contacts Status List */}
            {isLoading ? (
              Array.from({ length: 4 }).map((_, idx) => (
                <div key={idx} className="flex flex-col items-center gap-2">
                  <div className="h-[62px] w-[62px] animate-pulse rounded-full bg-[#EFE9E4]" />
                  <div className="h-3 w-16 animate-pulse rounded bg-[#EFE9E4]" />
                </div>
              ))
            ) : authorGroups.length === 0 ? (
              <div className="px-2 text-center text-xs text-[#8E7B71]">
                No contact updates yet
              </div>
            ) : (
              authorGroups.map((group) => {
                const isSelected = selectedAuthorId === group.authorId;
                const ringClass = group.hasUnviewed
                  ? "border-2 border-solid border-[#3aa757]"
                  : "border-2 border-dashed border-[#3aa757]";

                return (
                  <button
                    key={group.authorId}
                    type="button"
                    onClick={() => handleSelectAuthor(group.authorId)}
                    className={`group flex flex-col items-center gap-2 text-center transition-all ${
                      isSelected ? "scale-105" : "hover:scale-102"
                    }`}
                  >
                    <div
                      className={`relative flex h-[62px] w-[62px] items-center justify-center rounded-full ${ringClass} ${
                        isSelected ? "ring-4 ring-[#3aa757]/20" : ""
                      }`}
                    >
                      <div className="relative h-[54px] w-[54px] overflow-hidden rounded-full bg-[#F5EFEA]">
                        {group.authorAvatarUrl ? (
                          <Image
                            src={group.authorAvatarUrl}
                            alt={group.authorName}
                            fill
                            sizes="54px"
                            className="object-cover"
                          />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center text-sm font-bold text-[#6B452E]">
                            {group.authorName.trim().charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>
                    </div>
                    <span
                      className={`w-24 truncate text-[13px] ${
                        isSelected ? "font-bold text-[#1C1613]" : "font-normal text-[#4A3D36]"
                      }`}
                    >
                      {group.authorName}
                    </span>
                  </button>
                );
              })
            )}
          </div>

          {/* Quick Create Status Floating Action */}
          <button
            type="button"
            onClick={handleOpenComposer}
            className="mb-4 mt-3 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#3aa757] text-white shadow-md transition-transform hover:scale-110"
            title="Create Status"
          >
            <Plus size={22} strokeWidth={2.5} />
          </button>
        </div>

        {/* Main Content Area: Centered Story Viewer Card (Matches Figma Desktop node-id=402-6705) */}
        <div className="relative flex flex-1 items-center justify-center overflow-hidden p-6">
          {activeStatus && currentAuthorGroup ? (
            <div className="relative flex h-[86vh] max-h-[780px] w-full max-w-[430px] flex-col overflow-hidden rounded-[32px] bg-black shadow-[0_24px_50px_rgba(0,0,0,0.28)] ring-1 ring-black/10">
              {/* Progress bars */}
              <div className="absolute left-0 right-0 top-0 z-20 flex gap-1 px-3 pt-3">
                {currentAuthorGroup.statuses.map((status, index) => (
                  <div
                    key={status.id}
                    className="h-1 flex-1 overflow-hidden rounded-full bg-white/30"
                  >
                    {index < activeStatusIndex ? (
                      <div className="h-full w-full bg-white" />
                    ) : index === activeStatusIndex ? (
                      <StoryProgressFill
                        status={status}
                        isPaused={isPaused || showViewers || showComments}
                        onComplete={goToNextStatus}
                      />
                    ) : null}
                  </div>
                ))}
              </div>

              {/* Top Header inside story card */}
              <div className="absolute left-0 right-0 top-6 z-20 flex items-center justify-between px-4">
                <div className="flex items-center gap-3">
                  <div className="relative h-10 w-10 overflow-hidden rounded-full ring-2 ring-white/50 bg-white/20">
                    {currentAuthorGroup.authorAvatarUrl ? (
                      <Image
                        src={currentAuthorGroup.authorAvatarUrl}
                        alt={currentAuthorGroup.authorName}
                        fill
                        sizes="40px"
                        className="object-cover"
                      />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-sm font-bold text-white">
                        {currentAuthorGroup.authorName.trim().charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-white drop-shadow-md">
                      {currentAuthorGroup.authorName}
                    </span>
                    <span className="text-xs text-white/80 drop-shadow-sm">
                      {formatRelativeTime(activeStatus.createdAt)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  {isOwnActiveStatus ? (
                    <button
                      type="button"
                      onClick={handleDeleteActiveStatus}
                      className="rounded-full bg-black/30 p-2 text-white/90 backdrop-blur-md transition-colors hover:bg-black/50"
                      title="Delete status"
                    >
                      <Trash2 size={16} />
                    </button>
                  ) : null}
                </div>
              </div>

              {/* Tap zones for Next / Previous: tap = navigate, hold = pause */}
              <div
                aria-label="Previous story"
                onPointerDown={handleZonePointerDown}
                onPointerUp={() => handleZonePointerUp(goToPreviousStatus)}
                onPointerLeave={handleZonePointerLeave}
                className="absolute bottom-0 left-0 top-0 z-10 w-1/3 cursor-pointer touch-none"
              />
              {/* Center hold-to-pause zone */}
              <div
                className="absolute bottom-0 left-1/3 right-1/3 top-0 z-10 cursor-pointer touch-none"
                onPointerDown={handleZonePointerDown}
                onPointerUp={() => handleZonePointerUp()}
                onPointerLeave={handleZonePointerLeave}
              />
              <div
                aria-label="Next story"
                onPointerDown={handleZonePointerDown}
                onPointerUp={() => handleZonePointerUp(goToNextStatus)}
                onPointerLeave={handleZonePointerLeave}
                className="absolute bottom-0 right-0 top-0 z-10 w-1/3 cursor-pointer touch-none"
              />

              {/* Status Media Content */}
              <div className="relative h-full w-full">
                <StoryMediaRenderer
                  status={activeStatus}
                  isPaused={isPaused || showViewers || showComments}
                  onVideoEnded={goToNextStatus}
                />
              </div>

              {/* Bottom Action Bar */}
              <div className="absolute bottom-6 left-0 right-0 z-20 flex items-center justify-between px-6">
                {/* Viewers Pill / Eye count */}
                {isOwnActiveStatus ? (
                  <button
                    type="button"
                    onClick={() => {
                      setShowComments(false);
                      setShowViewers(true);
                    }}
                    className="flex items-center gap-2 rounded-2xl bg-black/60 px-3.5 py-2 text-white backdrop-blur-md transition-colors hover:bg-black/80 active:scale-95"
                  >
                    <Eye size={16} className="shrink-0" />
                    <div className="flex flex-col items-start leading-tight">
                      <span className="text-sm font-bold">{displayViewCount.toLocaleString()}</span>
                      <span className="text-[9px] font-medium opacity-75">Tap to see who viewed</span>
                    </div>
                    {recentViewers.length > 0 && (
                      <div className="flex -space-x-1.5 ml-0.5">
                        {recentViewers.slice(0, 3).map((v) => (
                          <span
                            key={v.userId}
                            className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-white/40 bg-white/20 text-[8px] font-bold text-white"
                          >
                            {(v.name ?? "?").trim().charAt(0).toUpperCase()}
                          </span>
                        ))}
                      </div>
                    )}
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5 rounded-full bg-black/40 px-3 py-1.5 text-xs font-medium text-white/90 backdrop-blur-md">
                    <Eye size={14} />
                    <span>{activeStatus.viewCount}</span>
                  </div>
                )}

                {/* Comment Button */}
                <button
                  type="button"
                  onClick={() => {
                    setShowViewers(false);
                    setShowComments(true);
                  }}
                  className="flex items-center gap-1.5 rounded-full bg-black/50 px-4 py-2 text-xs font-semibold text-white backdrop-blur-md transition-colors hover:bg-black/70"
                >
                  <MessageCircle size={15} />
                  <span>Comment</span>
                </button>
              </div>

              {/* Viewers Sheet (Owner only) */}
              {showViewers && isOwnActiveStatus ? (
                <StoryViewersSheet
                  statusId={activeStatus.id}
                  tokens={tokens}
                  onAuthRefresh={handleAuthRefresh}
                  onClose={() => setShowViewers(false)}
                />
              ) : null}

              {/* Comments Sheet */}
              {showComments ? (
                <StatusCommentSheet
                  statusId={activeStatus.id}
                  tokens={tokens}
                  onAuthRefresh={handleAuthRefresh}
                  onClose={() => setShowComments(false)}
                />
              ) : null}
            </div>
          ) : (
            /* Empty State */
            <div className="flex max-w-md flex-col items-center justify-center rounded-3xl border border-[#EBE3DC] bg-white p-10 text-center shadow-md">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#EAF7ED] text-[#3aa757]">
                <Play size={28} className="translate-x-0.5 fill-current" />
              </div>
              <h3 className="text-xl font-bold text-[#3B2C24]">No Status Selected</h3>
              <p className="mt-2 text-sm text-[#7D6B60]">
                {loadError
                  ? loadError
                  : "Select a contact from the list or share what's on your mind with a new status."}
              </p>
              <button
                type="button"
                onClick={handleOpenComposer}
                className="mt-6 flex items-center gap-2 rounded-full bg-[#3aa757] px-6 py-2.5 text-sm font-bold text-white shadow-md transition-transform hover:scale-105"
              >
                <Plus size={18} />
                <span>Post a Status</span>
              </button>
            </div>
          )}
        </div>

        {/* Status Composer Modal */}
        {isComposerOpen ? (
          <StatusComposer
            onClose={() => setIsComposerOpen(false)}
            onPosted={(newStatus) => {
              loadFeed();
              if (currentUser) {
                setSelectedAuthorId(currentUser.id);
                setActiveStatusIndex(0);
              }
            }}
          />
        ) : null}
      </div>
    );
  }

  // Mobile View (Matches Figma Mobile node-id=375-4879)
  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-black">
      {/* Top Header & Status Strip (collapsible) */}
      {!isMobileCollapsed && (
        <>
          {/* Top Header Bar */}
          <div className="z-30 flex shrink-0 items-center justify-between bg-white px-5 pb-3 pt-3 shadow-sm">
            {/* Left Icons: Folder & Chat */}
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={handleOpenComposer}
                className="flex h-9 w-9 items-center justify-center rounded-full text-[#4A3D36] transition-colors hover:bg-[#F5EFEA]"
                title="Upload Media"
              >
                <Folder size={22} strokeWidth={2} />
              </button>
              <button
                type="button"
                onClick={onSwitchToMessages}
                className="flex h-9 w-9 items-center justify-center rounded-full text-[#4A3D36] transition-colors hover:bg-[#F5EFEA]"
                title="Messages"
              >
                <MessageSquare size={22} strokeWidth={2} />
              </button>
            </div>

            {/* Right Element: 'Status ⌵' Title with dropdown and quick collapse */}
            <div className="relative flex items-center gap-1">
              <button
                type="button"
                onClick={() => setIsMobileCollapsed(true)}
                className="flex items-center gap-1 text-[20px] font-bold text-[#3aa757] active:opacity-80"
                title="Collapse other statuses"
              >
                <span>Status</span>
                <ChevronDown size={20} strokeWidth={2.5} />
              </button>
              <button
                type="button"
                onClick={() => setShowStatusDropdown((prev) => !prev)}
                className="p-1 text-[#4A3D36]/60 hover:text-[#4F3422] transition-colors"
                title="Status Options"
              >
                <ChevronDown size={16} />
              </button>

              {showStatusDropdown ? (
                <div className="absolute right-0 top-full mt-2 w-48 overflow-hidden rounded-2xl border border-[#EAE3DE] bg-white py-2 shadow-xl z-50">
                  <button
                    type="button"
                    onClick={() => {
                      setShowStatusDropdown(false);
                      setIsMobileCollapsed(true);
                    }}
                    className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm font-medium text-[#3B2C24] hover:bg-[#F8F5F2]"
                  >
                    <ChevronUp size={16} />
                    <span>Collapse other statuses</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowStatusDropdown(false);
                      handleOpenComposer();
                    }}
                    className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm font-medium text-[#3B2C24] hover:bg-[#F8F5F2]"
                  >
                    <Plus size={16} />
                    <span>Add new status</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowStatusDropdown(false);
                      loadFeed();
                    }}
                    className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm font-medium text-[#3B2C24] hover:bg-[#F8F5F2]"
                  >
                    <RotateCw size={16} />
                    <span>Refresh updates</span>
                  </button>
                </div>
              ) : null}
            </div>
          </div>

          {/* Horizontal Status Strip Carousel (Matches Figma Mobile) */}
          <div className="z-30 shrink-0 border-b border-[#F0EAE4] bg-white px-4 py-3">
            <div className="flex gap-4 overflow-x-auto scrollbar-none">
              {/* My Status */}
              <button
                type="button"
                onClick={() => {
                  if (myGroup && myGroup.statuses.length > 0) {
                    handleSelectAuthor(myGroup.authorId);
                  } else {
                    handleOpenComposer();
                  }
                }}
                className="flex w-16 shrink-0 flex-col items-center gap-1.5 text-center"
              >
                <div className="relative flex h-16 w-16 items-center justify-center rounded-full border-2 border-solid border-[#3aa757]">
                  <div className="relative h-[56px] w-[56px] overflow-hidden rounded-full bg-[#f3f5f8]">
                    {currentUser?.avatarUrl ? (
                      <Image
                        src={currentUser.avatarUrl}
                        alt="My Status"
                        fill
                        sizes="56px"
                        className="object-cover"
                      />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-sm font-semibold text-[#5C3A26]">
                        {currentUser?.username?.charAt(0).toUpperCase() || "Me"}
                      </span>
                    )}
                  </div>
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenComposer();
                    }}
                    className="absolute bottom-0 right-0 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-[#3aa757] text-[11px] font-bold text-white shadow"
                  >
                    +
                  </div>
                </div>
                <span className="w-full truncate text-xs text-[#2C2420]">My Status</span>
              </button>

              {/* Contacts */}
              {isLoading
                ? Array.from({ length: 4 }).map((_, idx) => (
                    <div key={idx} className="flex w-16 shrink-0 flex-col items-center gap-1.5">
                      <div className="h-16 w-16 animate-pulse rounded-full bg-[#EFE9E4]" />
                      <div className="h-2.5 w-12 animate-pulse rounded bg-[#EFE9E4]" />
                    </div>
                  ))
                : authorGroups.map((group) => {
                    const isSelected = selectedAuthorId === group.authorId;
                    const ringClass = group.hasUnviewed
                      ? "border-2 border-solid border-[#3aa757]"
                      : "border-2 border-dashed border-[#3aa757]";

                    return (
                      <button
                        key={group.authorId}
                        type="button"
                        onClick={() => handleSelectAuthor(group.authorId)}
                        className="flex w-16 shrink-0 flex-col items-center gap-1.5 text-center"
                      >
                        <div
                          className={`relative flex h-16 w-16 items-center justify-center rounded-full ${ringClass} ${
                            isSelected ? "ring-2 ring-[#3aa757]" : ""
                          }`}
                        >
                          <div className="relative h-[56px] w-[56px] overflow-hidden rounded-full bg-[#F5EFEA]">
                            {group.authorAvatarUrl ? (
                              <Image
                                src={group.authorAvatarUrl}
                                alt={group.authorName}
                                fill
                                sizes="56px"
                                className="object-cover"
                              />
                            ) : (
                              <span className="flex h-full w-full items-center justify-center text-sm font-bold text-[#6B452E]">
                                {group.authorName.trim().charAt(0).toUpperCase()}
                              </span>
                            )}
                          </div>
                        </div>
                        <span
                          className={`w-full truncate text-xs ${
                            isSelected ? "font-bold text-[#1C1613]" : "text-[#4A3D36]"
                          }`}
                        >
                          {group.authorName}
                        </span>
                      </button>
                    );
                  })}
            </div>
          </div>
        </>
      )}

      {/* Immersive Active Story Viewer (Matches Figma Mobile) */}
      <div className="relative flex-1 overflow-hidden bg-black">
        {activeStatus && currentAuthorGroup ? (
          <>
            {/* Progress Bars */}
            <div className="absolute left-0 right-0 top-0 z-20 flex gap-1 px-3 pt-2">
              {currentAuthorGroup.statuses.map((status, index) => (
                <div
                  key={status.id}
                  className="h-1 flex-1 overflow-hidden rounded-full bg-white/30"
                >
                  {index < activeStatusIndex ? (
                    <div className="h-full w-full bg-white" />
                  ) : index === activeStatusIndex ? (
                    <StoryProgressFill
                      status={status}
                      isPaused={isPaused || showViewers || showComments}
                      onComplete={goToNextStatus}
                    />
                  ) : null}
                </div>
              ))}
            </div>

            {/* Author info pill in immersive view */}
            <div className="absolute left-3 top-5 z-20 flex items-center gap-2.5 rounded-full bg-black/30 px-3 py-1.5 backdrop-blur-sm">
              <span className="relative h-7 w-7 overflow-hidden rounded-full bg-white/20">
                {currentAuthorGroup.authorAvatarUrl ? (
                  <Image
                    src={currentAuthorGroup.authorAvatarUrl}
                    alt={currentAuthorGroup.authorName}
                    fill
                    sizes="28px"
                    className="object-cover"
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-xs font-bold text-white">
                    {currentAuthorGroup.authorName.trim().charAt(0).toUpperCase()}
                  </span>
                )}
              </span>
              <span className="text-xs font-semibold text-white drop-shadow">
                {currentAuthorGroup.authorName}
              </span>
              <span className="text-[10px] text-white/70">
                {formatRelativeTime(activeStatus.createdAt)}
              </span>
            </div>

            {/* Floating expand/collapse circular button (Matches Figma Mobile collapsed view node-id=375-4879) */}
            {isMobileCollapsed && (
              <button
                type="button"
                onClick={() => setIsMobileCollapsed(false)}
                aria-label="Expand all statuses"
                className="absolute top-4 right-4 z-30 flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#1C1613] shadow-[0_4px_16px_rgba(0,0,0,0.28)] active:scale-90 transition-transform"
              >
                <ChevronUp size={20} strokeWidth={2.5} />
              </button>
            )}

            {/* Tap zones for Next/Prev: tap = navigate, hold = pause */}
            <div
              aria-label="Previous story"
              onPointerDown={handleZonePointerDown}
              onPointerUp={() => handleZonePointerUp(goToPreviousStatus)}
              onPointerLeave={handleZonePointerLeave}
              className="absolute bottom-0 left-0 top-0 z-10 w-1/3 cursor-pointer touch-none"
            />
            {/* Center hold-to-pause zone */}
            <div
              className="absolute bottom-0 left-1/3 right-1/3 top-0 z-10 cursor-pointer touch-none"
              onPointerDown={handleZonePointerDown}
              onPointerUp={() => handleZonePointerUp()}
              onPointerLeave={handleZonePointerLeave}
            />
            <div
              aria-label="Next story"
              onPointerDown={handleZonePointerDown}
              onPointerUp={() => handleZonePointerUp(goToNextStatus)}
              onPointerLeave={handleZonePointerLeave}
              className="absolute bottom-0 right-0 top-0 z-10 w-1/3 cursor-pointer touch-none"
            />

            {/* Media renderer */}
            <div className="h-full w-full">
              <StoryMediaRenderer
                status={activeStatus}
                isPaused={isPaused || showViewers || showComments}
                onVideoEnded={goToNextStatus}
              />
            </div>

            {/* View counter pill (Matches Figma Mobile '👁 100') */}
            <div className="absolute bottom-6 right-5 z-20">
              {isOwnActiveStatus ? (
                <button
                  type="button"
                  onClick={() => {
                    setShowComments(false);
                    setShowViewers(true);
                  }}
                  className="flex items-center gap-2 rounded-2xl bg-black/60 px-3 py-2 text-white backdrop-blur-md active:scale-95 transition-transform"
                >
                  <Eye size={15} className="shrink-0" />
                  <div className="flex flex-col items-start leading-tight">
                    <span className="text-sm font-bold">{displayViewCount.toLocaleString()}</span>
                    <span className="text-[9px] font-medium opacity-75">Tap to see who</span>
                  </div>
                  {recentViewers.length > 0 && (
                    <div className="flex -space-x-1.5">
                      {recentViewers.slice(0, 3).map((v) => (
                        <span
                          key={v.userId}
                          className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-white/40 bg-white/20 text-[8px] font-bold text-white"
                        >
                          {(v.name ?? "?").trim().charAt(0).toUpperCase()}
                        </span>
                      ))}
                    </div>
                  )}
                </button>
              ) : (
                <div className="flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-white backdrop-blur-md">
                  <Eye size={14} />
                  <span>{activeStatus.viewCount}</span>
                </div>
              )}
            </div>

            {/* Comment button pill */}
            <button
              type="button"
              onClick={() => {
                setShowViewers(false);
                setShowComments(true);
              }}
              className="absolute bottom-6 left-5 z-20 flex items-center gap-1.5 rounded-full bg-black/60 px-3.5 py-1.5 text-xs font-semibold text-white backdrop-blur-md"
            >
              <MessageCircle size={14} />
              <span>Comment</span>
            </button>

            {/* Viewers Sheet (Owner only) */}
            {showViewers && isOwnActiveStatus ? (
              <StoryViewersSheet
                statusId={activeStatus.id}
                tokens={tokens}
                onAuthRefresh={handleAuthRefresh}
                onClose={() => setShowViewers(false)}
              />
            ) : null}

            {/* Comments Sheet */}
            {showComments ? (
              <StatusCommentSheet
                statusId={activeStatus.id}
                tokens={tokens}
                onAuthRefresh={handleAuthRefresh}
                onClose={() => setShowComments(false)}
              />
            ) : null}
          </>
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center p-6 text-center text-white">
            <p className="text-sm text-white/70">No active status right now.</p>
            <button
              type="button"
              onClick={handleOpenComposer}
              className="mt-4 flex items-center gap-2 rounded-full bg-[#3aa757] px-5 py-2 text-xs font-bold text-white shadow"
            >
              <Plus size={16} />
              <span>Add Your Status</span>
            </button>
          </div>
        )}
      </div>

      {/* Status Composer Modal */}
      {isComposerOpen ? (
        <StatusComposer
          onClose={() => setIsComposerOpen(false)}
          onPosted={() => {
            loadFeed();
            if (currentUser) {
              setSelectedAuthorId(currentUser.id);
              setActiveStatusIndex(0);
            }
          }}
        />
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Progress Fill Helper Component
// ---------------------------------------------------------------------------
function StoryProgressFill({
  status,
  isPaused,
  onComplete,
}: {
  status: ApiStatusRecord;
  isPaused: boolean;
  onComplete: () => void;
}) {
  const [percent, setPercent] = useState(0);
  const onCompleteCalled = useRef(false);

  useEffect(() => {
    if (isPaused) return undefined;
    if (status.type === "video") return undefined;

    const durationMs =
      status.type === "text" ? TEXT_STATUS_DURATION_MS : IMAGE_STATUS_DURATION_MS;
    const tickMs = 50;

    const interval = setInterval(() => {
      setPercent((current) => {
        const next = current + (tickMs / durationMs) * 100;
        return next >= 100 ? 100 : next;
      });
    }, tickMs);

    return () => clearInterval(interval);
  }, [isPaused, status, onComplete]);

  useEffect(() => {
    if (percent >= 100 && !onCompleteCalled.current) {
      onCompleteCalled.current = true;
      onComplete();
    }
  }, [percent, onComplete]);

  if (status.type === "video") {
    return <div className="h-full w-full bg-white" style={{ width: "0%" }} />;
  }

  return (
    <div
      className="h-full bg-white transition-[width] duration-75 ease-linear"
      style={{ width: `${Math.min(percent, 100)}%` }}
    />
  );
}

// ---------------------------------------------------------------------------
// Media Renderer Helper Component
// ---------------------------------------------------------------------------
function StoryMediaRenderer({
  status,
  isPaused,
  onVideoEnded,
}: {
  status: ApiStatusRecord;
  isPaused: boolean;
  onVideoEnded: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;
    if (isPaused) videoEl.pause();
    else videoEl.play().catch(() => {});
  }, [isPaused]);

  if (status.type === "text") {
    return (
      <div
        className="flex h-full w-full items-center justify-center p-8 text-center"
        style={{
          backgroundColor: status.backgroundColor ?? DEFAULT_GROUP_ACCENT_CHOICES[0],
        }}
      >
        <p className="max-w-xs text-2xl font-bold leading-relaxed text-white drop-shadow">
          {status.textContent ?? ""}
        </p>
      </div>
    );
  }

  if (status.type === "video" && status.mediaUrl) {
    return (
      <div className="relative h-full w-full bg-black">
        <video
          ref={videoRef}
          src={status.mediaUrl}
          autoPlay
          playsInline
          onEnded={onVideoEnded}
          className="h-full w-full object-cover"
        />
      </div>
    );
  }

  if (status.mediaUrl) {
    return (
      <div className="relative h-full w-full bg-black">
        <Image
          src={status.mediaUrl}
          alt="Status image"
          fill
          sizes="(max-width: 768px) 100vw, 430px"
          className="object-cover"
          priority
        />
      </div>
    );
  }

  return <div className="h-full w-full bg-black" />;
}

// ---------------------------------------------------------------------------
// Viewers List Helper Component
// ---------------------------------------------------------------------------
function StoryViewersSheet({
  statusId,
  tokens,
  onAuthRefresh,
  onClose,
}: {
  statusId: string;
  tokens: Partial<AuthTokens>;
  onAuthRefresh: (tokens: AuthTokens) => void;
  onClose: () => void;
}) {
  const [viewers, setViewers] = useState<ApiStatusViewerRecord[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    fetchStatusViewers(statusId, tokens, onAuthRefresh)
      .then((result) => {
        if (isActive) {
          setViewers(result.viewers);
          setTotalCount(result.viewCount ?? result.viewers.length);
        }
      })
      .catch((error) => {
        if (isActive) {
          setLoadError(error instanceof ApiError ? error.message : "Couldn't load viewers.");
        }
      })
      .finally(() => {
        if (isActive) setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [statusId, tokens, onAuthRefresh]);

  return (
    <div className="absolute inset-x-0 bottom-0 z-30 max-h-[65%] overflow-y-auto rounded-t-3xl bg-white px-5 py-4 shadow-2xl">
      <div className="mb-3 flex items-center justify-between border-b border-[#F0EAE4] pb-3">
        <div className="flex flex-col">
          <span className="text-sm font-bold text-[#1f2733]">Viewed by</span>
          {!isLoading && !loadError && (
            <span className="text-xs text-[#7a8595]">
              {totalCount.toLocaleString()} {totalCount === 1 ? "person" : "people"}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full p-1 text-sm font-semibold text-[#7a8595] hover:bg-[#F5EFEA]"
        >
          <X size={18} />
        </button>
      </div>

      {isLoading ? (
        <p className="py-4 text-center text-sm text-[#7a8595]">Loading viewers…</p>
      ) : loadError ? (
        <p className="py-4 text-center text-sm text-red-600">{loadError}</p>
      ) : viewers.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8">
          <Eye size={32} className="text-[#C8B9AE]" />
          <p className="text-sm text-[#7a8595]">No views yet — be the first to share!</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {viewers.map((viewer) => (
            <li key={viewer.userId} className="flex items-center gap-3">
              <span className="relative h-9 w-9 overflow-hidden rounded-full bg-[#f3f5f8]">
                {viewer.avatarUrl ? (
                  <Image
                    src={viewer.avatarUrl}
                    alt={viewer.name ?? "Viewer"}
                    fill
                    sizes="36px"
                    className="object-cover"
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-xs font-semibold text-[#7a8595]">
                    {(viewer.name ?? "?").trim().charAt(0).toUpperCase()}
                  </span>
                )}
              </span>
              <div className="flex flex-col leading-tight">
                <span className="text-sm font-medium text-[#1f2733]">{viewer.name ?? "Unknown"}</span>
                {viewer.viewedAt && (
                  <span className="text-[10px] text-[#9EA9B4]">
                    {formatRelativeTime(viewer.viewedAt)}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function formatRelativeTime(isoString: string | null): string {
  if (!isoString) return "";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "";

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  return "Yesterday";
}
