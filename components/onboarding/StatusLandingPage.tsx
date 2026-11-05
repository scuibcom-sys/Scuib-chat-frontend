"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { LogoIcon, EyeIcon } from "@/utils/icons";
import {
  Users,
  MessageCircle,
  User,
  Play,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Heart,
  Send,
  X,
} from "lucide-react";

// ─── Mock data ───────────────────────────────────────────────────────────────

type MockStatus = {
  id: string;
  name: string;
  avatarColor: string;
  avatarInitials: string;
  imageUrl: string;
  caption: string;
  views: number;
  time: string;
  hasUnseen: boolean;
};

const MOCK_STATUSES: MockStatus[] = [
  {
    id: "arjun",
    name: "Arjun das",
    avatarColor: "#2D6A4F",
    avatarInitials: "AD",
    imageUrl:
      "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=800&q=80",
    caption: "Exploring new horizons 🌄",
    views: 247,
    time: "2h ago",
    hasUnseen: false,
  },
  {
    id: "elisa",
    name: "Elisa das",
    avatarColor: "#ED7E1C",
    avatarInitials: "ED",
    imageUrl:
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&q=80",
    caption: "Golden hour vibes ✨",
    views: 183,
    time: "4h ago",
    hasUnseen: true,
  },
  {
    id: "karthick",
    name: "Karthick...",
    avatarColor: "#4F3422",
    avatarInitials: "KV",
    imageUrl:
      "https://images.unsplash.com/photo-1522529599102-193c0d76b5b6?w=800&q=80",
    caption: "Late night coding sessions 💻",
    views: 312,
    time: "5h ago",
    hasUnseen: true,
  },
  {
    id: "antony",
    name: "Antony..",
    avatarColor: "#736B66",
    avatarInitials: "AM",
    imageUrl:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&q=80",
    caption: "New project dropping soon 🚀",
    views: 128,
    time: "8h ago",
    hasUnseen: false,
  },
  {
    id: "priya",
    name: "Priya S.",
    avatarColor: "#926247",
    avatarInitials: "PS",
    imageUrl:
      "https://images.unsplash.com/photo-1489424731084-a5d8b219a5bb?w=800&q=80",
    caption: "Weekend adventures 🏕️",
    views: 95,
    time: "10h ago",
    hasUnseen: true,
  },
  {
    id: "ravi",
    name: "Ravi K.",
    avatarColor: "#2B6BED",
    avatarInitials: "RK",
    imageUrl:
      "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=800&q=80",
    caption: "Shipped a new feature today! 🎉",
    views: 204,
    time: "12h ago",
    hasUnseen: false,
  },
];

// ─── Avatar bubble ────────────────────────────────────────────────────────────

function StoryAvatar({
  status,
  isActive,
  onClick,
  size = "md",
}: {
  status: MockStatus;
  isActive?: boolean;
  onClick: () => void;
  size?: "sm" | "md";
}) {
  const sizes = {
    sm: {
      outer: "h-14 w-14",
      inner: "h-12 w-12",
      text: "text-xs",
    },
    md: {
      outer: "h-16 w-16",
      inner: "h-[3.5rem] w-[3.5rem]",
      text: "text-sm",
    },
  };
  const s = sizes[size];

  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 flex-shrink-0 group"
      type="button"
    >
      <div
        className={`${s.outer} rounded-full p-[2.5px] transition-transform group-hover:scale-105`}
        style={{
          background: status.hasUnseen
            ? "conic-gradient(from 0deg, #ED7E1C, #4F3422, #926247, #ED7E1C)"
            : isActive
            ? "#4F3422"
            : "rgba(79,52,34,0.2)",
        }}
      >
        <div
          className={`${s.inner} rounded-full flex items-center justify-center text-white font-bold ${s.text} border-2 border-white`}
          style={{ backgroundColor: status.avatarColor }}
        >
          {status.avatarInitials}
        </div>
      </div>
      <span className="text-[11px] font-semibold text-[#4F3422] max-w-[3.5rem] truncate">
        {status.name}
      </span>
    </button>
  );
}

// ─── Progress bars ────────────────────────────────────────────────────────────

function StoryProgressBar({
  total,
  current,
  progress,
}: {
  total: number;
  current: number;
  progress: number;
}) {
  return (
    <div className="flex gap-1 w-full px-3 pt-3 absolute top-0 left-0 right-0 z-20">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className="flex-1 h-0.5 rounded-full bg-white/30 overflow-hidden"
        >
          <div
            className="h-full bg-white rounded-full"
            style={{
              width:
                i < current ? "100%" : i === current ? `${progress}%` : "0%",
              transition: i === current ? "none" : undefined,
            }}
          />
        </div>
      ))}
    </div>
  );
}

// ─── Status viewer ────────────────────────────────────────────────────────────

function StatusViewer({
  status,
  statusIndex,
  onNext,
  onPrev,
  hasPrev,
  hasNext,
}: {
  status: MockStatus;
  statusIndex: number;
  onNext: () => void;
  onPrev: () => void;
  hasPrev: boolean;
  hasNext: boolean;
}) {
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pausedAtRef = useRef<number>(0);
  const elapsedRef = useRef<number>(0);
  const DURATION = 6000;

  const startProgress = useCallback(() => {
    setProgress(0);
    elapsedRef.current = 0;
    const startTime = Date.now();
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      if (!pausedAtRef.current) {
        const elapsed = Date.now() - startTime + elapsedRef.current;
        const pct = Math.min((elapsed / DURATION) * 100, 100);
        setProgress(pct);
        if (pct >= 100) {
          clearInterval(intervalRef.current!);
          onNext();
        }
      }
    }, 50);
  }, [onNext]);

  useEffect(() => {
    startProgress();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status.id]);

  // Pause / resume handlers
  const handlePauseStart = useCallback(() => {
    setIsPaused(true);
    pausedAtRef.current = Date.now();
  }, []);

  const handlePauseEnd = useCallback(() => {
    if (pausedAtRef.current) {
      elapsedRef.current += Date.now() - pausedAtRef.current;
      pausedAtRef.current = 0;
    }
    setIsPaused(false);
  }, []);

  return (
    <div className="relative w-full h-full overflow-hidden bg-black">
      {/* Background image */}
      <AnimatePresence mode="wait">
        <motion.img
          key={status.id}
          src={status.imageUrl}
          alt={status.caption}
          className="absolute inset-0 w-full h-full object-cover"
          initial={{ opacity: 0, scale: 1.04 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        />
      </AnimatePresence>

      {/* Gradient overlays */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-transparent to-black/65 pointer-events-none" />

      {/* Progress bars */}
      <StoryProgressBar
        total={MOCK_STATUSES.length}
        current={statusIndex}
        progress={progress}
      />

      {/* Top header */}
      <div className="absolute top-6 left-0 right-0 flex items-center gap-3 px-4 z-10">
        <div
          className="h-9 w-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 border-2 border-white/60"
          style={{ backgroundColor: status.avatarColor }}
        >
          {status.avatarInitials}
        </div>
        <div className="flex-1">
          <p className="text-white text-sm font-bold leading-tight drop-shadow">
            {status.name}
          </p>
          <p className="text-white/70 text-xs drop-shadow">{status.time}</p>
        </div>
      </div>

      {/* Hold-to-pause overlay (covers the full area, behind tap zones) */}
      <div
        className="absolute inset-0 z-[5]"
        onPointerDown={handlePauseStart}
        onPointerUp={handlePauseEnd}
        onPointerLeave={handlePauseEnd}
      />

      {/* Invisible tap zones */}
      <button
        className="absolute left-0 top-0 w-1/3 h-full z-10 cursor-default"
        onClick={onPrev}
        disabled={!hasPrev}
        aria-label="Previous story"
      />
      <button
        className="absolute right-0 top-0 w-1/3 h-full z-10 cursor-default"
        onClick={onNext}
        aria-label="Next story"
      />

      {/* Pause indicator */}
      {isPaused && (
        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
          <div className="flex gap-1.5">
            <div className="w-1 h-7 rounded-full bg-white/80" />
            <div className="w-1 h-7 rounded-full bg-white/80" />
          </div>
        </div>
      )}

      {/* Desktop chevron buttons */}
      {hasPrev && (
        <button
          onClick={onPrev}
          className="hidden md:flex absolute left-3 top-1/2 -translate-y-1/2 z-20 h-9 w-9 items-center justify-center rounded-full bg-white/20 hover:bg-white/35 text-white backdrop-blur-sm transition-colors"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      )}
      {hasNext && (
        <button
          onClick={onNext}
          className="hidden md:flex absolute right-3 top-1/2 -translate-y-1/2 z-20 h-9 w-9 items-center justify-center rounded-full bg-white/20 hover:bg-white/35 text-white backdrop-blur-sm transition-colors"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      )}

      {/* Bottom overlay – caption + view count (above the CTA) */}
      <div className="absolute bottom-[7.5rem] md:bottom-6 left-0 right-0 px-4 z-10">
        <p className="text-white text-base font-semibold drop-shadow mb-2">
          {status.caption}
        </p>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 rounded-full bg-black/40 backdrop-blur-sm px-3 py-1.5">
            <EyeIcon className="h-4 w-4 text-white" />
            <span className="text-white text-xs font-bold">{status.views}</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/signin"
              className="text-white/80 hover:text-white transition-colors"
              aria-label="Like"
            >
              <Heart className="h-5 w-5" />
            </Link>
            <Link
              href="/signin"
              className="text-white/80 hover:text-white transition-colors"
              aria-label="Share"
            >
              <Send className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Desktop left icon rail ────────────────────────────────────────────────────

function DesktopRail() {
  return (
    <div className="hidden md:flex flex-col items-center gap-5 w-[60px] flex-shrink-0 bg-[#4F3422] py-5">
      <Link href="/signin" className="h-10 w-10 rounded-full bg-white/15 flex items-center justify-center hover:bg-white/25 transition-colors">
        <LogoIcon className="h-6 w-6 text-white brightness-0 invert" />
      </Link>
      <div className="flex-1 flex flex-col items-center gap-5 mt-2">
        {/* Status – active (current page, no redirect) */}
        <div className="relative">
          <button className="h-10 w-10 rounded-full bg-[#7B5138] flex items-center justify-center text-white cursor-default">
            <Play className="h-4 w-4 fill-white" />
          </button>
          <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-[#ED7E1C] flex items-center justify-center text-[9px] font-bold text-white">
            7
          </span>
        </div>
        <Link href="/signin" className="h-10 w-10 rounded-full hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-colors">
          <Users className="h-5 w-5" />
        </Link>
        <Link href="/signin" className="h-10 w-10 rounded-full hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-colors">
          <MessageCircle className="h-5 w-5" />
        </Link>
      </div>
      <Link href="/signin" className="h-10 w-10 rounded-full hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-colors">
        <User className="h-5 w-5" />
      </Link>
    </div>
  );
}

// ─── Desktop status list sidebar ───────────────────────────────────────────────

function DesktopStatusList({
  statuses,
  activeId,
  onSelect,
}: {
  statuses: MockStatus[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="hidden md:flex flex-col w-[280px] flex-shrink-0 bg-[#FAF6F1] border-r border-[#4F3422]/10">
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-[#4F3422]/10">
        <span className="text-[#4F3422] text-lg font-extrabold">Status</span>
        <Link href="/signin" className="text-[#4F3422]/50 hover:text-[#4F3422] transition-colors">
          <ChevronDown className="h-5 w-5" />
        </Link>
      </div>

      {/* My Status – sign in to add */}
      <Link href="/signin" className="px-4 py-3 border-b border-[#4F3422]/10 hover:bg-[#4F3422]/[0.04] transition-colors">
        <div className="flex items-center gap-3">
          <div className="relative flex-shrink-0">
            <div className="h-12 w-12 rounded-full bg-[#E8DED5] flex items-center justify-center border-2 border-[#4F3422]/15">
              <User className="h-5 w-5 text-[#4F3422]/40" />
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 h-5 w-5 rounded-full bg-[#2D6A4F] border-2 border-white flex items-center justify-center">
              <span className="text-white text-[10px] font-bold">+</span>
            </div>
          </div>
          <div>
            <p className="text-[#4F3422] text-sm font-bold">My Status</p>
            <p className="text-[#736B66] text-xs">Sign in to add status</p>
          </div>
        </div>
      </Link>

      {/* Contact list */}
      <div className="flex-1 overflow-y-auto">
        {statuses.map((s) => (
          <button
            key={s.id}
            onClick={() => onSelect(s.id)}
            className={`w-full flex items-center gap-3 px-4 py-3 transition-colors text-left ${
              s.id === activeId ? "bg-[#4F3422]/[0.07]" : "hover:bg-[#4F3422]/[0.04]"
            }`}
          >
            <div
              className="h-12 w-12 rounded-full flex-shrink-0 flex items-center justify-center text-white text-sm font-bold"
              style={{
                backgroundColor: s.avatarColor,
                outline: s.hasUnseen
                  ? "2px solid #ED7E1C"
                  : s.id === activeId
                  ? "2px solid #4F3422"
                  : "none",
                outlineOffset: "2px",
              }}
            >
              {s.avatarInitials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[#4F3422] text-sm font-bold truncate">{s.name}</p>
              <p className="text-[#736B66] text-xs">{s.time}</p>
            </div>
            {s.id === activeId && (
              <div className="h-2 w-2 rounded-full bg-[#ED7E1C] flex-shrink-0" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Mobile top header ─────────────────────────────────────────────────────────

function MobileHeader() {
  return (
    <div className="md:hidden flex items-center gap-3 px-4 py-3 bg-[#FAF6F1] border-b border-[#4F3422]/10 flex-shrink-0">
      <Link href="/signin" className="text-[#4F3422]/60 hover:text-[#4F3422] transition-colors">
        <Users className="h-6 w-6" />
      </Link>
      <Link href="/signin" className="ml-1 text-[#4F3422]/60 hover:text-[#4F3422] transition-colors">
        <MessageCircle className="h-6 w-6" />
      </Link>
      <div className="flex-1 flex justify-center">
        <span className="text-[#ED7E1C] text-[15px] font-extrabold">Status</span>
      </div>
      <Link href="/signin" className="text-[#4F3422]/60 hover:text-[#4F3422] transition-colors">
        <ChevronDown className="h-5 w-5" />
      </Link>
    </div>
  );
}

// ─── Mobile story strip ────────────────────────────────────────────────────────

function MobileStoryStrip({
  statuses,
  activeId,
  onSelect,
  collapsed,
  onToggleCollapse,
}: {
  statuses: MockStatus[];
  activeId: string;
  onSelect: (id: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}) {
  return (
    <div className="md:hidden bg-[#FAF6F1] flex-shrink-0 border-b border-[#4F3422]/10">
      {/* Collapse toggle bar */}
      <button
        type="button"
        onClick={onToggleCollapse}
        className="w-full flex items-center justify-center py-1 text-[#4F3422]/40 hover:text-[#4F3422]/70 transition-colors"
        aria-label={collapsed ? "Expand story strip" : "Collapse story strip"}
      >
        {collapsed ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronUp className="h-4 w-4" />
        )}
      </button>

      {/* Avatars row – collapses when toggled */}
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            key="strip"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <div className="flex gap-4 overflow-x-auto px-3 pb-3">
              {/* My status – sign in to add */}
              <Link href="/signin" className="flex flex-col items-center gap-1.5 flex-shrink-0">
                <div className="relative h-14 w-14 rounded-full bg-[#E8DED5] border-2 border-[#4F3422]/15 flex items-center justify-center">
                  <User className="h-5 w-5 text-[#4F3422]/40" />
                  <div className="absolute -bottom-0.5 -right-0.5 h-5 w-5 rounded-full bg-[#2D6A4F] border-2 border-white flex items-center justify-center">
                    <span className="text-white text-[10px] font-bold">+</span>
                  </div>
                </div>
                <span className="text-[11px] font-semibold text-[#4F3422]">My Status</span>
              </Link>

              {statuses.map((s) => (
                <StoryAvatar
                  key={s.id}
                  status={s}
                  isActive={s.id === activeId}
                  onClick={() => onSelect(s.id)}
                  size="sm"
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Desktop top bar ───────────────────────────────────────────────────────────

function DesktopTopBar() {
  return (
    <div className="hidden md:flex items-center justify-between px-6 py-3 bg-white/95 backdrop-blur-sm border-b border-[#4F3422]/10 flex-shrink-0">
      <div className="flex items-center gap-2">
        <div className="h-7 w-7 rounded-full bg-[#4F3422] flex items-center justify-center">
          <LogoIcon className="h-4 w-4 text-white brightness-0 invert" />
        </div>
        <span className="text-[#4F3422] text-base font-extrabold">Scuib Chat</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm text-[#736B66] font-medium hidden lg:block">
          Join the gifted ones 🌟
        </span>
        <Link
          href="/signin"
          className="px-4 py-1.5 rounded-full border border-[#4F3422]/20 text-[#4F3422] text-sm font-bold hover:bg-[#4F3422]/5 transition-colors"
        >
          Sign In
        </Link>
        <Link
          href="/signup"
          className="px-4 py-1.5 rounded-full bg-[#4F3422] text-white text-sm font-bold hover:bg-[#3d2718] transition-colors"
        >
          Sign Up
        </Link>
      </div>
    </div>
  );
}

// ─── Mobile Sign-in CTA overlay ────────────────────────────────────────────────

function MobileSignInCta() {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ delay: 0.5 }}
      className="md:hidden absolute bottom-0 left-0 right-0 z-30 p-4"
    >
      <div className="relative rounded-2xl bg-white/92 backdrop-blur-md shadow-[0_20px_60px_rgba(79,52,34,0.22)] p-4 border border-[#4F3422]/10">
        {/* Dismiss button */}
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Close"
          className="absolute top-2 right-2 h-6 w-6 flex items-center justify-center rounded-full bg-[#4F3422]/10 text-[#4F3422]/60 hover:bg-[#4F3422]/20 transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
        <p className="text-center text-[#4F3422] text-sm font-bold mb-3 pr-4">
          Join the gifted ones 🌟
        </p>
        <div className="flex gap-3">
          <Link
            href="/signup"
            className="flex-1 py-2.5 rounded-xl bg-[#4F3422] text-white text-sm font-bold text-center hover:bg-[#3d2718] transition-colors"
          >
            Sign Up
          </Link>
          <Link
            href="/signin"
            className="flex-1 py-2.5 rounded-xl border border-[#4F3422]/20 text-[#4F3422] text-sm font-bold text-center hover:bg-[#4F3422]/5 transition-colors"
          >
            Sign In
          </Link>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Root component ────────────────────────────────────────────────────────────

export function StatusLandingPage() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [stripCollapsed, setStripCollapsed] = useState(false);
  const activeStatus = MOCK_STATUSES[activeIndex];

  const handleNext = useCallback(() => {
    setActiveIndex((i) => Math.min(i + 1, MOCK_STATUSES.length - 1));
  }, []);

  const handlePrev = useCallback(() => {
    setActiveIndex((i) => Math.max(i - 1, 0));
  }, []);

  const handleSelect = useCallback((id: string) => {
    const idx = MOCK_STATUSES.findIndex((s) => s.id === id);
    if (idx !== -1) setActiveIndex(idx);
  }, []);

  return (
    <div className="flex flex-col h-[100dvh] overflow-hidden bg-[#FAF6F1]">
      {/* Desktop top bar */}
      <DesktopTopBar />

      <div className="flex flex-1 min-h-0">
        {/* Desktop icon rail */}
        <DesktopRail />

        {/* Desktop story list */}
        <DesktopStatusList
          statuses={MOCK_STATUSES}
          activeId={activeStatus.id}
          onSelect={handleSelect}
        />

        {/* Main content column */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          {/* Mobile header */}
          <MobileHeader />

          {/* Mobile story strip (collapsible) */}
          <MobileStoryStrip
            statuses={MOCK_STATUSES}
            activeId={activeStatus.id}
            onSelect={handleSelect}
            collapsed={stripCollapsed}
            onToggleCollapse={() => setStripCollapsed((v) => !v)}
          />

          {/* Viewer */}
          <div className="relative flex-1 min-h-0">
            <StatusViewer
              status={activeStatus}
              statusIndex={activeIndex}
              onNext={handleNext}
              onPrev={handlePrev}
              hasPrev={activeIndex > 0}
              hasNext={activeIndex < MOCK_STATUSES.length - 1}
            />

            {/* Mobile CTA */}
            <MobileSignInCta />
          </div>
        </div>
      </div>
    </div>
  );
}
