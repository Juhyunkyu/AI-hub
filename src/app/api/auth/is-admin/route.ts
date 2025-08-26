import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function isAdmin(userId: string | null): boolean {
  const allowed = (process.env.ADMIN_USER_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!allowed.length) return false;
  if (!userId) return false;
  return allowed.includes(userId);
}

export async function GET() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return NextResponse.json({ isAdmin: isAdmin(user?.id ?? null) });
}


