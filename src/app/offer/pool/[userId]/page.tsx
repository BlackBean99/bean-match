import { cookies } from "next/headers";
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

export default async function OfferPoolPage({ params, searchParams }: OfferPoolPageProps) {
  const { userId } = await params;
  const { token } = (await searchParams) ?? {};
  const cookieStore = await cookies();
  const cookieToken = cookieStore.get(getReadOnlyBrowseCookieName(userId))?.value ?? null;
  const accessToken = Array.isArray(token) ? token[0] : token ?? cookieToken;
  const data = await getReadOnlyBrowsePageData(BigInt(userId), accessToken);

  return <ReadOnlyBrowsePage data={data} />;
}
