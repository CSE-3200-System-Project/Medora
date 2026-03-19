"use client"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { AlertCircle } from "lucide-react"
import { useRouter } from "next/navigation"

interface OnboardingBannerProps {
  role: "patient" | "doctor"
}

export function OnboardingBanner({ role }: OnboardingBannerProps) {
  const router = useRouter()

  const handleCompleteOnboarding = () => {
    // Route to the role-specific onboarding page
    router.push(`/onboarding/${role}?mode=edit`)
  }

  return (
    <Alert className="mb-6 bg-primary-more-light border-primary">
      <AlertCircle className="h-4 w-4 text-primary" />
      <AlertDescription className="flex items-center justify-between gap-4">
        <span className="text-foreground">
          <strong className="text-foreground">Complete Your Profile:</strong> Finish your onboarding to unlock all features and get the best experience.
        </span>
        <Button
          onClick={handleCompleteOnboarding}
          variant="medical"
          size="sm"
          className="shrink-0"
        >
          Finish Onboarding
        </Button>
      </AlertDescription>
    </Alert>
  )
}
