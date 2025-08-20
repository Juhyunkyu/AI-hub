import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { SettingsPanel } from "@/components/settings/settings-panel";
import { Section } from "@/components/section";

export default async function SettingsPage() {
  const supabase = createSupabaseServerClient();

  // 로그인 상태 확인
  const { data: session } = await supabase.auth.getUser();
  if (!session.user) {
    redirect("/login?next=/settings");
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 space-y-6">
      <Section>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">설정</h1>
        </div>
      </Section>

      <div className="grid gap-6">
        <div className="border rounded-md p-6">
          <SettingsPanel />
        </div>
      </div>
    </div>
  );
}
