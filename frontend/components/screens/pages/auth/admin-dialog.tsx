"use client";

import { useRouter } from "next/navigation";
import { Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface AdminDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AdminDialog({ open, onOpenChange }: AdminDialogProps) {
  const router = useRouter();

  const handleAdminAccess = () => {
    onOpenChange(false);
    router.push("/login?role=admin");
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
            Administrators use an individually provisioned account so every
            privileged action has an accountable identity.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 text-sm text-muted-foreground">
          Sign in with your administrator email and password. Shared admin
          passkeys are not accepted by the API.
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-border text-muted-foreground hover:bg-card hover:text-foreground"
          >
            Cancel
          </Button>
          <Button
            onClick={handleAdminAccess}
            className="bg-linear-to-r from-primary to-primary-muted hover:from-primary-muted hover:to-primary shadow-lg shadow-primary/20"
          >
            Continue to sign in
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
