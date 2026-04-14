import { redirect } from "next/navigation";

// Magic Link 로그인은 자동으로 신규 가입을 처리하므로
// 별도 회원가입 페이지가 필요 없습니다.
export default function SignupPage() {
  redirect("/login");
}
