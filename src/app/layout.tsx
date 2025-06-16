import type { Metadata } from "next";
import { Pixelify_Sans } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/themeProvide";
import { cookies } from "next/headers";

const customFont = Pixelify_Sans({
    subsets: ["latin"],
    weight: ["400", "700"],
    variable: "--font-custom",
    fallback: ["system-ui", "sans-serif"],
});

export const metadata: Metadata = {
    title: "Nocturne Chat - An open source chat app in your browser",
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
            <body className={`${customFont.variable} antialiased`}>
                <script
                    crossOrigin="anonymous"
                    src="//unpkg.com/react-scan/dist/auto.global.js"
                />
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
                    {children}
                </ThemeProvider>
            </body>
        </html>
    );
}
