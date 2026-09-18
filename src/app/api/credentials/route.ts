import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/server/db";
import { requireSession } from "@/lib/server/requireSession";

interface CredentialRow {
  id: string;
  site: string;
  data: string;
  created_at: number;
  updated_at: number;
}

export async function GET(req: NextRequest) {
  const unauthorized = await requireSession(req);
  if (unauthorized) return unauthorized;

  const rows = db
    .prepare("SELECT * FROM credentials ORDER BY site")
    .all() as CredentialRow[];

  return NextResponse.json(
    rows.map((r) => ({
      id: r.id,
      site: r.site,
      data: r.data,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }))
  );
}

export async function POST(req: NextRequest) {
  const unauthorized = await requireSession(req);
  if (unauthorized) return unauthorized;

  const body = await req.json();
  const { id, site, data, createdAt, updatedAt } = body as {
    id: string;
    site: string;
    data: string;
    createdAt: number;
    updatedAt: number;
  };

  if (!id || !site || !data) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  db.prepare(
    `INSERT INTO credentials (id, site, data, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET site = excluded.site, data = excluded.data, updated_at = excluded.updated_at`
  ).run(id, site, data, createdAt ?? Date.now(), updatedAt ?? Date.now());

  return NextResponse.json({ ok: true });
}
