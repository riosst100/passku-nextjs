import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/server/requireSession";
import { getSessionIdFromToken, revokeSession, SESSION_COOKIE } from "@/lib/server/session";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireSession(req);
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const token = req.cookies.get(SESSION_COOKIE)?.value ?? "";
  const currentSessionId = await getSessionIdFromToken(token);

  revokeSession(id);

  const res = NextResponse.json({ ok: true });
  if (id === currentSessionId) {
    res.cookies.delete(SESSION_COOKIE);
  }
  return res;
}
