"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";

import logo from "@/assets/images/logo.png";

type ChoruiLauncherProps = {
  role: "patient" | "doctor";
  placement?: "floating" | "inline";
};

const promptTextByRole: Record<ChoruiLauncherProps["role"], string> = {
  patient: "Call Chorui AI for health guidance and record insights",
  doctor: "Call Chorui AI for patient context and workflow support",
};

const targetByRole: Record<ChoruiLauncherProps["role"], string> = {
  patient: "/patient/chorui-ai",
  doctor: "/doctor/chorui-ai",
};

export function ChoruiLauncher({ role, placement = "floating" }: ChoruiLauncherProps) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const wrapperClassName =
    placement === "floating"
      ? "pointer-events-none fixed bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] right-[max(0.75rem,env(safe-area-inset-right,0px))] z-40 sm:right-[max(1rem,env(safe-area-inset-right,0px))]"
      : "flex w-full justify-end";
  const buttonClassName =
    placement === "floating"
      ? "pointer-events-auto group flex min-h-11 items-center gap-2.5 rounded-full border border-primary/25 bg-background/95 px-2.5 py-2 text-left shadow-[0_18px_30px_-18px_rgba(3,96,217,0.85)] backdrop-blur-md transition-colors hover:border-primary/45 hover:bg-background"
      : "pointer-events-auto group flex min-h-11 items-center gap-2.5 rounded-full border border-primary/25 bg-background/95 px-2.5 py-2 text-left shadow-[0_16px_28px_-18px_rgba(3,96,217,0.78)] backdrop-blur-md transition-colors hover:border-primary/45 hover:bg-background";

  return (
    <div className={wrapperClassName}>
      <motion.button
        type="button"
        aria-label="Open Chorui AI assistant"
        onClick={() => router.push(targetByRole[role])}
        className={buttonClassName}
        initial={reduceMotion ? false : { opacity: 0, y: 18, scale: 0.98 }}
        animate={
          reduceMotion
            ? { opacity: 1 }
            : {
                opacity: 1,
                y: 0,
                scale: [1, 1.01, 1],
                transition: {
                  y: { duration: 0.35, ease: [0.22, 1, 0.36, 1] },
                  opacity: { duration: 0.3 },
                  scale: {
                    duration: 3.8,
                    repeat: Infinity,
                    ease: [0.16, 1, 0.3, 1],
                  },
                },
              }
        }
        whileHover={reduceMotion ? undefined : { y: -1, scale: 1.02 }}
        whileTap={reduceMotion ? undefined : { scale: 0.98 }}
      >
        <span className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-primary/30 bg-primary-more-light">
          <Image src={logo} alt="Chorui AI" fill sizes="40px" className="object-contain p-1.5" priority />
        </span>

        <span className="max-w-50 pr-1 text-[0.72rem] font-semibold leading-snug text-foreground sm:max-w-64 sm:text-[0.78rem]">
          {promptTextByRole[role]}
        </span>
      </motion.button>
    </div>
  );
}
