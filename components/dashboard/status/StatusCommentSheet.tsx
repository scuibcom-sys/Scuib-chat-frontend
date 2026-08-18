"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, MessageCircle, Send, Trash2, X } from "lucide-react";

import { useAuthStore } from "@/store/authStore";
import { ApiError, type AuthTokens } from "@/utils/scuibApi";
import {
  deleteCommentReply,
  deleteStatusComment,
  fetchCommentReplies,
  fetchStatusComments,
  postCommentReply,
  postStatusComment,
  type ApiStatusCommentRecord,
  type ApiStatusReplyRecord,
} from "@/utils/scuibStatusApi";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SheetView = "comments" | "replies";

type StatusCommentSheetProps = {
  statusId: string;
  tokens: Partial<AuthTokens>;
  onAuthRefresh: (tokens: AuthTokens) => void;
  onClose: () => void;
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function StatusCommentSheet({
  statusId,
  tokens,
  onAuthRefresh,
  onClose,
}: StatusCommentSheetProps) {
  const currentUser = useAuthStore((state) => state.user);

  const [view, setView] = useState<SheetView>("comments");
  const [activeComment, setActiveComment] = useState<ApiStatusCommentRecord | null>(null);

  // -- Comments state --
  const [comments, setComments] = useState<ApiStatusCommentRecord[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [commentsError, setCommentsError] = useState<string | null>(null);

  // -- Replies state --
  const [replies, setReplies] = useState<ApiStatusReplyRecord[]>([]);
  const [repliesLoading, setRepliesLoading] = useState(false);
  const [repliesError, setRepliesError] = useState<string | null>(null);

  // -- Shared input state --
  const [inputText, setInputText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // ---------------------------------------------------------------------------
  // Load comments
  // ---------------------------------------------------------------------------

  const loadComments = useCallback(async () => {
    setCommentsLoading(true);
    setCommentsError(null);
    try {
      const fetched = await fetchStatusComments(statusId, tokens, onAuthRefresh);
      setComments(fetched);
    } catch (error) {
      setCommentsError(
        error instanceof ApiError ? error.message : "Couldn't load comments right now.",
      );
    } finally {
      setCommentsLoading(false);
    }
  }, [statusId, tokens, onAuthRefresh]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  // ---------------------------------------------------------------------------
  // Load replies for a specific comment
  // ---------------------------------------------------------------------------

  const openReplies = useCallback(
    async (comment: ApiStatusCommentRecord) => {
      setActiveComment(comment);
      setView("replies");
      setRepliesLoading(true);
      setRepliesError(null);
      setInputText("");
      setSubmitError(null);

      try {
        const fetched = await fetchCommentReplies(comment.id, tokens, onAuthRefresh);
        setReplies(fetched);
      } catch (error) {
        setRepliesError(
          error instanceof ApiError ? error.message : "Couldn't load replies right now.",
        );
      } finally {
        setRepliesLoading(false);
      }
    },
    [tokens, onAuthRefresh],
  );

  const backToComments = useCallback(() => {
    setView("comments");
    setActiveComment(null);
    setInputText("");
    setSubmitError(null);
  }, []);

  // ---------------------------------------------------------------------------
  // Scroll list to bottom after new content is added
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [comments.length, replies.length]);

  // ---------------------------------------------------------------------------
  // Submit: post a new comment or reply
  // ---------------------------------------------------------------------------

  const handleSubmit = useCallback(async () => {
    const trimmed = inputText.trim();
    if (!trimmed || submitting) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      if (view === "comments") {
        await postStatusComment(statusId, trimmed, tokens, onAuthRefresh);
        setInputText("");
        // Reload to get the server-assigned id/userId/createdAt
        await loadComments();
      } else if (activeComment) {
        await postCommentReply(activeComment.id, trimmed, tokens, onAuthRefresh);
        setInputText("");
        const fetched = await fetchCommentReplies(activeComment.id, tokens, onAuthRefresh);
        setReplies(fetched);
      }
    } catch (error) {
      setSubmitError(
        error instanceof ApiError ? error.message : "Something went wrong. Please try again.",
      );
    } finally {
      setSubmitting(false);
      inputRef.current?.focus();
    }
  }, [
    inputText,
    submitting,
    view,
    statusId,
    activeComment,
    tokens,
    onAuthRefresh,
    loadComments,
  ]);

  // Submit on Enter (Shift+Enter inserts newline)
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  // ---------------------------------------------------------------------------
  // Delete a comment
  // ---------------------------------------------------------------------------

  const handleDeleteComment = useCallback(
    async (comment: ApiStatusCommentRecord) => {
      try {
        await deleteStatusComment(statusId, comment.id, tokens, onAuthRefresh);
        setComments((prev) => prev.filter((c) => c.id !== comment.id));
      } catch (error) {
        setSubmitError(
          error instanceof ApiError ? error.message : "Couldn't delete comment.",
        );
      }
    },
    [statusId, tokens, onAuthRefresh],
  );

  // ---------------------------------------------------------------------------
  // Delete a reply
  // ---------------------------------------------------------------------------

  const handleDeleteReply = useCallback(
    async (reply: ApiStatusReplyRecord) => {
      if (!activeComment) return;
      try {
        await deleteCommentReply(activeComment.id, reply.id, tokens, onAuthRefresh);
        setReplies((prev) => prev.filter((r) => r.id !== reply.id));
      } catch (error) {
        setSubmitError(
          error instanceof ApiError ? error.message : "Couldn't delete reply.",
        );
      }
    },
    [activeComment, tokens, onAuthRefresh],
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const placeholder = view === "comments" ? "Write a comment\u2026" : "Write a reply\u2026";

  return (
    <div className="absolute inset-x-0 bottom-0 z-20 flex max-h-[72%] flex-col rounded-t-2xl bg-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#e7ebf1] px-4 py-3">
        <div className="flex items-center gap-2">
          {view === "replies" ? (
            <button
              type="button"
              onClick={backToComments}
              aria-label="Back to comments"
              className="flex items-center gap-1 text-sm font-medium text-[#3aa757]"
            >
              <ChevronLeft size={18} />
              Comments
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <MessageCircle size={16} className="text-[#3aa757]" />
              <span className="text-sm font-semibold text-[#1f2733]">Comments</span>
              {!commentsLoading && (
                <span className="rounded-full bg-[#e9fbf0] px-1.5 py-0.5 text-xs font-semibold text-[#3aa757]">
                  {comments.length}
                </span>
              )}
            </div>
          )}
        </div>

        {view === "replies" && activeComment && (
          <span className="max-w-[50%] truncate text-xs text-[#7a8595]">
            Replying to: &ldquo;{activeComment.text}&rdquo;
          </span>
        )}

        <button
          type="button"
          onClick={onClose}
          aria-label="Close comments"
          className="rounded-full p-1 text-[#7a8595] hover:bg-[#f3f5f8]"
        >
          <X size={18} />
        </button>
      </div>

      {/* Content list */}
      <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-3">
        {view === "comments" ? (
          <CommentList
            comments={comments}
            isLoading={commentsLoading}
            loadError={commentsError}
            currentUserId={currentUser?.id ?? null}
            onRetry={loadComments}
            onOpenReplies={openReplies}
            onDelete={handleDeleteComment}
          />
        ) : (
          <ReplyList
            replies={replies}
            isLoading={repliesLoading}
            loadError={repliesError}
            currentUserId={currentUser?.id ?? null}
            onDelete={handleDeleteReply}
          />
        )}
      </div>

      {/* Sticky input */}
      <div className="border-t border-[#e7ebf1] px-4 pb-4 pt-3">
        {submitError ? (
          <p className="mb-2 text-xs text-red-500">{submitError}</p>
        ) : null}
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            rows={1}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={submitting}
            className="flex-1 resize-none rounded-xl border border-[#e2e7ee] bg-[#f9fafb] px-3 py-2 text-sm text-[#1f2733] placeholder:text-[#b0bac5] focus:border-[#3aa757] focus:outline-none disabled:opacity-60"
            style={{ maxHeight: "96px" }}
          />
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!inputText.trim() || submitting}
            aria-label="Send"
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#3aa757] text-white transition-opacity disabled:opacity-40"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CommentList sub-component
// ---------------------------------------------------------------------------

function CommentList({
  comments,
  isLoading,
  loadError,
  currentUserId,
  onRetry,
  onOpenReplies,
  onDelete,
}: {
  comments: ApiStatusCommentRecord[];
  isLoading: boolean;
  loadError: string | null;
  currentUserId: string | null;
  onRetry: () => void;
  onOpenReplies: (comment: ApiStatusCommentRecord) => void;
  onDelete: (comment: ApiStatusCommentRecord) => void;
}) {
  if (isLoading) {
    return <ListSkeleton count={3} />;
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center gap-2 py-6 text-center">
        <p className="text-sm text-red-500">{loadError}</p>
        <button
          type="button"
          onClick={onRetry}
          className="text-sm font-semibold text-[#3aa757] underline"
        >
          Retry
        </button>
      </div>
    );
  }

  if (comments.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-[#7a8595]">
        No comments yet. Be the first!
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {comments.map((comment) => (
        <li key={comment.id} className="flex flex-col gap-1">
          <div className="flex items-start gap-2">
            <UserInitialAvatar userId={comment.userId} />
            <div className="flex-1 rounded-xl bg-[#f3f5f8] px-3 py-2">
              <p className="text-sm text-[#1f2733]">{comment.text}</p>
              <p className="mt-0.5 text-xs text-[#b0bac5]">
                {formatRelativeTime(comment.createdAt)}
              </p>
            </div>
            {currentUserId === comment.userId ? (
              <button
                type="button"
                onClick={() => onDelete(comment)}
                aria-label="Delete comment"
                className="mt-1 rounded p-1 text-[#b0bac5] hover:text-red-500"
              >
                <Trash2 size={14} />
              </button>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => onOpenReplies(comment)}
            className="ml-10 text-left text-xs font-medium text-[#3aa757]"
          >
            Reply
          </button>
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// ReplyList sub-component
// ---------------------------------------------------------------------------

function ReplyList({
  replies,
  isLoading,
  loadError,
  currentUserId,
  onDelete,
}: {
  replies: ApiStatusReplyRecord[];
  isLoading: boolean;
  loadError: string | null;
  currentUserId: string | null;
  onDelete: (reply: ApiStatusReplyRecord) => void;
}) {
  if (isLoading) {
    return <ListSkeleton count={2} />;
  }

  if (loadError) {
    return (
      <p className="py-6 text-center text-sm text-red-500">{loadError}</p>
    );
  }

  if (replies.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-[#7a8595]">
        No replies yet. Start the conversation!
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {replies.map((reply) => (
        <li key={reply.id} className="flex items-start gap-2">
          <UserInitialAvatar userId={reply.userId} />
          <div className="flex-1 rounded-xl bg-[#f3f5f8] px-3 py-2">
            <p className="text-sm text-[#1f2733]">{reply.text}</p>
            <p className="mt-0.5 text-xs text-[#b0bac5]">
              {formatRelativeTime(reply.createdAt)}
            </p>
          </div>
          {currentUserId === reply.userId ? (
            <button
              type="button"
              onClick={() => onDelete(reply)}
              aria-label="Delete reply"
              className="mt-1 rounded p-1 text-[#b0bac5] hover:text-red-500"
            >
              <Trash2 size={14} />
            </button>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Shows a deterministic coloured initial circle derived from the userId string. */
function UserInitialAvatar({ userId }: { userId: string }) {
  const PALETTE = [
    "#3aa757",
    "#4294F7",
    "#EB72B6",
    "#FF9B42",
    "#B184F5",
    "#F3C623",
  ];
  const colorIndex =
    userId
      .split("")
      .reduce((acc, char) => acc + char.charCodeAt(0), 0) % PALETTE.length;
  const bg = PALETTE[colorIndex];
  const initial = userId.trim().charAt(0).toUpperCase() || "?";

  return (
    <span
      className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
      style={{ backgroundColor: bg }}
    >
      {initial}
    </span>
  );
}

function ListSkeleton({ count }: { count: number }) {
  return (
    <ul className="flex flex-col gap-3">
      {Array.from({ length: count }).map((_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: skeleton list, order is stable
        <li key={i} className="flex items-start gap-2">
          <div className="h-8 w-8 flex-shrink-0 animate-pulse rounded-full bg-[#e7ebf1]" />
          <div className="flex flex-1 flex-col gap-1.5 pt-1">
            <div className="h-3 w-3/4 animate-pulse rounded bg-[#e7ebf1]" />
            <div className="h-2.5 w-1/2 animate-pulse rounded bg-[#e7ebf1]" />
          </div>
        </li>
      ))}
    </ul>
  );
}

function formatRelativeTime(isoString: string | null): string {
  if (!isoString) return "";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "";

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60_000);

  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  return "Yesterday";
}
