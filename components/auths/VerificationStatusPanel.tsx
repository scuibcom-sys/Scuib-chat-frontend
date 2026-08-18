import Link from "next/link";
import type { ReactNode } from "react";
import { CheckCircle2, MailCheck, ShieldAlert } from "lucide-react";

export function VerificationStatusPanel({
  badge,
  title,
  description,
  tone,
  primaryAction,
  secondaryAction,
  footer,
}: {
  badge: string;
  title: string;
  description: string;
  tone: "success" | "warning";
  primaryAction: {
    href: string;
    label: string;
    icon?: ReactNode;
  };
  secondaryAction?: {
    href: string;
    label: string;
    icon?: ReactNode;
  };
  footer?: string;
}) {
  const toneStyles =
    tone === "success"
      ? {
          icon: <CheckCircle2 className="h-8 w-8 text-[#4E7C2F]" />,
          badgeClassName: "bg-[#EFF6E3] text-[#5F7F33]",
          iconWrapClassName: "bg-[#EEF5E1]",
          gradientClassName:
            "bg-[linear-gradient(135deg,#E6F0D4_0%,#F9F3E7_55%,#FFFDF9_100%)]",
          titleClassName: "text-[#4F3422]",
        }
      : {
          icon: <ShieldAlert className="h-8 w-8 text-[#A4591D]" />,
          badgeClassName: "bg-[#FFF1E5] text-[#A4591D]",
          iconWrapClassName: "bg-[#FFF1E5]",
          gradientClassName:
            "bg-[linear-gradient(135deg,#FFF1E5_0%,#F9F3E7_55%,#FFFDF9_100%)]",
          titleClassName: "text-[#4F3422]",
        };

  return (
    <div className="overflow-hidden rounded-[34px] border border-white/70 bg-white/95 shadow-[0_30px_80px_rgba(79,52,34,0.12)] backdrop-blur">
      <div className={`px-6 py-8 sm:px-8 sm:py-10 ${toneStyles.gradientClassName}`}>
        <div
          className={`inline-flex rounded-full px-4 py-2 text-[11px] font-extrabold uppercase tracking-[0.24em] shadow-[0_10px_24px_rgba(79,52,34,0.08)] sm:text-xs ${toneStyles.badgeClassName}`}
        >
          {badge}
        </div>

        <div className="mt-6 flex items-center gap-4">
          <div
            className={`flex h-16 w-16 items-center justify-center rounded-[22px] shadow-[0_18px_40px_rgba(79,52,34,0.08)] ${toneStyles.iconWrapClassName}`}
          >
            {toneStyles.icon}
          </div>

          <div className="flex h-16 w-16 items-center justify-center rounded-[22px] bg-white/80 shadow-[0_18px_40px_rgba(79,52,34,0.08)]">
            <MailCheck className="h-8 w-8 text-[#8F654B]" />
          </div>
        </div>

        <h1
          className={`mt-7 max-w-[14ch] text-[clamp(2.1rem,7vw,3.4rem)] font-extrabold leading-[0.95] tracking-[-0.06em] ${toneStyles.titleClassName}`}
        >
          {title}
        </h1>

        <p className="mt-5 max-w-[34rem] text-base font-medium leading-7 text-[#736B66] sm:text-lg sm:leading-8">
          {description}
        </p>
      </div>

      <div className="px-6 py-6 sm:px-8 sm:py-8">
        <div className="rounded-[24px] bg-[#F8F5F1] p-5 text-sm font-semibold leading-7 text-[#6D645E] sm:text-base">
          <p>What happens next:</p>
          <p className="mt-2">Your account is ready to move forward from the email step.</p>
          <p>Use the button below to return to the app and continue.</p>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Link
            href={primaryAction.href}
            className="inline-flex items-center justify-center gap-3 rounded-full bg-[#4F3422] px-6 py-4 text-base font-extrabold text-white shadow-[0_18px_40px_rgba(79,52,34,0.14)] transition-transform hover:scale-[1.01]"
          >
            {primaryAction.label}
            {primaryAction.icon}
          </Link>

          {secondaryAction ? (
            <Link
              href={secondaryAction.href}
              className="inline-flex items-center justify-center gap-3 rounded-full border border-[#4F3422]/12 bg-white px-6 py-4 text-base font-extrabold text-[#4F3422] transition-colors hover:bg-[#FAF7F3]"
            >
              {secondaryAction.label}
              {secondaryAction.icon}
            </Link>
          ) : null}
        </div>

        {footer ? (
          <p className="mt-5 text-sm font-medium leading-6 text-[#8F654B]">
            {footer}
          </p>
        ) : null}
      </div>
    </div>
  );
}
