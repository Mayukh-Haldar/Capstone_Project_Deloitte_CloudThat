import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
export function ThemeToggle() {
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);
    useEffect(() => {
        setMounted(true);
    }, []);
    if (!mounted) {
        return (<div className="size-10 rounded-lg bg-muted animate-pulse"/>);
    }
    return (<button onClick={() => setTheme(theme === "dark" ? "light" : "dark")} className="group relative flex items-center justify-center size-10 rounded-lg bg-primary/10 hover:bg-primary/20 transition-[background-color,transform] duration-200 hover:scale-105 active:scale-95" aria-label="Toggle theme" title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}>
      <Sun className="size-5 text-primary rotate-0 scale-100 transition-[transform] duration-300 dark:-rotate-90 dark:scale-0"/>
      <Moon className="absolute size-5 text-primary rotate-90 scale-0 transition-[transform] duration-300 dark:rotate-0 dark:scale-100"/>
    </button>);
}
