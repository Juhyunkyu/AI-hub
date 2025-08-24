import { Section } from "@/components/section";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <Section title="개인정보 처리방침 (AI Hub)">
        <div className="prose dark:prose-invert max-w-none text-[0.95rem] leading-7">
          <h2 className="mt-0">1. 총칙</h2>
          <div className="pl-4">
            <p>
              AI Hub는 이용자의 개인정보를 소중히 여기며, 「개인정보 보호법」 등
              관련 법령을 준수합니다. 본 방침은 수집하는 개인정보의 항목, 이용
              목적, 보관 및 파기, 제3자 제공, 이용자 권리 등을 규정합니다.
            </p>
          </div>

          <div className="my-5" />

          <h2>2. 수집하는 개인정보 항목</h2>
          <div className="pl-4">
            <ul>
              <li>필수: 이메일, 닉네임, 프로필(아바타) 정보, 인증 식별자</li>
              <li>선택: 소셜 계정 연동 정보, 추가 입력 프로필</li>
              <li>자동수집: 접속 로그, 접속 IP, 디바이스/브라우저 정보</li>
            </ul>
          </div>

          <div className="my-4" />

          <h2>3. 개인정보의 이용 목적</h2>
          <div className="pl-4">
            <ul>
              <li>회원 식별, 로그인 및 계정 관리</li>
              <li>커뮤니티 운영(게시/댓글/신고 처리), 서비스 품질 개선</li>
              <li>법령 준수 및 분쟁 대응, 보안·부정이용 방지</li>
            </ul>
          </div>

          <div className="my-4" />

          <h2>4. 보관 및 파기</h2>
          <div className="pl-4">
            <p>
              목적 달성 시 지체 없이 파기하며, 관련 법령상 보존 의무가 있는 경우
              해당 기간 동안 안전하게 보관 후 파기합니다. 전자적 파일은 복구가
              불가능한 방법으로 안전하게 삭제합니다.
            </p>
          </div>

          <div className="my-4" />

          <h2>5. 제3자 제공 및 처리위탁</h2>
          <div className="pl-4">
            <p>
              법령에 근거하거나 이용자의 사전 동의가 있는 경우를 제외하고
              제3자에게 제공하지 않습니다. 서비스 운영상 필요한 경우 최소한의
              범위에서 처리위탁을 할 수 있으며, 수탁사와의 계약을 통해 안전성을
              확보합니다.
            </p>
          </div>

          <div className="my-4" />

          <h2>6. 이용자의 권리</h2>
          <div className="pl-4">
            <p>
              이용자는 언제든지 자신의 개인정보에 대한 열람·정정·삭제·처리정지를
              요청할 수 있으며, 회사는 관련 법령에 따라 신속히 조치합니다.
            </p>
          </div>

          <div className="my-4" />

          <h2>7. 안전성 확보 조치</h2>
          <div className="pl-4">
            <p>
              개인정보의 안전한 처리를 위하여 접근권한 관리, 암호화, 로그 관리,
              물리적 접근 통제 등 합리적인 보호조치를 시행합니다.
            </p>
          </div>

          <div className="my-4" />

          <h2>8. 문의처</h2>
          <div className="pl-4">
            <p>
              개인정보 보호 관련 문의는 공지사항 또는 고객지원 채널을 통해
              접수해 주시기 바랍니다.
            </p>
          </div>
        </div>
      </Section>
    </div>
  );
}
