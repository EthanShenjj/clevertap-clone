import { handleStoredApi } from "@/server/cloud-storage";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ path: string[] }> };
async function handle(request: Request, context: Context) {
  return handleStoredApi(request, (await context.params).path);
}
export { handle as DELETE, handle as GET, handle as PATCH, handle as POST };
