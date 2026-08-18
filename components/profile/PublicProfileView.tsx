"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Link as LinkIcon,
  Loader2,
  Mail,
  Send,
} from "lucide-react";

import {
  fetchPublicProfile,
  sendPublicDm,
  type ApiPublicProfileRecord,
} from "@/utils/scuibApi";

type Props = {
  username: string;
};

type FormState = "idle" | "sending" | "sent";

export function PublicProfileView({ username }: Props) {
  const [profile, setProfile] = useState<ApiPublicProfileRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [senderEmail, setSenderEmail] = useState("");
  const [message, setMessage] = useState("");
  const [formState, setFormState] = useState<FormState>("idle");
  const [formError, setFormError] = useState<string | null>(null);
  const [promptLogin, setPromptLogin] = useState(false);

  useEffect(() => {
    let isActive = true;

    fetchPublicProfile(username)
      .then((result) => {
        if (!isActive) return;
        if (result === null) {
          setLoadError("This profile doesn't exist or has been removed.");
        } else {
          setProfile(result);
        }
      })
      .catch(() => {
        if (isActive) {
          setLoadError("Couldn't load this profile right now. Please try again.");
        }
      })
      .finally(() => {
        if (isActive) setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [username]);

  async function handleSend() {
    setFormError(null);
    setPromptLogin(false);

    const trimmedEmail = senderEmail.trim();
    const trimmedMessage = message.trim();

    if (!trimmedEmail) {
      setFormError("Please enter your email address.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setFormError("Please enter a valid email address.");
      return;
    }

    if (!trimmedMessage) {
      setFormError("Please write a message before sending.");
      return;
    }

    setFormState("sending");

    const result = await sendPublicDm(username, {
      senderEmail: trimmedEmail,
      content: trimmedMessage,
    });

    if (result.ok) {
      setFormState("sent");
      return;
    }

    setFormState("idle");

    if (result.errorType === "email_registered") {
      setPromptLogin(true);
    }

    setFormError(result.message);
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FBF8F4]">
        <Loader2 className="h-8 w-8 animate-spin text-[#6A4227]" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#FBF8F4] px-6 text-center">
        <p className="text-[17px] font-semibold text-[#5B3B29]">{loadError}</p>
        <Link href="/" className="text-sm font-medium text-[#6A4227] underline">
          Go to Scuib Chat
        </Link>
      </div>
    );
  }

  if (!profile) return null;

  const displayName = profile.username ?? username;
  const initial = displayName.trim().charAt(0).toUpperCase() || "?";

  return (
    <div className="min-h-screen bg-[#FBF8F4]">
      {/* Header */}
      <div className="relative h-[180px] overflow-hidden bg-[#465728] px-6 pb-6 pt-5">
        <div className="relative z-10 flex items-center gap-3 text-white">
          <Link
            href="/"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/30"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <span className="text-[18px] font-extrabold tracking-tight">
            Profile
          </span>
        </div>
      </div>

      <div className="relative px-6 pb-16">
        {/* Avatar */}
        <div className="flex justify-center">
          <div className="-mt-[56px] flex h-[110px] w-[110px] items-center justify-center overflow-hidden rounded-full border-4 border-[#FBF8F4] bg-[#E5EAD7] shadow-lg">
            {profile.avatarUrl ? (
              <Image
                src={profile.avatarUrl}
                alt={displayName}
                fill
                sizes="110px"
                className="object-cover"
              />
            ) : (
              <span className="text-3xl font-extrabold text-[#6A4227]">
                {initial}
              </span>
            )}
          </div>
        </div>

        {/* Name + bio */}
        <div className="mt-4 text-center">
          <h1 className="text-[22px] font-extrabold tracking-tight text-[#1f2733]">
            {displayName}
          </h1>
          {profile.bio ? (
            <p className="mt-2 text-sm leading-relaxed text-[#7a8595]">
              {profile.bio}
            </p>
          ) : null}
        </div>

        {/* Social links */}
        {(profile.xUrl || profile.linkedinUrl || profile.portfolioUrl || profile.email) ? (
          <div className="mt-4 flex items-center justify-center gap-4 text-[#6A4227]">
            {profile.xUrl ? (
              <a
                href={normalizeUrl(profile.xUrl)}
                target="_blank"
                rel="noreferrer"
                aria-label="X profile"
                className="text-xl font-extrabold hover:opacity-70"
              >
                X
              </a>
            ) : null}
            {profile.linkedinUrl ? (
              <a
                href={normalizeUrl(profile.linkedinUrl)}
                target="_blank"
                rel="noreferrer"
                aria-label="LinkedIn profile"
                className="flex h-7 w-7 items-center justify-center rounded-[4px] bg-[#0A66C2] text-sm font-extrabold text-white hover:opacity-80"
              >
                in
              </a>
            ) : null}
            {profile.portfolioUrl ? (
              <a
                href={normalizeUrl(profile.portfolioUrl)}
                target="_blank"
                rel="noreferrer"
                aria-label="Portfolio"
                className="hover:opacity-70"
              >
                <LinkIcon className="h-6 w-6" />
              </a>
            ) : null}
            {profile.email ? (
              <a
                href={`mailto:${profile.email}`}
                aria-label="Email"
                className="hover:opacity-70"
              >
                <Mail className="h-6 w-6" />
              </a>
            ) : null}
          </div>
        ) : null}

        {/* Skills + categories */}
        {profile.skills.length > 0 || profile.categories.length > 0 ? (
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {[...profile.categories, ...profile.skills].map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-[#D9C6BA] px-3 py-1 text-xs font-medium text-[#6A4227]"
              >
                {tag}
              </span>
            ))}
          </div>
        ) : null}

        {/* Guest DM form */}
        <div className="mx-auto mt-8 max-w-[480px]">
          {formState === "sent" ? (
            <div className="rounded-2xl bg-[#E8F5E9] px-6 py-8 text-center">
              <p className="text-[17px] font-extrabold text-[#2E7D32]">
                Message sent!
              </p>
              <p className="mt-2 text-sm text-[#388E3C]">
                Check your email — we&apos;ve sent you a link so you can claim your
                messages and keep the conversation going.
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-[#E9DBD3] bg-white px-6 py-6 shadow-sm">
              <h2 className="text-[16px] font-extrabold text-[#1f2733]">
                Send a message
              </h2>
              <p className="mt-1 text-xs text-[#7a8595]">
                No account needed — just enter your email and message below.
              </p>

              <div className="mt-4 flex flex-col gap-3">
                <div>
                  <label
                    htmlFor="sender-email"
                    className="mb-1 block text-xs font-semibold text-[#5B3B29]"
                  >
                    Your email address
                  </label>
                  <input
                    id="sender-email"
                    type="email"
                    value={senderEmail}
                    onChange={(e) => setSenderEmail(e.target.value)}
                    placeholder="you@example.com"
                    disabled={formState === "sending"}
                    className="w-full rounded-xl border border-[#D9C6BA] bg-[#FBF8F4] px-4 py-3 text-sm text-[#1f2733] placeholder:text-[#b0a090] focus:border-[#6A4227] focus:outline-none disabled:opacity-50"
                  />
                </div>

                <div>
                  <label
                    htmlFor="dm-message"
                    className="mb-1 block text-xs font-semibold text-[#5B3B29]"
                  >
                    Message
                  </label>
                  <textarea
                    id="dm-message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={`Say hi to ${displayName}…`}
                    rows={4}
                    disabled={formState === "sending"}
                    className="w-full resize-none rounded-xl border border-[#D9C6BA] bg-[#FBF8F4] px-4 py-3 text-sm text-[#1f2733] placeholder:text-[#b0a090] focus:border-[#6A4227] focus:outline-none disabled:opacity-50"
                  />
                </div>

                {formError ? (
                  <p className="rounded-lg bg-[#FFF3E0] px-4 py-2 text-sm text-[#E65100]">
                    {formError}
                  </p>
                ) : null}

                {promptLogin ? (
                  <Link
                    href="/signin"
                    className="text-center text-sm font-semibold text-[#6A4227] underline"
                  >
                    Sign in to your account instead →
                  </Link>
                ) : null}

                <button
                  type="button"
                  onClick={() => void handleSend()}
                  disabled={formState === "sending"}
                  className="flex items-center justify-center gap-2 rounded-full bg-[#6A4227] py-3 text-sm font-extrabold text-white disabled:opacity-50"
                >
                  {formState === "sending" ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Sending…
                    </>
                  ) : (
                    <>
                      Send message
                      <Send className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          <p className="mt-6 text-center text-xs text-[#b0a090]">
            Already have an account?{" "}
            <Link href="/signin" className="font-semibold text-[#6A4227] underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function normalizeUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return "#";
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  return `https://${trimmed}`;
}
