import { redirect } from "next/navigation";
import { getReadOnlyBrowseAccessPath } from "@/lib/readonly-browse-repository";

export const dynamic = "force-dynamic";

type ReadOnlyPoolPageProps = {
  params: Promise<{ userId: string }>;
};

export default async function ReadOnlyPoolPage({ params }: ReadOnlyPoolPageProps) {
  const { userId } = await params;
  redirect(getReadOnlyBrowseAccessPath(userId));
}
