import { handleApi } from "@/server/api";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ path: string[] }> };
async function handle(request: Request, context: Context) {
  return handleApi(request, (await context.params).path);
}
export { handle as DELETE, handle as GET, handle as PATCH, handle as POST };
