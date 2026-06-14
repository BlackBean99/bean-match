import { cookies } from "next/headers";
import type { Metadata } from "next";
import { ReadOnlyBrowsePage } from "@/components/readonly-browse-page";
import {
  getReadOnlyBrowseCookieName,
  getReadOnlyBrowsePageData,
} from "@/lib/readonly-browse-repository";

export const dynamic = "force-dynamic";

type OfferPoolPageProps = {
  params: Promise<{ userId: string }>;
  searchParams?: Promise<{ token?: string | string[] }>;
};

export async function generateMetadata({ params }: OfferPoolPageProps): Promise<Metadata> {
  const { userId } = await params;

  return {
    title: "Blackbean Match | 오퍼 프로필 둘러보기",
    description: "카카오톡과 외부 공유용 프로필 열람 페이지입니다. 연락처는 연결 전까지 노출되지 않습니다.",
    alternates: {
      canonical: `/offer/pool/${userId}`,
    },
    robots: {
      index: true,
      follow: true,
      nocache: true,
    },
    openGraph: {
      type: "website",
      url: `/offer/pool/${userId}`,
      siteName: "Blackbean Match",
      title: "Blackbean Match | 오퍼 프로필 둘러보기",
      description: "카카오톡과 외부 공유용 프로필 열람 페이지입니다. 연락처는 연결 전까지 노출되지 않습니다.",
    },
    twitter: {
      card: "summary_large_image",
      title: "Blackbean Match | 오퍼 프로필 둘러보기",
      description: "카카오톡과 외부 공유용 프로필 열람 페이지입니다. 연락처는 연결 전까지 노출되지 않습니다.",
    },
  };
}

export default async function OfferPoolPage({ params, searchParams }: OfferPoolPageProps) {
  const { userId } = await params;
  const { token } = (await searchParams) ?? {};
  const cookieStore = await cookies();
  const cookieToken = cookieStore.get(getReadOnlyBrowseCookieName(userId))?.value ?? null;
  const accessToken = Array.isArray(token) ? token[0] : token ?? cookieToken;
  const data = await getReadOnlyBrowsePageData(BigInt(userId), accessToken);

  return <ReadOnlyBrowsePage data={data} />;
}
