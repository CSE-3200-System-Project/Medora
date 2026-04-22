"use client";

import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MedoraLoader } from "@/components/ui/medora-loader";
import { CardSkeleton } from "@/components/ui/skeleton-loaders";
import { useT } from "@/i18n/client";
import { 
  Heart, 
  Pill, 
  AlertCircle, 
  Scissors, 
  Hospital, 
  History,
  ChevronRight 
} from "lucide-react";

interface ContextFactor {
  category: string; // "condition", "medication", "surgery", "hospitalization", "allergy"
  value: string;
  influence: string;
}

interface PatientContextDisplayProps {
  factors: ContextFactor[] | null | undefined;
  loading?: boolean;
}

const getCategoryIcon = (category: string) => {
  switch (category) {
    case "condition":
      return <Heart className="w-4 h-4 text-red-500" />;
    case "medication":
      return <Pill className="w-4 h-4 text-blue-500" />;
    case "allergy":
      return <AlertCircle className="w-4 h-4 text-orange-500" />;
    case "surgery":
      return <Scissors className="w-4 h-4 text-purple-500" />;
    case "hospitalization":
      return <Hospital className="w-4 h-4 text-pink-500" />;
    default:
      return <History className="w-4 h-4 text-muted-foreground" />;
  }
};

const getCategoryLabel = (category: string, tCommon: (key: string) => string) => {
  switch (category) {
    case "condition":
      return tCommon("findDoctor.context.category.condition");
    case "medication":
      return tCommon("findDoctor.context.category.medication");
    case "allergy":
      return tCommon("findDoctor.context.category.allergy");
    case "surgery":
      return tCommon("findDoctor.context.category.surgery");
    case "hospitalization":
      return tCommon("findDoctor.context.category.hospitalization");
    default:
      return tCommon("findDoctor.context.category.medicalHistory");
  }
};

const getCategoryColor = (category: string) => {
  switch (category) {
    case "condition":
      return "bg-red-100 text-red-800 border-red-200";
    case "medication":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "allergy":
      return "bg-orange-100 text-orange-800 border-orange-200";
    case "surgery":
      return "bg-purple-100 text-purple-800 border-purple-200";
    case "hospitalization":
      return "bg-pink-100 text-pink-800 border-pink-200";
    default:
      return "bg-muted/50 text-foreground border-border";
  }
};

export function PatientContextDisplay({ factors, loading = false }: PatientContextDisplayProps) {
  const tCommon = useT("common");

  if (loading) {
    return (
      <Card className="border-primary/10 bg-linear-to-r from-primary-more-light/50 to-accent/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="w-4 h-4 text-primary" />
            {tCommon("findDoctor.context.loadingTitle")}
          </CardTitle>
          <CardDescription>
            <div className="pt-1">
              <MedoraLoader size="sm" label={tCommon("findDoctor.context.loadingDescription")} />
            </div>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <CardSkeleton />
            <CardSkeleton />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!factors || factors.length === 0) {
    return null;
  }

  // Group factors by category
  const groupedFactors = factors.reduce((acc: Record<string, ContextFactor[]>, factor) => {
    if (!acc[factor.category]) {
      acc[factor.category] = [];
    }
    acc[factor.category].push(factor);
    return acc;
  }, {});

  return (
    <Card className="border-primary/10 bg-linear-to-r from-primary-more-light/30 to-accent/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="w-5 h-5 text-primary" />
          {tCommon("findDoctor.context.title")}
        </CardTitle>
        <CardDescription>
          {tCommon("findDoctor.context.description")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {Object.entries(groupedFactors).map(([category, categoryFactors]) => (
            <div key={category} className="space-y-2">
              {categoryFactors.map((factor, idx) => (
                <div 
                  key={`${category}-${idx}`} 
                  className="flex items-start gap-3 p-3 rounded-lg bg-card border border-primary/10 hover:border-primary/30 transition-colors"
                >
                  {/* Icon */}
                  <div className="pt-0.5">
                    {getCategoryIcon(factor.category)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant="outline" 
                        className={`text-xs font-medium ${getCategoryColor(factor.category)}`}
                      >
                        {getCategoryLabel(factor.category, tCommon)}
                      </Badge>
                      <span className="font-semibold text-sm text-foreground">
                        {factor.value}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {factor.influence}
                    </p>
                  </div>

                  {/* Arrow indicator */}
                  <ChevronRight className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Footer note */}
        <div className="mt-4 p-3 bg-primary/5 rounded-lg border border-primary/20">
          <p className="text-xs text-primary leading-relaxed">
            <span className="font-medium">{tCommon("findDoctor.context.personalizedTitle")}:</span> {tCommon("findDoctor.context.personalizedDescription")}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

