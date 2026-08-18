"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LogoIcon, MouseIcon } from "@/utils/icons";

type SplashState = "logo" | "loading" | "fetching";

interface SplashScreenProps {
  onComplete: () => void;
}

/**
 * Hook to handle responsive blob counts
 */
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  return isMobile;
}

export function SplashScreen({ onComplete }: SplashScreenProps) {
  const [state, setState] = useState<SplashState>("logo");
  const [progress, setProgress] = useState(0);
  const isMobile = useIsMobile();

  // Define blobs based on screen size
  const blobs = useMemo(() => {
    if (isMobile) {
      return [
        {
          bg: "#7D944D",
          size: "300px",
          pos: { top: "-5%", right: "-10%" },
          d: 0,
        },
        {
          bg: "#8FA968",
          size: "350px",
          pos: { bottom: "-10%", left: "-10%" },
          d: 0.3,
        },
        {
          bg: "#6B8A3D",
          size: "200px",
          pos: { top: "20%", left: "0%" },
          d: 0.6,
        },
      ];
    }
    return [
      {
        bg: "#7D944D",
        size: "600px",
        pos: { top: "-10%", right: "-5%" },
        d: 0,
      },
      {
        bg: "#A8C176",
        size: "400px",
        pos: { bottom: "5%", right: "10%" },
        d: 0.2,
      },
      {
        bg: "#8FA968",
        size: "500px",
        pos: { bottom: "-15%", left: "-10%" },
        d: 0.4,
      },
      { bg: "#6B8A3D", size: "250px", pos: { top: "15%", left: "5%" }, d: 0.6 },
      {
        bg: "#7D944D",
        size: "300px",
        pos: { top: "40%", left: "35%" },
        d: 0.8,
      },
      {
        bg: "#A8C176",
        size: "280px",
        pos: { bottom: "20%", left: "25%" },
        d: 1.0,
      },
    ];
  }, [isMobile]);

  useEffect(() => {
    const logoTimer = setTimeout(() => setState("loading"), 2000);
    return () => clearTimeout(logoTimer);
  }, []);

  useEffect(() => {
    if (state === "loading") {
      const interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 99) {
            clearInterval(interval);
            setTimeout(() => setState("fetching"), 500);
            return 99;
          }
          return prev + Math.random() * 15;
        });
      }, 200);
      return () => clearInterval(interval);
    }
  }, [state]);

  useEffect(() => {
    if (state === "fetching") {
      const timer = setTimeout(() => onComplete(), 3500);
      return () => clearTimeout(timer);
    }
  }, [state, onComplete]);

  return (
    <AnimatePresence mode="wait">
      {state === "logo" && (
        <motion.div
          key="logo"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-[#F7F4F2] flex flex-col items-center justify-center z-100"
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 15 }}
            className="flex flex-col items-center"
          >
            <LogoIcon className="text-[#AC7F5E]" />
            <h1 className="mt-4 text-3xl font-extrabold text-[#4F3422] tracking-tight">
              Scuib Chat
            </h1>
          </motion.div>
        </motion.div>
      )}

      {state === "loading" && (
        <motion.div
          key="loading"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-[#251404] flex items-center justify-center z-100 overflow-hidden"
        >
          <div className="absolute inset-0 flex items-center justify-center opacity-20">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              className="w-[150vw] h-[150vw]"
            >
              <LogoIcon className="text-[#4F3422] w-full h-full" />
            </motion.div>
          </div>
          <span className="relative z-10 text-6xl font-bold text-white">
            {Math.min(99, Math.floor(progress))}
            <span className="text-[#C0A091] ml-1">%</span>
          </span>
        </motion.div>
      )}

      {state === "fetching" && (
        <motion.div
          key="fetching"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.05, filter: "blur(20px)" }}
          transition={{ duration: 0.8 }}
          className="fixed inset-0 bg-[#9BB168] flex flex-col items-center justify-center z-100 overflow-hidden"
        >
          {/* Dynamic Background Blobs */}
          {blobs.map((blob, i) => (
            <motion.div
              key={i}
              className="absolute rounded-full mix-blend-multiply filter blur-md opacity-60 will-change-transform"
              animate={{
                scale: [1, 1.15, 1],
                x: [0, i % 2 === 0 ? 40 : -40, 0],
                y: [0, i % 2 === 0 ? 60 : -60, 0],
                borderRadius: [
                  "40% 60% 70% 30% / 40% 40% 60% 70%",
                  "60% 40% 30% 70% / 60% 30% 70% 40%",
                  "40% 60% 70% 30% / 40% 40% 60% 70%",
                ],
              }}
              transition={{
                duration: 8 + i,
                repeat: Infinity,
                ease: "easeInOut",
                delay: blob.d,
              }}
              style={{
                backgroundColor: blob.bg,
                width: blob.size,
                height: blob.size,
                ...blob.pos,
              }}
            />
          ))}

          {/* Content Layer */}
          <div className="relative z-10 text-center px-6">
            <div className="mb-6">
              <motion.h2
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                className="text-4xl md:text-5xl font-extrabold text-white tracking-[-1.2%]"
              >
                Fetching Data...
              </motion.h2>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.8 }}
              className="flex flex-col items-center gap-6"
            >
              <div className="flex items-center gap-3 px-6 py-3">
                <motion.div
                  animate={{
                    rotate: 360,
                    scale: [1, 1.2, 1],
                  }}
                  transition={{
                    rotate: { duration: 3, repeat: Infinity, ease: "linear" },
                    scale: {
                      duration: 1.5,
                      repeat: Infinity,
                      ease: "easeInOut",
                    },
                  }}
                >
                  <MouseIcon className="text-white w-6 h-6" />
                </motion.div>
                <span className="text-white font-medium text-lg">
                  Please be calm, almost there
                </span>
              </div>

              {/* Progress Track */}
              <div className="w-48 h-0.75 bg-white/20 relative overflow-hidden rounded-full">
                <motion.div
                  className="absolute inset-0 bg-white"
                  animate={{ x: ["-100%", "100%"] }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
