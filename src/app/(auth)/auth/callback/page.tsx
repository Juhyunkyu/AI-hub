"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { toast } from "sonner";

export default function AuthCallbackPage() {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          console.error("Auth callback error:", error);
          toast.error("인증 처리 중 오류가 발생했습니다");
          router.push("/login");
          return;
        }

        if (data.session) {
          toast.success("로그인이 완료되었습니다");
          router.push("/");
        } else {
          router.push("/login");
        }
      } catch (error) {
        console.error("Auth callback error:", error);
        toast.error("인증 처리 중 오류가 발생했습니다");
        router.push("/login");
      }
    };

    handleAuthCallback();
  }, [router, supabase]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
        <p className="mt-4 text-gray-600">인증 처리 중...</p>
      </div>
    </div>
  );
}