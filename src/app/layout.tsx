import type { Metadata } from "next";
import { IBM_Plex_Mono, Sora } from "next/font/google";
import "./globals.css";

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
});

const mono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Pok Team Builder",
  description: "Responsive Pokemon team builder with analysis, storage, and Showdown import/export.",
  icons: {
    icon: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${sora.variable} ${mono.variable} bg-transparent text-slate-100 antialiased`}>
        <div className="pointer-events-none fixed inset-0 -z-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_-10%,#172554_0%,transparent_42%),radial-gradient(circle_at_85%_0%,#0f172a_0%,transparent_45%),radial-gradient(circle_at_50%_100%,#1e3a8a_0%,transparent_50%),linear-gradient(180deg,#030712_0%,#020617_45%,#030712_100%)]" />
          <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(30,41,59,0.35)_1px,transparent_1px),linear-gradient(90deg,rgba(30,41,59,0.2)_1px,transparent_1px)] [background-size:28px_28px]" />
        </div>
        {children}
      </body>
    </html>
  );
}
