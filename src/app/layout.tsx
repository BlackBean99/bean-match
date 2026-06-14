import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

const sharedOgImagePath = "/og-image.png";

async function getRequestMetadataBase() {
  const headerStore = await headers();
  const forwardedHost = headerStore.get("x-forwarded-host");
  const host = forwardedHost || headerStore.get("host");
  const forwardedProto = headerStore.get("x-forwarded-proto") || "https";

  if (!host) {
    return new URL("https://blackbean-match.ymecca730135.workers.dev");
  }

  return new URL(`${forwardedProto}://${host}`);
}

export async function generateMetadata(): Promise<Metadata> {
  const metadataBase = await getRequestMetadataBase();

  return {
    metadataBase,
    title: "Blackbean Match Admin",
    description: "Intro platform operations dashboard",
    robots: {
      index: false,
      follow: false,
      nocache: true,
    },
    openGraph: {
      type: "website",
      siteName: "Blackbean Match",
      title: "Blackbean Match Admin",
      description: "Intro platform operations dashboard",
      images: [
        {
          url: sharedOgImagePath,
          width: 1200,
          height: 630,
          alt: "Blackbean Match 공유 미리보기 이미지",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "Blackbean Match Admin",
      description: "Intro platform operations dashboard",
      images: [sharedOgImagePath],
    },
  };
}

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
