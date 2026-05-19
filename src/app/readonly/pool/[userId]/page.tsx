import { cookies } from "next/headers";
import { ReadOnlyBrowsePage } from "@/components/readonly-browse-page";
import {
  getReadOnlyBrowseCookieName,
  getReadOnlyBrowsePageData,
} from "@/lib/readonly-browse-repository";

export const dynamic = "force-dynamic";

type ReadOnlyPoolPageProps = {
  params: Promise<{ userId: string }>;
};

export default async function ReadOnlyPoolPage({ params }: ReadOnlyPoolPageProps) {
  const { userId } = await params;
  const cookieStore = await cookies();
  const token = cookieStore.get(getReadOnlyBrowseCookieName(userId))?.value ?? null;
  const data = await getReadOnlyBrowsePageData(BigInt(userId), token);

  return <ReadOnlyBrowsePage data={data} />;
}
