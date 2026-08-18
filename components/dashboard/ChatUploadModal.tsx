"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";
import { Upload } from "lucide-react";
import { Modal } from "@/components/ui/Modal";

export type ChatUploadMode = "drag" | "browse";

type ChatUploadModalProps = {
  isOpen: boolean;
  mode: ChatUploadMode;
  onClose: () => void;
  onModeChange: (mode: ChatUploadMode) => void;
  onFilesSelected?: (files: File[]) => void;
  allowDragDrop?: boolean;
};

const FILE_TYPES = [
  { label: "PDF", color: "#E84D3D", accept: ".pdf,application/pdf" },
  {
    label: "XLS",
    color: "#49A861",
    accept:
      ".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  },
  {
    label: "DOC",
    color: "#4B78C2",
    accept:
      ".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  },
  {
    label: "PPT",
    color: "#F0A12F",
    accept:
      ".ppt,.pptx,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation",
  },
  { label: "TXT", color: "#9AA0A8", accept: ".txt,text/plain" },
  { label: "JPG", color: "#D454CB", accept: ".jpg,.jpeg,image/jpeg" },
  { label: "MP4", color: "#D95C9A", accept: ".mp4,video/mp4" },
  { label: "MP3", color: "#33AEF4", accept: ".mp3,audio/mpeg" },
  { label: "ZIP", color: "#E7B05F", accept: ".zip,application/zip" },
] as const;

export function ChatUploadModal({
  isOpen,
  mode,
  onClose,
  onModeChange,
  onFilesSelected,
  allowDragDrop = true,
}: ChatUploadModalProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const dragDepthRef = useRef(0);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const resolvedMode = allowDragDrop ? mode : "browse";

  const commitFiles = useCallback(
    (files: File[]) => {
      if (files.length === 0) return;
      onFilesSelected?.(files);
      setIsDraggingOver(false);
      onClose();
    },
    [onClose, onFilesSelected],
  );

  useEffect(() => {
    if (!isOpen || resolvedMode !== "drag") {
      return;
    }

    const extractDroppedFiles = (event: globalThis.DragEvent) => {
      if (!event.dataTransfer) {
        return [];
      }

      return Array.from(event.dataTransfer.files ?? []);
    };

    const preventBrowserFileHandling = (event: globalThis.DragEvent) => {
      event.preventDefault();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = "copy";
      }
    };

    const handleWindowDrop = (event: globalThis.DragEvent) => {
      const droppedFiles = extractDroppedFiles(event);
      if (droppedFiles.length === 0) {
        return;
      }

      event.preventDefault();
      commitFiles(droppedFiles);
    };

    window.addEventListener("dragover", preventBrowserFileHandling);
    window.addEventListener("drop", handleWindowDrop);

    return () => {
      window.removeEventListener("dragover", preventBrowserFileHandling);
      window.removeEventListener("drop", handleWindowDrop);
    };
  }, [commitFiles, isOpen, resolvedMode]);

  const openFilePicker = (accept?: string) => {
    if (!inputRef.current) {
      return;
    }

    inputRef.current.accept = accept ?? "";
    inputRef.current.click();
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextFiles = Array.from(event.target.files ?? []);
    commitFiles(nextFiles);
    event.target.value = "";
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current = 0;
    setIsDraggingOver(false);
    commitFiles(Array.from(event.dataTransfer.files ?? []));
  };

  const handleDragEnter = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (resolvedMode !== "drag") {
      return;
    }

    dragDepthRef.current += 1;
    setIsDraggingOver(true);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (resolvedMode !== "drag") {
      return;
    }

    event.dataTransfer.dropEffect = "copy";
    setIsDraggingOver(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (resolvedMode !== "drag") {
      return;
    }

    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) {
      setIsDraggingOver(false);
    }
  };

  return (
    <>
      <input
        id={inputId}
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleInputChange}
      />

      <Modal
        isOpen={isOpen}
        onClose={() => {
          setIsDraggingOver(false);
          onClose();
        }}
        className={`!rounded-[40px] !bg-transparent !p-0 shadow-none overflow-visible ${
          resolvedMode === "drag"
            ? "!w-[min(94vw,520px)] !max-w-[520px]"
            : "!w-[min(92vw,372px)] !max-w-[372px]"
        }`}
      >
        <div
          onDragEnter={resolvedMode === "drag" ? handleDragEnter : undefined}
          onDragOver={resolvedMode === "drag" ? handleDragOver : undefined}
          onDragLeave={resolvedMode === "drag" ? handleDragLeave : undefined}
          onDrop={resolvedMode === "drag" ? handleDrop : undefined}
          className="rounded-[40px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.94)_0%,rgba(234,239,246,0.96)_100%)] p-[10px] shadow-[0_32px_90px_rgba(26,20,15,0.34),inset_0_1px_0_rgba(255,255,255,0.88)] backdrop-blur-[18px]"
        >
          <div
            className={`rounded-[32px] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.96)_0%,rgba(242,245,250,0.98)_45%,rgba(231,236,244,1)_100%)] px-4 pb-5 pt-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.92)] ${
              resolvedMode === "drag" ? "sm:px-5 sm:pb-6" : ""
            }`}
          >
            <div className="rounded-full border border-white/80 bg-[#E8EDF5] p-[6px] shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_10px_28px_rgba(76,59,43,0.12)]">
              {!allowDragDrop ? (
                <div className="flex items-center justify-center">
                  <button
                    onClick={() => openFilePicker()}
                    className="rounded-full border border-[#C8D1E1] bg-[linear-gradient(180deg,#F9FBFF_0%,#E9EEF8_100%)] px-5 py-4 text-[14px] font-medium tracking-[-0.02em] text-[#2D3652] shadow-[inset_0_1px_0_rgba(255,255,255,0.95)]"
                  >
                    Browse files
                  </button>
                </div>
              ) : resolvedMode === "drag" ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onModeChange("drag")}
                    className="rounded-full border border-[#C8D1E1] bg-[linear-gradient(180deg,#F9FBFF_0%,#E9EEF8_100%)] px-5 py-4 text-[14px] font-medium tracking-[-0.02em] text-[#2D3652] shadow-[inset_0_1px_0_rgba(255,255,255,0.95)]"
                  >
                    Drag your file here
                  </button>
                  <button
                    onClick={() => onModeChange("browse")}
                    className="flex-1 rounded-full px-4 py-4 text-[14px] font-medium tracking-[-0.02em] text-[#2D3652]"
                  >
                    Direct Browse
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <button
                    onClick={() => onModeChange("drag")}
                    className="rounded-full px-4 py-4 text-[14px] font-medium tracking-[-0.02em] text-[#2D3652]"
                  >
                    Drag your file here
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openFilePicker()}
                      className="rounded-full border border-[#C8D1E1] bg-[linear-gradient(180deg,#F9FBFF_0%,#E9EEF8_100%)] px-5 py-4 text-[14px] font-medium tracking-[-0.02em] text-[#2D3652] shadow-[inset_0_1px_0_rgba(255,255,255,0.95)]"
                    >
                      Direct
                    </button>
                    <button
                      onClick={() => openFilePicker()}
                      className="rounded-full px-3 py-4 text-[14px] font-medium tracking-[-0.02em] text-[#2D3652]"
                    >
                      Browse
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4 rounded-[32px] bg-[linear-gradient(135deg,#F1A752_0%,#6E49FF_18%,#D7DCE7_68%,#F2B66A_100%)] p-[3px] shadow-[0_18px_40px_rgba(77,67,57,0.12)]">
                <div
                  onDragEnter={resolvedMode === "drag" ? handleDragEnter : undefined}
                  onDragOver={resolvedMode === "drag" ? handleDragOver : undefined}
                  onDragLeave={resolvedMode === "drag" ? handleDragLeave : undefined}
                  onDrop={resolvedMode === "drag" ? handleDrop : undefined}
                  onClick={
                    resolvedMode === "browse" ? () => openFilePicker() : undefined
                  }
                  className={`flex rounded-[29px] border border-white/80 bg-[radial-gradient(circle_at_top,rgba(249,251,255,0.98)_0%,rgba(239,243,249,0.98)_42%,rgba(233,237,244,1)_100%)] px-5 py-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.95)] ${
                    resolvedMode === "drag"
                      ? "h-[260px] sm:h-[300px] sm:px-8 sm:py-8"
                      : "h-[194px]"
                  } ${
                    resolvedMode === "browse"
                      ? "cursor-pointer items-center justify-center"
                      : "items-center justify-center"
                  } ${
                    isDraggingOver
                      ? "shadow-[inset_0_0_0_1px_rgba(109,79,255,0.38),0_0_0_4px_rgba(104,76,255,0.08)]"
                      : ""
                  }`}
                >
                  {resolvedMode === "drag" ? (
                    <UploadStackIllustration isActive={isDraggingOver} />
                  ) : (
                  <div className="flex h-full w-full items-center justify-center px-2 py-1">
                    <div className="grid w-full max-w-[220px] grid-cols-3 place-items-center gap-x-4 gap-y-5">
                      {FILE_TYPES.map((fileType) => (
                        <FileTypeBadge
                          key={fileType.label}
                          label={fileType.label}
                          color={fileType.color}
                          onClick={() => openFilePicker(fileType.accept)}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
}

function UploadStackIllustration({ isActive }: { isActive: boolean }) {
  return (
    <div className="relative flex h-[170px] w-[170px] items-center justify-center rounded-full border border-white/70 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.82)_0%,rgba(238,242,247,0.58)_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.95)] sm:h-[210px] sm:w-[210px]">
      <div className="absolute left-1/2 top-1/2 h-[84px] w-[84px] -translate-x-1/2 -translate-y-1/2 rounded-[22px] bg-white/40 blur-[10px] sm:h-[110px] sm:w-[110px]" />
      <svg
        width="110"
        height="110"
        viewBox="0 0 72 72"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`transition-transform duration-200 ${isActive ? "scale-105" : ""}`}
      >
        <rect x="23" y="8" width="28" height="36" rx="5" fill="#D9DFEA" />
        <rect x="18" y="18" width="28" height="36" rx="5" fill="#E7EBF3" />
        <path
          d="M31 14H46L53 21V45C53 47.2091 51.2091 49 49 49H31C28.7909 49 27 47.2091 27 45V18C27 15.7909 28.7909 14 31 14Z"
          fill="#CAD3E1"
        />
        <path d="M46 14V21H53" fill="#E4EAF4" />
        <rect x="12" y="29" width="22" height="4" rx="2" fill="#C2CCDA" />
        <rect x="10" y="38" width="18" height="4" rx="2" fill="#C8D2DE" />
        <rect x="45" y="39" width="16" height="4" rx="2" fill="#C8D2DE" />
        <rect x="42" y="47" width="20" height="4" rx="2" fill="#D0D7E2" />
      </svg>
      <div className="absolute bottom-6 left-1/2 flex h-[52px] w-[52px] -translate-x-1/2 items-center justify-center rounded-full bg-[linear-gradient(180deg,#4FC3B0_0%,#38AA97_100%)] text-white shadow-[0_12px_20px_rgba(56,170,151,0.28)] sm:bottom-7 sm:h-[60px] sm:w-[60px]">
        <Upload className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={2.5} />
      </div>
    </div>
  );
}

function FileTypeBadge({
  label,
  color,
  onClick,
}: {
  label: string;
  color: string;
  onClick?: () => void;
}) {
  const className = `flex h-[40px] w-[34px] flex-col overflow-hidden rounded-[9px] bg-white shadow-[0_10px_20px_rgba(89,81,71,0.12)] ${
    onClick
      ? "cursor-pointer transition-transform duration-150 hover:-translate-y-0.5 hover:shadow-[0_14px_24px_rgba(89,81,71,0.16)]"
      : ""
  }`;

  const content = (
    <>
      <div className="flex-1 bg-[linear-gradient(180deg,#FFFFFF_0%,#F4F4F4_100%)]" />
      <div
        className="flex h-[17px] items-center justify-center text-[9px] font-extrabold tracking-[0.04em] text-white"
        style={{ backgroundColor: color }}
      >
        {label}
      </div>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onClick();
        }}
        className={className}
        aria-label={`Choose ${label} files`}
      >
        {content}
      </button>
    );
  }

  return (
    <div className={className}>
      {content}
    </div>
  );
}
