"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, CheckCircle2, Link2Off, Loader2, ExternalLink } from "lucide-react";
import {
  getGoogleCalendarStatus,
  getGoogleConnectUrl,
  disconnectGoogleCalendar,
} from "@/lib/google-calendar-actions";

export function GoogleCalendarConnect() {
  const [connected, setConnected] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [actionLoading, setActionLoading] = React.useState(false);

  React.useEffect(() => {
    const checkStatus = async () => {
      try {
        const status = await getGoogleCalendarStatus();
        setConnected(status.connected);
      } catch {
        setConnected(false);
      } finally {
        setLoading(false);
      }
    };
    checkStatus();
  }, []);

  const handleConnect = async () => {
    setActionLoading(true);
    try {
      const url = await getGoogleConnectUrl();
      window.location.href = url;
    } catch (error) {
      console.error("Failed to connect Google Calendar:", error);
      setActionLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setActionLoading(true);
    try {
      await disconnectGoogleCalendar();
      setConnected(false);
    } catch (error) {
      console.error("Failed to disconnect Google Calendar:", error);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Calendar className="h-5 w-5 text-primary" />
          Google Calendar
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Sync your confirmed appointments with Google Calendar to receive reminders and keep your schedule organized.
        </p>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Checking connection status...
          </div>
        ) : connected ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="success" className="gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Connected
              </Badge>
              <span className="text-sm text-muted-foreground">
                Appointments will sync automatically
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDisconnect}
              disabled={actionLoading}
              className="text-destructive hover:text-destructive"
            >
              {actionLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Link2Off className="h-4 w-4 mr-2" />
              )}
              Disconnect
            </Button>
          </div>
        ) : (
          <Button
            onClick={handleConnect}
            disabled={actionLoading}
            className="gap-2"
          >
            {actionLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ExternalLink className="h-4 w-4" />
            )}
            Connect Google Calendar
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
