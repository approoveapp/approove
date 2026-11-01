"use client";

import { Check, ChevronDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { AttachmentVersion } from "./post-slide";
import { useLocale } from "@/components/locale-provider";
import { localizedText } from "@/lib/locale";

interface VersionSelectorProps {
  versions: AttachmentVersion[];
  currentIndex: number;
  onSelect: (index: number) => void;
  onAddVersion?: () => void;
}

export function VersionSelector({
  versions,
  currentIndex,
  onSelect,
  onAddVersion,
}: VersionSelectorProps) {
  const locale = useLocale();
  const tr = (pt: string, en: string) => localizedText(locale, pt, en);

  if (versions.length === 0) return null;
  if (versions.length === 1 && !onAddVersion) return null;

  const currentVersion = versions[currentIndex];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 bg-background/90 backdrop-blur-sm shadow-sm text-xs font-medium"
        >
          {tr("Versão", "Version")} {currentVersion?.version ?? currentIndex + 1}
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          {tr("Versões da arte", "Creative versions")}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {versions.map((v, i) => (
          <DropdownMenuItem
            key={v.id}
            onClick={() => onSelect(i)}
            className="flex cursor-pointer items-center justify-between"
          >
            <span>{tr("Versão", "Version")} {v.version}</span>
            {i === currentIndex && <Check className="h-4 w-4 text-primary" />}
          </DropdownMenuItem>
        ))}
        {onAddVersion && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={onAddVersion}
              className="cursor-pointer text-primary focus:text-primary"
            >
              <Plus className="h-4 w-4" />
              {tr("Nova versão", "New version")}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
