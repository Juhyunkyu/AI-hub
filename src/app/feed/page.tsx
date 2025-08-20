import { redirect } from "next/navigation";

export default function FeedPage() {
  // 기존 피드 페이지를 자유게시판으로 리다이렉트
  redirect("/categories/free");
}
