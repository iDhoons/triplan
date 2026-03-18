import type { ChecklistCategory } from "@/types/database";

/**
 * 카테고리별 키워드 사전.
 * 키워드 매칭은 title.includes(keyword) — 부분 문자열 매칭.
 */
const CATEGORY_KEYWORDS: Record<ChecklistCategory, string[]> = {
  documents: [
    "여권", "비자", "visa", "신분증", "주민등록", "항공권", "티켓",
    "e티켓", "보험", "여행자보험", "증명서", "국제면허", "운전면허",
    "입국신고", "출입국", "예방접종", "바우처", "초청장", "비자사진",
  ],
  clothing: [
    "옷", "의류", "반팔", "긴팔", "바지", "치마", "속옷", "양말",
    "잠옷", "수영복", "비키니", "모자", "장갑", "목도리", "스카프",
    "재킷", "코트", "패딩", "점퍼", "신발", "슬리퍼", "운동화",
    "샌들", "구두", "부츠", "셔츠", "티셔츠", "원피스", "정장",
    "넥타이", "벨트", "래시가드",
  ],
  electronics: [
    "충전기", "보조배터리", "어댑터", "변환기", "카메라", "이어폰",
    "에어팟", "헤드폰", "노트북", "태블릿", "아이패드", "usb",
    "케이블", "셀카봉", "삼각대", "멀티탭", "핸드폰", "스마트폰",
    "킨들", "드론", "sd카드", "메모리카드", "배터리", "포켓와이파이",
    "유심", "esim", "와이파이",
  ],
  hygiene: [
    "칫솔", "치약", "샴푸", "린스", "바디워시", "선크림", "자외선",
    "로션", "크림", "화장품", "파운데이션", "립밤", "면도기", "면도",
    "상비약", "진통제", "소화제", "밴드", "반창고", "손톱깎이",
    "수건", "타월", "물티슈", "마스크", "렌즈", "콘택트", "세안",
    "클렌징", "보습", "핸드크림", "비타민", "영양제", "해열제",
    "소독", "모기약", "벌레퇴치", "생리용품", "약통",
  ],
  shared: [
    "우산", "가이드북", "지도", "자물쇠", "캐리어", "백팩",
    "에코백", "비닐봉지", "지퍼백", "세탁망", "압축팩", "보조가방",
    "필기구", "펜", "노트",
  ],
  todo: [
    "예약", "환전", "신청", "연락", "확인", "취소", "등록", "신고",
    "체크인", "체크아웃", "짐싸기", "짐정리", "전기", "가스",
    "우편물", "세탁", "인수인계", "병원", "미용실", "택배",
  ],
  shopping: [
    "선물", "쇼핑", "구매", "기념품", "면세점", "마트", "특산품",
    "과자", "초콜릿",
  ],
};

/**
 * 키워드 매칭으로 카테고리를 분류한다.
 * 일치하는 키워드가 없으면 null을 반환한다.
 */
export function classifyByKeyword(title: string): ChecklistCategory | null {
  const normalized = title.toLowerCase().trim();
  if (!normalized) return null;

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const keyword of keywords) {
      if (normalized.includes(keyword.toLowerCase())) {
        return category as ChecklistCategory;
      }
    }
  }

  return null;
}
