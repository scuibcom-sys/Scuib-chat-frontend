"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Image as ImageIcon, Type, X } from "lucide-react";

import { useAuthStore } from "@/store/authStore";
import { ApiError, DEFAULT_GROUP_ACCENT_CHOICES, type AuthTokens } from "@/utils/scuibApi";
import {
  createMediaStatus,
  createTextStatus,
  uploadStatusMedia,
  type ApiStatusRecord,
} from "@/utils/scuibStatusApi";

const STATUS_BACKGROUND_CHOICES = DEFAULT_GROUP_ACCENT_CHOICES;
const MAX_STATUS_TEXT_LENGTH = 280;

type StatusComposerProps = {
  onClose: () => void;
  onPosted: (status: ApiStatusRecord) => void;
};

export function StatusComposer({ onClose, onPosted }: StatusComposerProps) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const refreshToken = useAuthStore((state) => state.refreshToken);
  const tokenType = useAuthStore((state) => state.tokenType);
  const setTokens = useAuthStore((state) => state.setTokens);

  const [text, setText] = useState("");
  const [backgroundColor, setBackgroundColor] = useState<string>(STATUS_BACKGROUND_CHOICES[0]);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [isPosting, setIsPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAuthRefresh = useCallback(
    (refreshedTokens: AuthTokens) => {
      setTokens(refreshedTokens.accessToken, refreshedTokens.refreshToken, refreshedTokens.tokenType);
    },
    [setTokens],
  );

  const tokens: Partial<AuthTokens> = { accessToken, refreshToken, tokenType };

  function handleFileSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setPostError(null);
    setPendingFile(file);
    event.target.value = "";
  }

  async function handlePost() {
    if (isPosting) return;
    setPostError(null);

    if (pendingFile) {
      setIsPosting(true);
      try {
        const contentType = pendingFile.type.startsWith("video/")
          ? "video"
          : pendingFile.type.startsWith("image/")
            ? "image"
            : "file";
        const uploaded = await uploadStatusMedia(pendingFile, contentType, tokens, handleAuthRefresh);
        const created = await createMediaStatus(uploaded, tokens, handleAuthRefresh);
        onPosted(created);
        onClose();
      } catch (error) {
        setPostError(
          error instanceof ApiError
            ? error.message
            : "Something went wrong posting your status. Please try again.",
        );
      } finally {
        setIsPosting(false);
      }
      return;
    }

    const trimmed = text.trim();
    if (!trimmed) {
      setPostError("Write something before posting, or attach a photo or video.");
      return;
    }

    setIsPosting(true);
    try {
      const created = await createTextStatus({ text: trimmed, backgroundColor }, tokens, handleAuthRefresh);
      // The server's 201 response may omit background_color; patch it from
      // local state so the viewer renders the colour the user actually chose.
      onPosted({ ...created, backgroundColor });
      onClose();
    } catch (error) {
      setPostError(
        error instanceof ApiError ? error.message : "Couldn't post your status. Please try again.",
      );
    } finally {
      setIsPosting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div
        className="relative flex h-full w-full max-w-[480px] flex-col sm:h-[92vh] sm:rounded-2xl"
        style={{ backgroundColor: pendingFile ? "#000000" : backgroundColor }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          className="hidden"
          onChange={handleFileSelected}
        />

        <div className="flex items-center justify-between px-4 pt-6">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-2 text-white/90 hover:bg-white/10"
          >
            <X size={22} />
          </button>

          <div className="flex items-center gap-1">
            {!pendingFile ? (
              <span className="flex items-center gap-1.5 rounded-full bg-white/15 px-2 py-1.5">
                {STATUS_BACKGROUND_CHOICES.map((color) => (
                  <button
                    key={color}
                    type="button"
                    aria-label={`Use background ${color}`}
                    onClick={() => setBackgroundColor(color)}
                    className={`h-6 w-6 rounded-full border-2 transition-transform ${
                      backgroundColor === color ? "scale-110 border-white" : "border-transparent"
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setPendingFile(null)}
                aria-label="Remove attached photo or video"
                className="rounded-full p-2 text-white/90 hover:bg-white/10"
              >
                <Type size={20} />
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center px-6">
          {pendingFile ? (
            <StatusMediaPreview key={`${pendingFile.name}-${pendingFile.size}`} file={pendingFile} />
          ) : (
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value.slice(0, MAX_STATUS_TEXT_LENGTH))}
              placeholder="Type a status"
              autoFocus
              rows={4}
              className="w-full resize-none border-none bg-transparent text-center text-2xl font-semibold leading-relaxed text-white placeholder:text-white/70 focus:outline-none"
            />
          )}
        </div>

        {!pendingFile ? (
          <div className="flex justify-center gap-3 px-4 pb-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 rounded-full bg-white/15 px-4 py-2 text-sm font-medium text-white"
            >
              <ImageIcon size={16} />
              Photo or video
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 rounded-full bg-white/15 px-4 py-2 text-sm font-medium text-white"
            >
              <Camera size={16} />
              Camera
            </button>
          </div>
        ) : null}

        {postError ? (
          <p className="px-6 pb-2 text-center text-sm text-white/95">{postError}</p>
        ) : null}

        <div className="px-4 pb-6">
          <button
            type="button"
            onClick={() => void handlePost()}
            disabled={isPosting || (!text.trim() && !pendingFile)}
            className="w-full rounded-full bg-white py-3 text-center text-base font-semibold text-[#1f2733] disabled:opacity-50"
          >
            {isPosting ? "Posting…" : "Post status"}
          </button>

          {!text.trim() && !pendingFile ? null : (
            <p className="mt-2 text-center text-xs text-white/70">
              {pendingFile
                ? "Photo and video statuses depend on a backend upload step that's not live yet — posting will show a clear error until that's ready."
                : `${text.trim().length}/${MAX_STATUS_TEXT_LENGTH}`}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Owns its own object-URL lifecycle in complete isolation. Mounted fresh
 * (via `key` from the parent) whenever a different file is picked, so the
 * URL is created exactly once via useState's lazy initializer — which runs
 * during the initial render of this specific mount, not reactively inside
 * an effect — and is revoked only on unmount. This sidesteps
 * react-hooks/set-state-in-effect entirely, since no setState call ever
 * happens inside an effect body here.
 */
function StatusMediaPreview({ file }: { file: File }) {
  const [previewUrl] = useState(() => URL.createObjectURL(file));

  useEffect(() => {
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  if (file.type.startsWith("video/")) {
    return <video src={previewUrl} controls className="max-h-full max-w-full object-contain" />;
  }

  return (
    <div className="relative h-full w-full">
      <Image src={previewUrl} alt="Selected status media" fill sizes="480px" className="object-contain" unoptimized />
    </div>
  );
}
