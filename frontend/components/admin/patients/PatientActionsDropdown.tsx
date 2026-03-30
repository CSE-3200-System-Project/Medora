"use client";

import { Ban, ClipboardList, Eye, MoreVertical, Pencil, Power, Trash2, Unlock } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

type PatientActionsDropdownProps = {
  isBanned: boolean;
  isActive: boolean;
  labels: {
    viewProfile: string;
    editPatient: string;
    toggleActive: string;
    activate: string;
    deactivate: string;
    toggleBan: string;
    ban: string;
    unban: string;
    deletePatient: string;
    viewReports: string;
  };
  onViewProfile: () => void;
  onEditPatient: () => void;
  onToggleActive: () => void;
  onToggleBan: () => void;
  onDeletePatient: () => void;
  onViewReports: () => void;
};

export function PatientActionsDropdown({
  isBanned,
  isActive,
  labels,
  onViewProfile,
  onEditPatient,
  onToggleActive,
  onToggleBan,
  onDeletePatient,
  onViewReports,
}: PatientActionsDropdownProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" size="icon" variant="ghost" className="h-8 w-8 rounded-lg">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onSelect={onViewProfile}>
          <Eye className="mr-2 h-4 w-4" />
          {labels.viewProfile}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onEditPatient}>
          <Pencil className="mr-2 h-4 w-4" />
          {labels.editPatient}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onViewReports}>
          <ClipboardList className="mr-2 h-4 w-4" />
          {labels.viewReports}
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem onSelect={onToggleActive}>
          <Power className="mr-2 h-4 w-4" />
          {isActive ? labels.deactivate : labels.toggleActive}
        </DropdownMenuItem>

        <DropdownMenuItem onSelect={onToggleBan}>
          {isBanned ? <Unlock className="mr-2 h-4 w-4" /> : <Ban className="mr-2 h-4 w-4" />}
          {isBanned ? labels.unban : labels.toggleBan}
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem variant="destructive" onSelect={onDeletePatient}>
          <Trash2 className="mr-2 h-4 w-4" />
          {labels.deletePatient}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
