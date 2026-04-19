"use client";

import React from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ButtonLoader, MedoraLoader } from "@/components/ui/medora-loader";
import { Calendar, CheckCircle2, AlertCircle, Link2Off, ExternalLink, User, Mail, CalendarDays } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  getGoogleCalendarStatus,
  getGoogleConnectUrl,
  disconnectGoogleCalendar,
} from "@/lib/google-calendar-actions";

export function GoogleCalendarConnect() {
  const searchParams = useSearchParams();
  const [connected, setConnected] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [actionLoading, setActionLoading] = React.useState(false);
  const [googleInfo, setGoogleInfo] = React.useState<{
    email: string | null;
    name: string | null;
    picture: string | null;
  }>({ email: null, name: null, picture: null });

  const oauthResult = searchParams.get("gcal");
  const oauthReason = searchParams.get("reason");

  const oauthErrorMessage = React.useMemo(() => {
    switch (oauthReason) {
      case "invalid_grant":
        return "Google authorization expired or was rejected. Please try connecting again.";
      case "redirect_uri_mismatch":
        return "Google redirect URI is not configured correctly for this environment.";
      case "access_denied":
        return "Google access was denied. Please approve access to continue.";
      default:
        return "Could not complete Google Calendar connection. Please try again.";
    }
  }, [oauthReason]);

  React.useEffect(() => {
    let isMounted = true;

    const checkStatus = async () => {
      try {
        const status = await getGoogleCalendarStatus();
        if (!isMounted) return;

        setConnected(status.connected);
        if (status.connected) {
          setGoogleInfo({
            email: status.google_email,
            name: status.google_name,
            picture: status.google_picture,
          });
        } else {
          setGoogleInfo({ email: null, name: null, picture: null });
        }
      } catch {
        if (!isMounted) return;
        setConnected(false);
        setGoogleInfo({ email: null, name: null, picture: null });
      } finally {
        if (!isMounted) return;
        setLoading(false);
      }
    };

    checkStatus();

    return () => {
      isMounted = false;
    };
  }, [oauthResult]);

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
      setGoogleInfo({ email: null, name: null, picture: null });
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
        <CardDescription>
          Sync appointments and medication reminders with your Google Calendar
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {oauthResult === "connected" && connected && (
          <div className="rounded-lg border border-success/30 bg-success/10 p-3 text-sm text-success-muted">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4" />
              <p>Google Calendar connected successfully.</p>
            </div>
          </div>
        )}

        {oauthResult === "error" && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive-muted">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4" />
              <p>{oauthErrorMessage}</p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MedoraLoader size="sm" label="Checking connection status..." />
          </div>
        ) : connected ? (
          <div className="space-y-4">
            {/* Connected Account Info */}
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <Avatar className="h-10 w-10">
                <AvatarImage src={googleInfo.picture || undefined} alt="Google Account" />
                <AvatarFallback>
                  <User className="h-5 w-5" />
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant="success" className="gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Connected
                  </Badge>
                </div>
                {googleInfo.name && (
                  <p className="text-sm font-medium">{googleInfo.name}</p>
                )}
                {googleInfo.email && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Mail className="h-3 w-3" />
                    <span>{googleInfo.email}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Sync Features Info */}
            <div className="space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <CalendarDays className="h-4 w-4 text-primary mt-0.5" />
                <p className="text-muted-foreground">
                  Confirmed appointments will automatically sync to your calendar
                </p>
              </div>
              <div className="flex items-start gap-2">
                <CalendarDays className="h-4 w-4 text-primary mt-0.5" />
                <p className="text-muted-foreground">
                  Medication reminders can be added as recurring calendar events
                </p>
              </div>
            </div>

            {/* Disconnect Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleDisconnect}
              disabled={actionLoading}
              className="text-destructive hover:text-destructive"
            >
              {actionLoading ? (
                <ButtonLoader className="h-4 w-4 mr-2" />
              ) : (
                <Link2Off className="h-4 w-4 mr-2" />
              )}
              Disconnect
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Connect your Google Calendar to:
            </p>
            <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
              <li>Sync confirmed appointments automatically</li>
              <li>Add medication reminders as recurring events</li>
              <li>Receive calendar notifications and reminders</li>
            </ul>
            <Button
              onClick={handleConnect}
              disabled={actionLoading}
              className="gap-2"
            >
              {actionLoading ? (
                <ButtonLoader className="h-4 w-4" />
              ) : (
                <ExternalLink className="h-4 w-4" />
              )}
              Connect Google Calendar
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
