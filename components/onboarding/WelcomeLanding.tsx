"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRightIcon, LogoIcon } from "@/utils/icons";
import Image from "next/image";
import { Button } from "../ui/Button";

export function WelcomeLanding({
  actionLabel = "Pick Your Cliques",
  onAction,
}: {
  actionLabel?: string;
  onAction?: () => void;
}) {
  const router = useRouter();
  const handleAction = onAction ?? (() => router.push("/signup"));

  return (
    <div className="relative min-h-screen px-5 py-7 sm:px-6 sm:py-8 md:flex md:h-[100dvh] md:flex-col md:overflow-hidden md:px-8 md:py-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mt-6 flex shrink-0 flex-col items-center justify-center sm:mt-8 md:mt-0"
      >
        <div className="mb-3 flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full bg-[#4F3422] shadow-logo md:mb-8 md:h-20 md:w-20">
          <LogoIcon className="h-10 w-10 brightness-0 invert md:h-12 md:w-12" />
        </div>
        <p className="hidden text-[28px] font-extrabold leading-none tracking-[-2%] text-[#4F3422] md:block">
          Scuib Chat
        </p>
      </motion.div>

      <div className="mx-auto flex w-full max-w-[1200px] items-end justify-center gap-6 md:min-h-0 md:flex-1 md:items-center">
        <div className="w-full md:flex-1">
          <div className="mt-8 flex flex-1 flex-col items-center justify-center text-center text-[#4F3422] md:mt-0">
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="max-w-[18ch] text-[clamp(2rem,8vw,3rem)] font-extrabold leading-[1.02] tracking-[-0.04em] text-[#4F3422] md:leading-[1.05]"
            >
              Welcome to the community of tech{" "}
              <span className="text-[#926247]"> Cliques</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="my-4 max-w-[34rem] text-base font-medium leading-[1.7] tracking-[-0.02em] text-[#736B66] sm:text-lg"
            >
              Where Nigerian tech talents connect, get discovered, and get
              hired.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5, type: "spring" }}
              className="relative mt-8 aspect-[344/375] w-full max-w-[344px] md:hidden"
            >
              <Image
                fill
                src="/welcome.svg"
                alt=""
                className="object-contain object-center"
                priority
              />
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="mt-1 flex w-full flex-col items-center gap-4 md:mt-3"
          >
            <Button
              onClick={handleAction}
              className="w-full max-w-sm sm:w-auto"
              rightIcon={<ArrowRightIcon className="text-white" />}
            >
              {actionLabel}
            </Button>
            <p className="text-center text-sm font-bold leading-[1.3] tracking-[-0.02em] text-[#736B66]">
              Already have an account?
              <Link href="/signin" className="ml-1 text-[#ED7E1C] hover:underline">
                Sign in
              </Link>
            </p>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5, type: "spring" }}
          className="relative mt-8 hidden aspect-[390/441] w-full max-w-[390px] shrink-0 md:mt-0 md:block lg:max-w-[430px] xl:max-w-[480px]"
        >
          <Image
            fill
            src="/welcome1.svg"
            alt=""
            className="object-contain object-center"
            priority
          />
        </motion.div>
      </div>
    </div>
  );
}
