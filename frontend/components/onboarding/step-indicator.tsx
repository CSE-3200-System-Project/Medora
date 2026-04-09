"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Check } from "lucide-react"

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
    <div className="w-full py-3 sm:py-5">
      <div className="flex gap-2 overflow-x-auto pb-1 md:hidden no-scrollbar">
        {steps.map((step) => {
          const isCurrent = currentStep === step.id
          const isCompleted = currentStep > step.id
          return (
            <button
              key={`mobile-${step.id}`}
              type="button"
              onClick={() => onStepClick?.(step.id)}
              className={cn(
                "inline-flex min-w-fit items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium transition-colors",
                isCurrent && "border-primary bg-primary text-primary-foreground",
                isCompleted && !isCurrent && "border-primary/40 bg-primary/10 text-primary",
                !isCompleted && !isCurrent && "border-border bg-background text-muted-foreground"
              )}
            >
              {isCompleted ? <Check className="h-3.5 w-3.5" /> : <span>{step.id}</span>}
              <span>{step.shortName}</span>
            </button>
          )
        })}
      </div>
      <div className="relative hidden w-full items-center justify-between md:flex">
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
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all duration-300",
                  isCompleted || isCurrent ? "border-primary bg-primary text-primary-foreground" : "bg-background border-border text-muted-foreground",
                  isCurrent && "scale-110"
                )}
              >
                {isCompleted ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <span className="text-xs font-bold">{step.id}</span>
                )}
              </div>
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
      <div className="mt-4 text-center md:hidden">
        <h3 className="text-sm font-semibold text-primary">
          Step {currentStep}: {steps[currentStep - 1]?.title}
        </h3>
      </div>
    </div>
  )
}
