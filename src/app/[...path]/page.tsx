import { Loading } from "@/components/ui";
import { WorkspaceRouter } from "@/components/workspace-router";
import { notFound } from "next/navigation";
import { Suspense } from "react";
export default async function Page({
  params,
}: {
  params: Promise<{ path: string[] }>;
}) {
  const { path } = await params;
  if (
    ![
      "overview",
      "boards",
      "analytics",
      "segments",
      "people",
      "campaigns",
      "templates",
      "journeys",
      "data",
      "settings",
    ].includes(path[0])
  )
    notFound();
  return (
    <Suspense fallback={<Loading />}>
      <WorkspaceRouter />
    </Suspense>
  );
}
