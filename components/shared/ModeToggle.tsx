"use client";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
export function ModeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Choose color theme"
          className="relative text-white hover:bg-white/10 hover:text-white"
        >
          <Sun aria-hidden="true" className="size-5 scale-100 dark:scale-0" />
          <Moon
            aria-hidden="true"
            className="absolute size-5 scale-0 dark:scale-100"
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        collisionPadding={12}
        className="z-80 w-44 max-w-[calc(100vw-1.5rem)] rounded-xl border-border bg-popover p-1.5 text-popover-foreground shadow-panel"
      >
        <DropdownMenuRadioGroup
          aria-label="Color theme"
          value={theme}
          onValueChange={(value) => {
            if (["light", "dark", "system"].includes(value)) setTheme(value);
          }}
        >
          <DropdownMenuRadioItem value="light">
            <Sun className="size-4" aria-hidden="true" />
            Light
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">
            <Moon className="size-4" aria-hidden="true" />
            Dark
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">
            <Monitor className="size-4" aria-hidden="true" />
            System
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
