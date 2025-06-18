import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import * as React from "react"; // React must be imported for forwardRef

export const CustomTooltip = React.forwardRef(
    (
        {
            children,
            text,
            className = "",
            align = "center",
        }: {
            children: React.ReactNode;
            text: string;
            className?: string;
            align?: "center" | "start" | "end";
        },
        _ref
    ) => {
        return (
            <Tooltip delayDuration={10} disableHoverableContent>
                <TooltipTrigger className={`p-0 m-0 ${className}`} asChild>
                    {children}
                </TooltipTrigger>
                <TooltipContent className="z-200 border-none" align={align}>
                    <span className="bg-transparent h-min px-2">{text}</span>
                </TooltipContent>
            </Tooltip>
        );
    }
);
