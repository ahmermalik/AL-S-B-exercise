import type { Metadata } from "next";
import { ReviewPackageScreen } from "@/components/review-package";
export default async function Page({ searchParams }: { searchParams: Promise<{ propertyId?: string }> }) { const { propertyId } = await searchParams; return <ReviewPackageScreen key={propertyId || "P105"} propertyId={propertyId || "P105"} />; }
export const metadata: Metadata = { title: "Review package" };
