"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ModeToggle() {
  const { setTheme } = useTheme();

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="cursor-pointer relative rounded-full w-10 h-10 border border-accent-border bg-accent-faint text-white shadow-sm hover:bg-white/10 hover:border-white/30 transition-all"
        >
          <Sun className="h-5 w-5 transition-transform duration-300 ease-out scale-100 rotate-0 dark:scale-0 dark:-rotate-90" />
          <Moon className="absolute h-5 w-5 transition-transform duration-300 ease-out scale-0 rotate-90 dark:scale-100 dark:rotate-0" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="min-w-36 rounded-xl border border-accent-border bg-popover backdrop-blur-md shadow-lg z-9999"
        sideOffset={8}
      >
        <DropdownMenuItem
          onClick={() => setTheme("light")}
          className="text-popover-foreground hover:bg-accent! focus:bg-accent! hover:text-accent-foreground! focus:text-accent-foreground! cursor-pointer rounded-lg"
        >
          Light
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme("dark")}
          className="text-body-tertiary hover:bg-accent! focus:bg-accent! hover:text-accent-foreground! focus:text-accent-foreground! cursor-pointer rounded-lg"
        >
          Dark
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme("system")}
          className="text-body-tertiary hover:bg-accent! focus:bg-accent! hover:text-accent-foreground! focus:text-accent-foreground! cursor-pointer rounded-lg"
        >
          System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
