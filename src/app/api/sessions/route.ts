import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/server/requireSession";
import { getSessionIdFromToken, listSessions, SESSION_COOKIE } from "@/lib/server/session";

export async function GET(req: NextRequest) {
  const unauthorized = await requireSession(req);
  if (unauthorized) return unauthorized;

  const token = req.cookies.get(SESSION_COOKIE)?.value ?? "";
  const currentSessionId = await getSessionIdFromToken(token);

  const rows = listSessions().map((s) => ({
    id: s.id,
    ip: s.ip,
    userAgent: s.user_agent,
    createdAt: s.created_at,
    lastSeenAt: s.last_seen_at,
    revoked: s.revoked_at !== null,
    current: s.id === currentSessionId,
  }));

  return NextResponse.json(rows);
}
