import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function checkAdminRole(userId: string): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  return profile?.role === "admin";
}

export async function requireAdmin(userId: string): Promise<void> {
  const isAdmin = await checkAdminRole(userId);
  
  if (!isAdmin) {
    throw new Error("관리자 권한이 필요합니다.");
  }
}
