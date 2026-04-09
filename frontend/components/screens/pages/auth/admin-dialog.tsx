"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { setAdminAccess } from "@/lib/admin-actions";
import { toast } from "@/lib/notify";

interface AdminDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AdminDialog({ open, onOpenChange }: AdminDialogProps) {
  const router = useRouter();
  const [adminPassword, setAdminPassword] = useState("");
  const [adminError, setAdminError] = useState("");

  const handleAdminAccess = async () => {
    setAdminError("");
    try {
      const result = await setAdminAccess(adminPassword);
      if (result.success) {
        onOpenChange(false);
        setAdminPassword("");
        router.replace("/admin");
      } else {
        const message = result.error || "Incorrect admin password";
        setAdminError(message);
        toast.error(message);
      }
    } catch {
      setAdminError("Failed to authenticate");
      toast.error("Failed to authenticate");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-linear-to-br from-background via-surface to-background border-border text-white w-[min(92vw,28rem)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <div className="p-2 bg-primary/20 rounded-lg">
              <Shield className="h-6 w-6 text-primary-light" />
            </div>
            Access Verification
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            To access the admin panel, please enter the passkey.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="admin-password" className="text-muted-foreground">
              Admin Passkey
            </Label>
            <Input
              id="admin-password"
              type="password"
              value={adminPassword}
              onChange={(e) => {
                setAdminPassword(e.target.value);
                setAdminError("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleAdminAccess();
                }
              }}
              placeholder="Enter admin passkey"
              className="bg-background/50 border-border text-foreground placeholder:text-muted-foreground focus:border-primary"
              autoFocus
            />
            {adminError && (
              <p className="text-sm text-red-400 flex items-center gap-1">
                <span className="inline-block w-1 h-1 bg-red-400 rounded-full"></span>
                {adminError}
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              setAdminPassword("");
              setAdminError("");
            }}
            className="border-border text-muted-foreground hover:bg-card hover:text-foreground"
          >
            Cancel
          </Button>
          <Button
            onClick={handleAdminAccess}
            className="bg-linear-to-r from-primary to-primary-muted hover:from-primary-muted hover:to-primary shadow-lg shadow-primary/20"
          >
            Enter admin panel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
