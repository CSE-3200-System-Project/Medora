"use client";

import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
      return <History className="w-4 h-4 text-gray-500" />;
  }
};

const getCategoryLabel = (category: string) => {
  switch (category) {
    case "condition":
      return "Medical Condition";
    case "medication":
      return "Current Medication";
    case "allergy":
      return "Known Allergy";
    case "surgery":
      return "Past Surgery";
    case "hospitalization":
      return "Hospitalization";
    default:
      return "Medical History";
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
      return "bg-gray-100 text-gray-800 border-gray-200";
  }
};

export function PatientContextDisplay({ factors, loading = false }: PatientContextDisplayProps) {
  if (loading) {
    return (
      <Card className="border-primary/10 bg-linear-to-r from-primary-more-light/50 to-accent/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="w-4 h-4 text-primary" />
            Medical History Context
          </CardTitle>
          <CardDescription>Loading your medical information...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-gray-200 rounded h-12 animate-pulse" />
            ))}
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
          Your Medical History is Influencing This Search
        </CardTitle>
        <CardDescription>
          These factors from your profile are helping us find the right specialist for you
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {Object.entries(groupedFactors).map(([category, categoryFactors]) => (
            <div key={category} className="space-y-2">
              {categoryFactors.map((factor, idx) => (
                <div 
                  key={`${category}-${idx}`} 
                  className="flex items-start gap-3 p-3 rounded-lg bg-white border border-primary/10 hover:border-primary/30 transition-colors"
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
                        {getCategoryLabel(factor.category)}
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
            <span className="font-medium">Personalized Search:</span> Our AI analyzed your medical history alongside your description to recommend specialists who are best equipped to help you.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
