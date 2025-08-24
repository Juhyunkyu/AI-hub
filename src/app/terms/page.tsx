import { Section } from "@/components/section";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <Section title="이용약관 (AI Hub)">
        <div className="mb-4 text-xs text-muted-foreground">
          최종 업데이트: {new Date().toLocaleDateString()}
        </div>
        <nav className="mb-6 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <a href="#t1" className="px-3 py-2 rounded border hover:bg-accent">
            1. 목적
          </a>
          <a href="#t2" className="px-3 py-2 rounded border hover:bg-accent">
            2. 정의
          </a>
          <a href="#t3" className="px-3 py-2 rounded border hover:bg-accent">
            3. 효력과 변경
          </a>
          <a href="#t4" className="px-3 py-2 rounded border hover:bg-accent">
            4. 회원의 의무
          </a>
          <a href="#t5" className="px-3 py-2 rounded border hover:bg-accent">
            5. 제공·변경
          </a>
          <a href="#t6" className="px-3 py-2 rounded border hover:bg-accent">
            6. 게시물 관리
          </a>
          <a href="#t7" className="px-3 py-2 rounded border hover:bg-accent">
            7. 저작권
          </a>
          <a href="#t8" className="px-3 py-2 rounded border hover:bg-accent">
            8. 면책
          </a>
          <a href="#t9" className="px-3 py-2 rounded border hover:bg-accent">
            9. 준거법·관할
          </a>
        </nav>
        <div className="prose dark:prose-invert max-w-none text-sm leading-relaxed">
          <h2 id="t1">1. 목적</h2>
          <p>
            본 약관은 AI Hub(이하 “서비스”)의 제공 및 이용에 관한 회사와 회원
            간의 권리·의무 및 책임사항, 기타 필요한 사항을 규정함을 목적으로
            합니다.
          </p>
          <hr />
          <h2 id="t2">2. 정의</h2>
          <ul>
            <li>“회원”: 본 약관에 동의하고 서비스를 이용하는 자</li>
            <li>
              “게시물”: 회원이 서비스에 업로드한 글, 댓글, 이미지, 영상 등
              일체의 콘텐츠
            </li>
          </ul>
          <hr />
          <h2 id="t3">3. 약관의 효력과 변경</h2>
          <p>
            회사는 관련 법령을 위반하지 않는 범위에서 본 약관을 개정할 수
            있으며, 개정 시 적용일자 및 개정사유를 사전에 공지합니다. 회원은
            변경된 약관에 동의하지 않을 권리가 있으며, 동의하지 않을 경우 서비스
            이용을 중단할 수 있습니다.
          </p>
          <div className="border-l-2 pl-3 my-4 text-xs text-muted-foreground">
            약관 변경 공지는 공지사항을 통해 고지됩니다.
          </div>
          <h2 id="t4">4. 회원의 의무</h2>
          <ul>
            <li>법령, 본 약관, 서비스 공지와 가이드에 따른 준수사항을 이행</li>
            <li>
              타인의 권리 침해, 불법 정보 유통, 서비스 운영 방해 행위 금지
            </li>
            <li>계정·비밀번호를 본인이 관리하고 제3자와 공유·양도 금지</li>
          </ul>
          <hr />
          <h2 id="t5">5. 서비스의 제공 및 변경</h2>
          <p>
            회사는 안정적인 서비스 제공을 위해 노력하며, 운영상·기술상의 필요에
            따라 서비스 내용을 변경 또는 중단할 수 있습니다. 이 경우 사전에
            공지합니다.
          </p>
          <hr />
          <h2 id="t6">6. 게시물의 관리</h2>
          <p>
            게시물의 책임은 게시자에게 있으며, 관련 법령 또는 본 약관을 위반하는
            게시물은 사전 통지 없이 게시중단, 삭제, 접근 제한 등의 조치가
            이루어질 수 있습니다.
          </p>
          <hr />
          <h2 id="t7">7. 저작권</h2>
          <p>
            게시물의 저작권은 원칙적으로 게시자에게 귀속됩니다. 회사는 서비스
            운영·홍보·개선을 위해 합리적인 범위에서 게시물을 활용할 수 있으며,
            회원은 이에 동의합니다.
          </p>
          <hr />
          <h2 id="t8">8. 면책</h2>
          <p>
            회사는 천재지변, 불가항력, 회원의 귀책사유 등으로 발생한 손해에 대해
            책임을 지지 않습니다.
          </p>
          <hr />
          <h2 id="t9">9. 준거법 및 관할</h2>
          <p>
            본 약관은 대한민국 법령을 준거법으로 하며, 분쟁 발생 시 관련 법령에
            따른 법원을 전속 관할로 합니다.
          </p>
          {/* 상단 이동 링크 제거 요청 반영 */}
        </div>
      </Section>
    </div>
  );
}
