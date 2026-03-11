# UX 우선순위 개선 설계서

**Goal:** Business Panel + UX 리뷰에서 도출된 P0~P1 개선사항 7개를 설계하고 구현한다.
**원칙:** 최소 변경으로 최대 효과. 새 파일 최소화, 기존 컴포넌트 수정 위주.

---

## 1. PlaceForm Progressive Disclosure (P0/P1 통합)

### 현재 문제
- 14개+ 필드가 한 화면에 나열 (모바일에서 스크롤 과다)
- 영업시간 JSON 직접 입력 (사용자 적대적)
- URL 레이블이 "호텔 예약 사이트"로 한정

### 설계

**구조**: 2단계 Collapsible 패턴

```
┌─────────────────────────────────┐
│ [지도 검색] | [URL 붙여넣기]     │  ← 기존 탭 유지
├─────────────────────────────────┤
│ 장소명 *          [자동 입력됨]  │  ← 필수
│ 카테고리 *        [자동 입력됨]  │  ← 필수
│ 메모                            │  ← 기본 노출
├─────────────────────────────────┤
│ ▶ 상세 정보 펼치기              │  ← Collapsible (기본 접힘)
│   ├ 평점 / URL                  │
│   ├ 주소                        │
│   ├ 이미지 업로드               │
│   ├ [숙소] 가격/체크인아웃/시설  │
│   └ [관광지] 입장료/소요시간     │
├─────────────────────────────────┤
│           [취소] [추가]          │
└─────────────────────────────────┘
```

**핵심 변경:**
- 자동 채워진 필드: 상세 섹션이 자동 펼침 + 필드에 일시적 하이라이트
- 영업시간: JSON Textarea 삭제 → 자동 수집된 데이터만 표시 (읽기 전용 텍스트)
- URL 레이블: "호텔 예약 사이트 URL" → "장소 URL을 붙여넣으세요"
- placeholder: "https://www.booking.com/hotel/..." → "네이버 지도, 구글맵, 부킹닷컴 등"

**파일:** `src/components/places/place-form.tsx`

### 영업시간 처리 변경

**Before:** JSON Textarea (수동 입력)
```tsx
<Textarea placeholder='{"월": "09:00-18:00"}' />
```

**After:** 읽기 전용 표시 (자동 수집 데이터만)
```tsx
{form.opening_hours && (
  <div className="text-xs text-muted-foreground space-y-0.5">
    <p className="font-medium">영업시간 (자동 수집)</p>
    {Object.entries(JSON.parse(form.opening_hours)).map(([day, hours]) => (
      <p key={day}>{day}: {hours}</p>
    ))}
  </div>
)}
```
- 사용자가 직접 영업시간을 JSON으로 입력할 필요 제거
- Google Places API / 스크래핑으로 자동 수집된 데이터만 표시
- 폼 제출 시 opening_hours는 기존 값을 그대로 전달

---

## 2. 에러 메시지 한글화 (P0)

### 현재 문제
- `error.message` 그대로 노출: "Invalid login credentials", "User already registered" 등

### 설계

**위치:** `src/lib/error-messages.ts` (새 파일, 유틸)

```typescript
const ERROR_MAP: Record<string, string> = {
  "Invalid login credentials": "이메일 또는 비밀번호가 올바르지 않습니다",
  "Email not confirmed": "이메일 인증이 필요합니다. 메일함을 확인해주세요",
  "User already registered": "이미 가입된 이메일입니다",
  "Password should be at least 6 characters": "비밀번호는 6자 이상이어야 합니다",
  "Email rate limit exceeded": "너무 많은 요청입니다. 잠시 후 다시 시도해주세요",
  "Signup requires a valid password": "유효한 비밀번호를 입력해주세요",
};

export function humanizeError(message: string): string {
  return ERROR_MAP[message] ?? message;
}
```

**적용 파일:**
- `src/app/(auth)/login/page.tsx:31` → `setError(humanizeError(error.message))`
- `src/app/(auth)/signup/page.tsx:38` → `setError(humanizeError(error.message))`

---

## 3. Share Target 온보딩 배너 (P1)

### 현재 문제
- Share Target이 핵심 차별점이나 사용자가 존재를 모름
- 대시보드에 안내 없음

### 설계

**위치:** `src/app/(main)/dashboard/page.tsx` — 여행 목록 위에 배너 추가

```
┌─────────────────────────────────────────────┐
│ 💡 네이버 지도, 구글맵에서 공유 버튼만       │
│    누르면 장소가 자동으로 저장됩니다!        │
│    [앱 설치하기]              [다시 보지않기] │
└─────────────────────────────────────────────┘
```

**동작:**
- `localStorage.getItem("hide-share-tip")` 체크 → 숨김 여부 결정
- "다시 보지않기" 클릭 → localStorage에 저장
- PWA 미설치 상태에서만 "앱 설치하기" 버튼 노출
- 여행이 1개 이상일 때만 표시 (빈 상태에선 다른 메시지)

**빈 상태 개선:**
```
여행이 없어요 → "새 여행을 만들어 보세요!"
↓ 변경
"새 여행을 만들고, 네이버 지도에서 장소를 공유해보세요"
```

---

## 4. 삭제 Undo 구현 (P1)

### 현재 문제
- `window.confirm()` → 즉시 DB 삭제 (비가역적)
- 네이티브 confirm은 앱 디자인과 불일치

### 설계

**패턴:** sonner toast + soft delete (5초 딜레이)

```typescript
// 삭제 흐름
function handleDelete(place: Place) {
  // 1. UI에서 즉시 제거 (optimistic)
  setPlaces(prev => prev.filter(p => p.id !== place.id));

  // 2. 5초 타이머 시작
  const timeoutId = setTimeout(async () => {
    await supabase.from("places").delete().eq("id", place.id);
  }, 5000);

  // 3. toast로 Undo 제공
  toast(`"${place.name}" 삭제됨`, {
    action: {
      label: "되돌리기",
      onClick: () => {
        clearTimeout(timeoutId);
        setPlaces(prev => [...prev, place]); // 복원
      },
    },
    duration: 5000,
  });
}
```

**적용 파일:**
- `src/app/(main)/trips/[tripId]/places/page.tsx:211`
- `src/app/(main)/trips/[tripId]/places/[placeId]/page.tsx:115`
- `src/app/(main)/trips/[tripId]/members/page.tsx:107`

**의존성:** `sonner`가 이미 설치되어 있는지 확인 필요. 없으면 shadcn/ui toast 사용.

---

## 5. 자동 채움 피드백 (P1)

### 현재 문제
- URL 스크래핑/검색 후 어떤 필드가 채워졌는지 시각적 피드백 없음

### 설계

**패턴:** 채워진 필드에 2초간 하이라이트 + "자동 입력" 배지

```typescript
// 자동 채움 필드 추적
const [autoFilledFields, setAutoFilledFields] = useState<Set<string>>(new Set());

function applyScrapeResult(data: ScrapedPlace) {
  const filled = new Set<string>();
  if (data.name) filled.add("name");
  if (data.address) filled.add("address");
  if (data.rating) filled.add("rating");
  // ...
  setAutoFilledFields(filled);

  // 2초 후 하이라이트 제거
  setTimeout(() => setAutoFilledFields(new Set()), 2000);
}
```

**CSS:**
```tsx
<Input
  className={cn(
    autoFilledFields.has("name") && "ring-2 ring-primary/50 bg-primary/5 transition-all"
  )}
/>
```

---

## 구현 배치

| 배치 | 작업 | 파일 수 | 예상 효과 |
|:----:|------|:------:|----------|
| **Batch 1** | 에러 한글화 + URL 레이블 수정 | 3개 | 즉각적 UX 개선, 30초 수정급 |
| **Batch 2** | PlaceForm Progressive Disclosure + 영업시간 | 1개 | 모바일 UX 대폭 개선 |
| **Batch 3** | Share Target 온보딩 배너 | 1개 | 핵심 기능 발견성 |
| **Batch 4** | 삭제 Undo + 자동채움 피드백 | 3개 | 안전성 + 피드백 |
