import { Lightbulb, Settings2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type SmartInsightProps = {
  message: string;
};

export function SmartInsight({ message }: SmartInsightProps) {
  return (
    <Card className="border-primary/20 bg-primary-more-light/35">
      <CardContent className="flex flex-col gap-4 pt-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-primary/10 p-2.5">
            <Lightbulb className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Smart Insight</p>
            <p className="mt-1 text-sm text-muted-foreground">{message}</p>
          </div>
        </div>

        <Button className="h-11 min-w-32" size="sm">
          <Settings2 className="h-4 w-4" />
          Setup Reminder
        </Button>
      </CardContent>
    </Card>
  );
}
