import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ora",
  description: "AI-powered comprehension checks for CS courses",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
