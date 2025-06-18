"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import React from "react";
import { Button } from "./button";
import { CustomTooltip } from "./customTooltip";

export const DarkModeToggle = React.forwardRef<
    HTMLButtonElement, // The ref type, assuming it forwards to the button
    React.ComponentPropsWithoutRef<typeof Button> // Inherit props from Button
>((props, ref) => {
    const { setTheme, theme } = useTheme();

    return (
        <CustomTooltip text="Toggle dark mode">
            <Button
                {...props}
                variant="ghost"
                className={
                    "bg-transparent size-7 border-foreground hover:bg-accent shadow-none"
                }
                onClick={() => {
                    setTheme(theme === "dark" ? "light" : "dark");
                }}
                ref={ref}
            >
                {theme === "dark" ? <Moon /> : <Sun />}
            </Button>
        </CustomTooltip>
    );
});
