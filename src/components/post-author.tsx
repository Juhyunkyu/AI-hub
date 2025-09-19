import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { AdminIcon } from "@/components/admin-icon";
import { User } from "lucide-react";

interface PostAuthorProps {
  isNotice?: boolean;
  isAnonymous?: boolean;
  author?: {
    id: string;
    username: string | null;
    avatar_url: string | null;
  } | null;
  showIcon?: boolean;
  size?: "sm" | "md";
}

export function PostAuthor({ 
  isNotice = false, 
  isAnonymous = false, 
  author, 
  showIcon = true,
  size = "sm" 
}: PostAuthorProps) {
  const avatarSize = size === "sm" ? "size-5" : "size-6";
  const textSize = size === "sm" ? "text-[10px]" : "text-xs";
  
  // 공지글인 경우 항상 관리자로 표시
  if (isNotice) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <Avatar className={avatarSize}>
          <AvatarImage src={undefined} alt="관리자" />
          <AvatarFallback className={textSize}>
            {showIcon ? <AdminIcon className="h-3 w-3" /> : "관"}
          </AvatarFallback>
        </Avatar>
        <span>· 관리자</span>
      </span>
    );
  }
  
  // 익명 게시글인 경우
  if (isAnonymous) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <Avatar className={avatarSize}>
          <AvatarImage src={undefined} alt="익명" />
          <AvatarFallback className={textSize}>
            <User className="h-3 w-3" />
          </AvatarFallback>
        </Avatar>
        <span>· 익명</span>
      </span>
    );
  }
  
  // 일반 게시글인 경우 - 작성자 정보 표시
  // author 정보가 없는 경우는 데이터베이스에서 정보를 가져오지 못한 경우
  const name = author?.username || "알 수 없는 사용자";
  const avatarUrl = author?.avatar_url ?? undefined;
  const fallbackChar = author?.username ? author.username.charAt(0).toUpperCase() : "?";

  // 작성자 정보가 완전히 없는 경우 (삭제된 계정 등)
  if (!author) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <Avatar className={avatarSize}>
          <AvatarImage src={undefined} alt="알 수 없는 사용자" />
          <AvatarFallback className={textSize}>
            <User className="h-3 w-3" />
          </AvatarFallback>
        </Avatar>
        <span>· 알 수 없는 사용자</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <Avatar className={avatarSize}>
        <AvatarImage src={avatarUrl} alt={name} />
        <AvatarFallback className={textSize}>
          {fallbackChar}
        </AvatarFallback>
      </Avatar>
      <span>· {name}</span>
    </span>
  );
}