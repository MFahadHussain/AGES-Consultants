import { withAudit } from '@/lib/audit-wrapper'
import { NextResponse } from "next/server";

async function GET_HANDLER() {
  return NextResponse.json({ message: "Hello, world!" });
}
export const GET = withAudit('route.ts', GET_HANDLER);
