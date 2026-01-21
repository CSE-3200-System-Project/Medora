"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Check } from "lucide-react"
import { motion } from "framer-motion"

interface Step {
  id: number
  title: string
  shortName: string
}

interface StepIndicatorProps {
  steps: Step[]
  currentStep: number
  onStepClick?: (stepId: number) => void
}

export function StepIndicator({ steps, currentStep, onStepClick }: StepIndicatorProps) {
  return (
    <div className="w-full py-6">
      <div className="relative flex items-center justify-between w-full">
        {/* Connecting Line */}
        <div className="absolute left-0 top-1/2 h-0.5 w-full -translate-y-1/2 bg-muted z-0" />
        <div 
          className="absolute left-0 top-1/2 h-0.5 -translate-y-1/2 bg-primary z-0 transition-all duration-500 ease-in-out"
          style={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}
        />

        {steps.map((step) => {
          const isCompleted = currentStep > step.id
          const isCurrent = currentStep === step.id

          return (
            <button
              key={step.id}
              type="button"
              onClick={() => onStepClick?.(step.id)}
              className="relative z-10 flex flex-col items-center group focus:outline-none"
              aria-current={isCurrent ? 'step' : undefined}
              aria-label={`Go to step ${step.id}: ${step.title}`}
            >
              <motion.div
                initial={false}
                animate={{
                  backgroundColor: isCompleted || isCurrent ? "var(--primary)" : "var(--background)",
                  borderColor: isCompleted || isCurrent ? "var(--primary)" : "var(--muted-foreground)",
                  scale: isCurrent ? 1.1 : 1,
                }}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full border-2 transition-colors duration-300",
                  isCompleted || isCurrent ? "border-primary bg-primary text-primary-foreground" : "bg-background border-muted-foreground text-muted-foreground"
                )}
              >
                {isCompleted ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <span className="text-xs font-bold">{step.id}</span>
                )}
              </motion.div>
              <div className="absolute -bottom-8 w-32 text-center hidden md:block">
                <span
                  className={cn(
                    "text-xs font-medium transition-colors duration-300",
                    isCurrent ? "text-primary font-bold" : "text-muted-foreground"
                  )}
                >
                  {step.shortName}
                </span>
              </div>
            </button>
          )
        })}
      </div>
      {/* Mobile Step Name Display */}
      <div className="mt-6 text-center md:hidden">
        <h3 className="text-sm font-semibold text-primary">
          Step {currentStep}: {steps[currentStep - 1]?.title}
        </h3>
      </div>
    </div>
  )
}
