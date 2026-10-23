"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Eye, MessageCircle, Trash2, X } from "lucide-react";

import { useAuthStore } from "@/store/authStore";
import { ApiError, DEFAULT_GROUP_ACCENT_CHOICES, type AuthTokens } from "@/utils/scuibApi";
import {
  deleteStatus,
  fetchStatusViewers,
  recordStatusView,
  type ApiStatusRecord,
  type ApiStatusViewerRecord,
} from "@/utils/scuibStatusApi";
import { StatusCommentSheet } from "./StatusCommentSheet";

const TEXT_STATUS_DURATION_MS = 6000;
const IMAGE_STATUS_DURATION_MS = 5000;

type StatusViewerProps = {
  /** All statuses for the author currently being viewed, oldest first. */
  statuses: ApiStatusRecord[];
  /** Index into `statuses` to open on. */
  initialIndex?: number;
  authorName: string;
  authorAvatarUrl: string | null;
  onClose: () => void;
  /** Called after a status is deleted, so the parent can refresh its feed. */
  onStatusDeleted?: (statusId: string) => void;
};

export function StatusViewer({
  statuses,
  initialIndex = 0,
  authorName,
  authorAvatarUrl,
  onClose,
  onStatusDeleted,
}: StatusViewerProps) {
  const currentUser = useAuthStore((state) => state.user);
  const accessToken = useAuthStore((state) => state.accessToken);
  const refreshToken = useAuthStore((state) => state.refreshToken);
  const tokenType = useAuthStore((state) => state.tokenType);
  const setTokens = useAuthStore((state) => state.setTokens);

  const [activeIndex, setActiveIndex] = useState(() =>
    Math.min(Math.max(initialIndex, 0), Math.max(statuses.length - 1, 0)),
  );
  const [isPaused, setIsPaused] = useState(false);
  const [showViewers, setShowViewers] = useState(false);
  const [showComments, setShowComments] = useState(false);

  const activeStatus = statuses[activeIndex] ?? null;
  const isOwnStatus = Boolean(
    currentUser &&
      activeStatus &&
      (activeStatus.authorId === currentUser.id ||
        (currentUser.email && activeStatus.authorId === currentUser.email) ||
        (currentUser.username && activeStatus.authorId === currentUser.username))
  );

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

  const goToNext = useCallback(() => {
    if (activeIndex + 1 < statuses.length) {
      setActiveIndex(activeIndex + 1);
    } else {
      onClose();
    }
  }, [activeIndex, statuses.length, onClose]);

  const goToPrevious = useCallback(() => {
    setActiveIndex((index) => Math.max(index - 1, 0));
  }, []);

  // Record a view exactly once per status shown, not on every re-render.
  const recordedStatusIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!activeStatus || isOwnStatus) return;
    if (recordedStatusIdsRef.current.has(activeStatus.id)) return;
    if (!accessToken) return;

    recordedStatusIdsRef.current.add(activeStatus.id);
    recordStatusView(activeStatus.id, tokens, handleAuthRefresh).catch(() => {
      // Non-fatal — losing a view record shouldn't interrupt the viewing
      // experience. The author's view count will simply be off by one.
      recordedStatusIdsRef.current.delete(activeStatus.id);
    });
  }, [activeStatus, isOwnStatus, accessToken, tokens, handleAuthRefresh]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") goToNext();
      if (event.key === "ArrowLeft") goToPrevious();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, goToNext, goToPrevious]);

  if (!activeStatus) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
      <div className="relative h-full w-full max-w-[480px] overflow-hidden bg-black sm:h-[92vh] sm:rounded-2xl">
        <div className="absolute left-0 right-0 top-0 z-10 flex gap-1.5 px-3 pt-3">
          {statuses.map((status, index) => (
            <div key={status.id} className="h-1 flex-1 overflow-hidden rounded-full bg-white/30">
              {index < activeIndex ? (
                <div className="h-full w-full bg-white" />
              ) : index === activeIndex ? (
                <StatusProgressFill
                  status={status}
                  isPaused={isPaused}
                  isSuspended={showViewers || showComments}
                  onComplete={goToNext}
                />
              ) : null}
            </div>
          ))}
        </div>

        <div className="absolute left-0 right-0 top-7 z-10 flex items-center justify-between px-3">
          <div className="flex items-center gap-2.5">
            <span className="relative h-9 w-9 overflow-hidden rounded-full bg-white/20">
              {authorAvatarUrl ? (
                <Image src={authorAvatarUrl} alt={authorName} fill sizes="36px" className="object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-sm font-semibold text-white">
                  {authorName.trim().charAt(0).toUpperCase() || "?"}
                </span>
              )}
            </span>
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-white">{authorName}</span>
              <span className="text-xs text-white/70">{formatRelativeTime(activeStatus.createdAt)}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isOwnStatus ? (
              <button
                type="button"
                onClick={() =>
                  void handleDelete(activeStatus, tokens, handleAuthRefresh, onStatusDeleted, onClose)
                }
                aria-label="Delete status"
                className="rounded-full p-1.5 text-white/90 hover:bg-white/10"
              >
                <Trash2 size={18} />
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded-full p-1.5 text-white/90 hover:bg-white/10"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <button
          type="button"
          aria-label="Previous status"
          onClick={goToPrevious}
          onPointerDown={() => setIsPaused(true)}
          onPointerUp={() => setIsPaused(false)}
          className="absolute bottom-0 left-0 top-0 z-[5] w-1/3 cursor-default"
        />
        <button
          type="button"
          aria-label="Next status"
          onClick={goToNext}
          onPointerDown={() => setIsPaused(true)}
          onPointerUp={() => setIsPaused(false)}
          className="absolute bottom-0 right-0 top-0 z-[5] w-1/3 cursor-default"
        />

        <StatusContentView status={activeStatus} isPaused={isPaused} onVideoEnded={goToNext} />

        {/* Bottom action bar — viewers button (owner) + comments button (all) */}
        <div className="absolute bottom-5 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2">
          {isOwnStatus ? (
            <button
              type="button"
              onClick={() => { setShowComments(false); setShowViewers(true); }}
              className="flex items-center gap-1.5 rounded-full bg-black/40 px-4 py-2 text-sm font-medium text-white"
            >
              <Eye size={16} />
              {activeStatus.viewCount} {activeStatus.viewCount === 1 ? "view" : "views"}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => { setShowViewers(false); setShowComments(true); }}
            className="flex items-center gap-1.5 rounded-full bg-black/40 px-4 py-2 text-sm font-medium text-white"
          >
            <MessageCircle size={16} />
            Comment
          </button>
        </div>

        {showViewers && isOwnStatus ? (
          <StatusViewerList
            statusId={activeStatus.id}
            tokens={tokens}
            onAuthRefresh={handleAuthRefresh}
            onClose={() => setShowViewers(false)}
          />
        ) : null}

        {showComments ? (
          <StatusCommentSheet
            statusId={activeStatus.id}
            tokens={tokens}
            onAuthRefresh={handleAuthRefresh}
            onClose={() => setShowComments(false)}
          />
        ) : null}
      </div>
    </div>
  );
}

async function handleDelete(
  status: ApiStatusRecord,
  tokens: Partial<AuthTokens>,
  onAuthRefresh: (tokens: AuthTokens) => void,
  onStatusDeleted: ((statusId: string) => void) | undefined,
  onClose: () => void,
) {
  try {
    await deleteStatus(status.id, tokens, onAuthRefresh);
    onStatusDeleted?.(status.id);
    onClose();
  } catch (error) {
    // Surfaced via the calling component's own state in a future pass —
    // for now this fails safely without crashing the viewer.
    console.error(error instanceof ApiError ? error.message : "Failed to delete status.");
  }
}

/**
 * Owns its own elapsed-time state in complete isolation. Mounted fresh (via
 * `key={status.id}` from the parent) every time the active status changes,
 * so it always starts at 0% with no manual reset effect required — React's
 * own mount/unmount lifecycle does the reset. setState only ever happens
 * inside the setInterval callback, never synchronously in the effect body,
 * satisfying this project's react-hooks/set-state-in-effect rule cleanly.
 */
function StatusProgressFill({
  status,
  isPaused,
  isSuspended,
  onComplete,
}: {
  status: ApiStatusRecord;
  isPaused: boolean;
  isSuspended: boolean;
  onComplete: () => void;
}) {
  const [percent, setPercent] = useState(0);
  const onCompleteCalled = useRef(false);

  useEffect(() => {
    if (isPaused || isSuspended) return undefined;
    if (status.type === "video") return undefined; // video drives advancement via onEnded instead

    const durationMs = status.type === "text" ? TEXT_STATUS_DURATION_MS : IMAGE_STATUS_DURATION_MS;
    const tickMs = 50;

    const interval = setInterval(() => {
      setPercent((current) => {
        const next = current + (tickMs / durationMs) * 100;
        return next >= 100 ? 100 : next;
      });
    }, tickMs);

    return () => clearInterval(interval);
  }, [isPaused, isSuspended, status, onComplete]);

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

function StatusContentView({
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
        className="flex h-full w-full items-center justify-center px-8 text-center"
        style={{ backgroundColor: status.backgroundColor ?? DEFAULT_GROUP_ACCENT_CHOICES[0] }}
      >
        <p className="text-2xl font-semibold leading-relaxed text-white">{status.textContent}</p>
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
          className="h-full w-full object-contain"
        />
      </div>
    );
  }

  if (status.mediaUrl) {
    return (
      <div className="relative h-full w-full">
        <Image src={status.mediaUrl} alt="Status" fill sizes="480px" className="object-contain" />
      </div>
    );
  }

  return <div className="h-full w-full bg-black" />;
}

function StatusViewerList({
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
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    fetchStatusViewers(statusId, tokens, onAuthRefresh)
      .then((result) => {
        if (isActive) setViewers(result.viewers);
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
    <div className="absolute inset-x-0 bottom-0 z-20 max-h-[60%] overflow-y-auto rounded-t-2xl bg-white px-4 py-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-semibold text-[#1f2733]">Viewed by</span>
        <button type="button" onClick={onClose} className="text-sm text-[#7a8595]">
          Close
        </button>
      </div>

      {isLoading ? (
        <p className="py-4 text-center text-sm text-[#7a8595]">Loading…</p>
      ) : loadError ? (
        <p className="py-4 text-center text-sm text-red-600">{loadError}</p>
      ) : viewers.length === 0 ? (
        <p className="py-4 text-center text-sm text-[#7a8595]">No views yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {viewers.map((viewer) => (
            <li key={viewer.userId} className="flex items-center gap-3">
              <span className="relative h-9 w-9 overflow-hidden rounded-full bg-[#f3f5f8]">
                {viewer.avatarUrl ? (
                  <Image src={viewer.avatarUrl} alt={viewer.name ?? "Viewer"} fill sizes="36px" className="object-cover" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-xs font-semibold text-[#7a8595]">
                    {(viewer.name ?? "?").trim().charAt(0).toUpperCase()}
                  </span>
                )}
              </span>
              <span className="text-sm text-[#1f2733]">{viewer.name ?? "Unknown"}</span>
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
