import type { Metadata } from "next";
import { DM_Sans, DM_Serif_Display } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({
    subsets: ["latin"],
    variable: "--font-dm-sans",
});

const dmSerif = DM_Serif_Display({
    weight: "400",
    subsets: ["latin"],
    variable: "--font-dm-serif",
});

export const metadata: Metadata = {
    title: "MedLabLingo",
    description: "Educational lab analysis tool",
};

export default async function RootLayout({
    children,
    params,
}: Readonly<{
    children: React.ReactNode;
    params: Promise<Record<string, string | string[] | undefined>>;
}>) {
    await params;

    return (
        <html lang="en">
            <body className={`${dmSans.variable} ${dmSerif.variable} font-sans bg-sand text-navy`}>
                {children}
            </body>
        </html>
    );
}
