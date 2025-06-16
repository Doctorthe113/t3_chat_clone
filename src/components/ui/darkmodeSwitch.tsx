"use client";

import { useTheme } from "next-themes";
import React from "react";
import { Switch } from "@/components/ui/switch";

export const DarkModeSwitch = React.forwardRef<
    HTMLButtonElement, // The ref type, assuming it forwards to the button
    React.ComponentPropsWithoutRef<typeof Switch> // Inherit props from Switch
>(
    (props, ref) => {
        const { setTheme, theme } = useTheme();

        return (
            <Switch
                {...props}
                className={"bg-transparent border-foreground hover:bg-accent shadow-none"}
                checked={theme === "dark"}
                onClick={() => {
                    setTheme(theme === "dark" ? "light" : "dark");
                }}
                ref={ref}
            />
        );
    },
);
