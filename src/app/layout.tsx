import { Shell } from "@/components/shell";
import { WorkspaceProvider } from "@/components/workspace-provider";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import "./globals.css";
export const metadata: Metadata = {
  title: {
    default: "CleverTap · Customer Engagement",
    template: "%s · CleverTap",
  },
  description:
    "Understand your customers. Build meaningful connections. A full-stack CleverTap demonstration workspace.",
};
export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const jar = await cookies(),
    selected = jar.get("clevertap-project")?.value;
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <WorkspaceProvider
          initialProject={selected === "streamly" ? "streamly" : "shopwise"}
        >
          <Shell>{children}</Shell>
        </WorkspaceProvider>
      </body>
    </html>
  );
}
