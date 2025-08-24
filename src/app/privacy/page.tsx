import { Section } from "@/components/section";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <Section title="개인정보 처리방침 (AI Hub)">
        <div className="prose dark:prose-invert max-w-none text-sm">
          <h2>1. 총칙</h2>
          <p>
            AI Hub는 이용자의 개인정보를 중요하게 생각하며, 관련 법령에 따라
            안전하게 보호하기 위해 최선을 다합니다.
          </p>
          <h2>2. 수집하는 개인정보 항목</h2>
          <ul>
            <li>필수: 이메일, 닉네임, 프로필 정보</li>
            <li>선택: 소셜 계정 연동 정보</li>
          </ul>
          <h2>3. 개인정보의 이용 목적</h2>
          <ul>
            <li>회원 식별 및 서비스 제공</li>
            <li>서비스 품질 향상 및 문의 대응</li>
            <li>법령 준수 및 분쟁 대응</li>
          </ul>
          <h2>4. 보관 및 파기</h2>
          <p>
            서비스 이용 종료 시 관련 법령이 정한 보존 기간을 제외하고 지체 없이
            파기합니다.
          </p>
          <h2>5. 제3자 제공</h2>
          <p>
            법령에 근거하거나 사전 동의를 받은 경우를 제외하고 제3자에게
            제공하지 않습니다.
          </p>
          <h2>6. 이용자의 권리</h2>
          <p>
            이용자는 언제든지 자신의 개인정보 열람·정정·삭제를 요청할 수 있으며,
            서비스는 관련 법령에 따라 신속히 조치합니다.
          </p>
          <h2>7. 문의</h2>
          <p>
            개인정보 관련 문의는 공지사항 또는 고객지원 채널을 통해 접수해
            주시기 바랍니다.
          </p>
        </div>
      </Section>
    </div>
  );
}
