import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Blackbean Match Admin",
  description: "Intro platform operations dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
