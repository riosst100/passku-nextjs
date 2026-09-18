import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/server/db";
import { requireSession } from "@/lib/server/requireSession";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauthorized = await requireSession(req);
  if (unauthorized) return unauthorized;

  const { id } = await params;
  db.prepare("DELETE FROM credentials WHERE id = ?").run(id);
  return NextResponse.json({ ok: true });
}
