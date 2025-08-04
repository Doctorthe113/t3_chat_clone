import { ThemeProvider } from "@/components/themeProvide";
import type { Metadata } from "next";
import { Merriweather, Norican, Pixelify_Sans } from "next/font/google";
import { cookies } from "next/headers";
import { Toaster } from "sonner";
import "./globals.css";

const customFont = Pixelify_Sans({
    subsets: ["latin"],
    weight: ["400", "700"],
    variable: "--font-custom",
    fallback: ["system-ui", "sans-serif"],
});

const cursive = Norican({
    subsets: ["latin"],
    weight: ["400"],
    variable: "--font-cursive",
    fallback: ["system-ui", "sans"],
});

const merriweather = Merriweather({
    subsets: ["latin"],
    weight: ["400", "700"],
    variable: "--font-serif",
    fallback: ["system-ui", "serif"],
});

export const metadata: Metadata = {
    title: "Cosmic Chat - An open source chat app in your browser",
    description: "Open source T3 chat clone",
};

export default async function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    const customCssVars = (await cookies()).get("themeCssVars")?.value;

    return (
        <html lang="en">
            <head>
                <meta name="darkreader-lock" />
            </head>
            <body
                className={`${customFont.variable} ${cursive.variable} ${merriweather.variable} antialiased`}
            >
                {!!customCssVars && (
                    <style
                        dangerouslySetInnerHTML={{
                            __html: `:root {${customCssVars}}`,
                        }}
                    />
                )}
                <ThemeProvider
                    attribute="class"
                    defaultTheme="system"
                    enableSystem
                    disableTransitionOnChange
                >
                    <>{children}</>
                    <Toaster
                        expand={false}
                        toastOptions={{
                            className: "bg-popover !border-border",
                            style: {
                                background: "var(--color-popover)",
                                color: "var(--color-popover-foreground)",
                                width: "fit-content",
                            },
                        }}
                    />
                </ThemeProvider>
            </body>
        </html>
    );
}
