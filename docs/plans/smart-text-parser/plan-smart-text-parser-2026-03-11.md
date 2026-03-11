# Smart Text Parser — 비정형 텍스트 입력 지원 구현 계획

**Goal:** PWA Share Target에서 URL+광고 혼합 텍스트를 받아 URL/장소명을 자동 파싱하고, URL 없는 텍스트도 Places API 폴백으로 처리한다.
**Architecture:** 서버 단일 진입점(Tolerant Reader) + 순수 함수 파서(resolve-input.ts) + 기존 enricher 재활용
**Tech Stack:** Next.js API Route, Google Places Text Search, TypeScript
**Date:** 2026-03-11
**Expert Panel 합의 기반:** Sam Newman, Martin Fowler, Dan Abramov, Brendan Gregg

---

## 1. 현재 데이터 흐름 (AS-IS)

```
[카카오톡/브라우저] → "공유" 버튼
    ↓
[PWA manifest.json] share_target: { params: { url, text, title } }
    ↓
[share-target/page.tsx] GET /share-target?url=...&text=...
    ↓ searchParams.get("url") || searchParams.get("text") → sharedUrl
    ↓
[handleSave] POST /api/places/share { url: sharedUrl, trip_id }
    ↓
[route.ts] new URL(url) 검증  ← ⚠️ 혼합 텍스트 여기서 실패!
    ↓ (성공 시)
[DB Insert] places { name: "불러오는 중...", enriched: false }
    ↓ after()
[enrichPlaceInBackground] → enrichFromUrl(url)
    ↓
[enricher.ts] extractPlaceName(url) → textSearch(name) → mapPlaceResult
    ↓
[DB Update] places { name, address, rating, ... enriched: true }
```

### 문제점

| # | 위치 | 문제 | 영향 |
|---|------|------|------|
| P1 | route.ts:63 | `new URL(url)` — 혼합 텍스트 즉시 실패 | 카카오톡 공유 텍스트 100% 실패 |
| P2 | route.ts:51 | `body.url` 필드만 허용 | URL 없는 텍스트 입력 불가 |
| P3 | share-target:60 | `sharedUrl` 변수명 — URL 아닌 값도 URL로 취급 | 의미론적 혼란 |
| P4 | share-target:187 | `!sharedUrl` → "공유된 URL이 없습니다" 막다른 길 | 텍스트 공유 사용자 이탈 |
| P5 | route.ts:109 | `source_url: url` — 혼합 텍스트가 DB에 저장됨 | 중복 체크 부정확 |

---

## 2. 목표 데이터 흐름 (TO-BE)

```
[카카오톡/브라우저] → "공유" 버튼
    ↓
[share-target/page.tsx] GET /share-target?url=...&text=...
    ↓ searchParams.get("url") || searchParams.get("text") → sharedInput
    ↓ (raw 텍스트 그대로 전송)
[handleSave] POST /api/places/share { url: sharedInput, trip_id }
    ↓
[route.ts] resolveInput(rawInput) → 3가지 분기
    ├─ { type: "url" }   → 기존 enrichFromUrl 파이프라인
    ├─ { type: "text" }  → textSearch(placeName) 직접 호출
    └─ { type: "error" } → 400 + rawInput 반환
    ↓
[DB Insert] places { name: "불러오는 중...", source_url: extractedUrl ?? null }
    ↓ after()
[enrichPlaceInBackground] → enrichFromUrl(url) 또는 enrichFromText(query)
    ↓
[DB Update] places { name, address, rating, ... enriched: true }
```

---

## 3. 수정 파일 목록

| 파일 | 변경 유형 | 변경 범위 |
|------|-----------|-----------|
| `src/lib/google-places/resolve-input.ts` | **신규** | 순수 함수 파서 (~40줄) |
| `src/lib/google-places/enricher.ts` | 수정 | `enrichFromText()` 함수 추가 (~20줄) |
| `src/lib/google-places/index.ts` | 수정 | export 2줄 추가 |
| `src/app/api/places/share/route.ts` | 수정 | URL 검증 → resolveInput 분기로 교체 |
| `src/app/share-target/page.tsx` | 수정 | 변수명 + 에러 UI 개선 |

**수정하지 않는 파일:** scraper/index.ts, client.ts, url-parser.ts

---

## 4. 예상 오류 & 엣지 케이스 체크리스트

### 4.1 입력 파싱 단계

| # | 입력 예시 | 예상 동작 | 위험 | 대응 |
|---|----------|----------|------|------|
| E1 | `https://trip.com/w/abc` | type: "url" → 기존 파이프라인 | 없음 | 정상 경로 |
| E2 | `추천 숙소 - MGH 호텔 (https://trip.com/w/abc)` | URL 추출 → type: "url" | 괄호 안 URL 추출 실패 | regex에 `\(https?://...\)` 패턴 포함 |
| E3 | `추천 숙소 - MGH 호텔 https://trip.com/w/abc 어쩌구` | URL 추출 → type: "url" | URL 뒤 잔여 문자 포함 | regex 종료 조건: 공백/괄호/꺾쇠 |
| E4 | `교토 아라시야마 대나무숲` | type: "text" → Places 폴백 | 너무 일반적 쿼리 → 오탐 | maxResultCount: 1, 사용자 확인 단계 |
| E5 | `내일 점심 뭐 먹지` | type: "text" → Places 검색 | 무관한 결과 반환 | 장소명 길이/패턴 가드레일 (2~100자) |
| E6 | `""` (빈 문자열) | type: "error" | 빈 값 처리 | trim() 후 길이 체크 |
| E7 | `https://evil.com/malware` | type: "url" → SSRF 방어 | 비화이트리스트 도메인 | enrichFromUrl 내부 SSRF 검증 그대로 동작 |
| E8 | `booking.com/hotel/jp/nikko` | 프로토콜 없는 URL | `new URL()` 실패 | `https://` 자동 접두 시도 |
| E9 | 2048자 이상 텍스트 | 과도한 입력 | 메모리/API 비용 | 500자 제한 + 잘라내기 |
| E10 | `🏨 호텔 추천! MGH 미츠이` | 이모지 포함 | regex 매칭 실패 | 이모지 제거 후 파싱 |
| E11 | URL 여러 개 포함 | 첫 번째 URL만 사용 | 두 번째 URL 무시됨 | 의도적 설계 — 첫 번째 우선 |

### 4.2 서버 API 단계

| # | 시나리오 | 위험 | 대응 |
|---|---------|------|------|
| E12 | 텍스트 입력 + Places API 타임아웃 | 5초 블로킹 후 실패 | AbortSignal.timeout(5000) 유지 |
| E13 | 텍스트 입력 + Places API 결과 0건 | 장소 찾기 실패 | 400 반환 + rawInput + "직접 검색해주세요" |
| E14 | 텍스트 입력 + Places API 결과 오탐 | 잘못된 장소 등록 | enriched=false로 먼저 저장, 사용자 확인 가능 |
| E15 | source_url이 null (텍스트 입력) | 중복 체크 불가 | google_place_id 기반 중복 체크 추가 |
| E16 | 기존 클라이언트가 `url` 필드로 깨끗한 URL 전송 | 하위 호환 깨짐 | `resolveInput`이 깨끗한 URL도 처리 (type: "url") |
| E17 | `body.url`이 undefined (새 클라이언트가 `input` 필드 사용) | 현재는 발생 안 함 | 향후 대비: `body.url ?? body.input` |

### 4.3 프론트엔드 단계

| # | 시나리오 | 위험 | 대응 |
|---|---------|------|------|
| E18 | 에러 응답에 rawInput이 없음 | 원문 표시 불가 | 클라이언트가 자체 보관한 sharedInput 표시 |
| E19 | 서버가 텍스트 기반 저장 성공 → 여행 선택 UI 불일치 | 저장됐지만 URL 미표시 | 저장 완료 UI에 장소명 표시 (URL 대신) |
| E20 | PWA Share Target에서 title만 오고 text/url 없음 | sharedInput 빈 값 | `searchParams.get("title")` 폴백 추가 |

---

## 5. 구현 Tasks

### Task 1: resolve-input.ts 순수 함수 생성

**Files:**
- Create: `src/lib/google-places/resolve-input.ts`
- Test: `__tests__/lib/google-places/resolve-input.test.ts` (선택)

**구현 내용:**

```typescript
export type ResolvedInput =
  | { type: "url"; url: string; rawInput: string }
  | { type: "text"; placeName: string; rawInput: string }
  | { type: "error"; reason: string; rawInput: string };

export function resolveInput(raw: string): ResolvedInput { ... }
```

**파싱 규칙 (우선순위):**
1. `trim()` 후 빈 값 → error
2. 500자 초과 → 500자로 잘라내기
3. `new URL(trimmed)` 성공 + http/https → type: "url"
4. 텍스트에서 `https?://[^\s)>\]"']+` 추출 → type: "url" (추출된 URL)
5. 프로토콜 없는 도메인 패턴 (booking.com/...) → `https://` 접두 후 type: "url"
6. 나머지: 광고 문구 제거 → 장소명 추출 → 2~100자면 type: "text"
7. 추출 실패 → type: "error"

**엣지 케이스 대응:** E1~E11 전부 커버

---

### Task 2: enricher.ts에 enrichFromText() 추가

**Files:**
- Modify: `src/lib/google-places/enricher.ts`
- Modify: `src/lib/google-places/index.ts`

**구현 내용:**

```typescript
export async function enrichFromText(
  query: string
): Promise<EnrichedPlaceData | null> {
  try {
    const results = await textSearch(query, { maxResultCount: 1 });
    if (results.length === 0) return null;
    return mapPlaceResult(results[0], "");
  } catch (err) {
    console.error("[enricher] Text search error:", err);
    return null;
  }
}
```

**주의사항:**
- `mapPlaceResult`의 두 번째 인자 `sourceUrl`이 빈 문자열 → `url` 필드가 `""` 됨
- `enrichFromUrl`은 수정 없음 (기존 동작 보존)

**엣지 케이스 대응:** E12, E13, E14

---

### Task 3: route.ts Tolerant Reader 적용

**Files:**
- Modify: `src/app/api/places/share/route.ts`

**변경 핵심:**

1. **입력 수용 확장** (51~69행 교체)
   - `new URL(url)` 직접 검증 제거
   - `resolveInput(rawInput)` 호출
   - type별 분기 처리

2. **DB 저장 시 source_url 처리** (103~118행)
   - type: "url" → `source_url: extractedUrl`
   - type: "text" → `source_url: null`, `name: placeName` (placeholder 대신)

3. **중복 체크 보강** (87~100행)
   - type: "url" → 기존 source_url 체크
   - type: "text" → google_place_id 기반 체크 (enrichment 후)

4. **enrichPlaceInBackground 분기** (140행~)
   - type: "url" → `enrichFromUrl(url)` (기존)
   - type: "text" → `enrichFromText(placeName)` (신규)

5. **응답에 rawInput 포함** (모든 응답)

**엣지 케이스 대응:** E7, E15, E16, E17

---

### Task 4: share-target/page.tsx UX 개선

**Files:**
- Modify: `src/app/share-target/page.tsx`

**변경 내용:**

1. **변수명 정리**
   - `sharedUrl` → `sharedInput`
   - `searchParams.get("title")` 폴백 추가

2. **에러 UI 개선** (344~346행)
   - 에러 텍스트만 → 원문 표시 + 액션 버튼
   - "텍스트 복사" + "직접 추가하기" 버튼

3. **빈 값 메시지 변경** (186~201행)
   - "공유된 URL이 없습니다" → "공유된 내용이 없습니다"

4. **저장 완료 UI** (213~250행)
   - URL 대신 장소명 표시 가능하도록 (서버 응답 `name` 필드 활용)

**엣지 케이스 대응:** E18, E19, E20

---

## 6. 실행 순서 & 의존성

```
Task 1 (resolve-input.ts)  ← 의존성 없음, 독립 실행 가능
    ↓
Task 2 (enricher.ts)       ← Task 1과 독립, 병렬 가능
    ↓
Task 3 (route.ts)          ← Task 1, 2에 의존
    ↓
Task 4 (share-target)      ← Task 3에 의존 (서버 응답 형식 변경)
```

---

## 7. 검증 체크리스트

### 기능 검증

- [ ] 깨끗한 URL 입력 → 기존과 동일하게 동작 (하위 호환)
- [ ] `https://trip.com/w/abc` → 정상 저장 + 풍부화
- [ ] `추천 숙소 - MGH 호텔 (https://trip.com/w/abc)` → URL 추출 → 정상 저장
- [ ] `교토 아라시야마 대나무숲` → Places 검색 → 결과 있으면 저장
- [ ] `내일 뭐 먹지` → Places 검색 실패 → 에러 + 원문 표시
- [ ] 빈 문자열 → 에러 메시지
- [ ] 2048자 초과 텍스트 → 잘라내기 후 처리

### 보안 검증

- [ ] 비화이트리스트 URL → enrichFromUrl 내부 SSRF 방어 동작 확인
- [ ] `javascript:alert(1)` → type: "error" (프로토콜 체크)
- [ ] `file:///etc/passwd` → type: "error"
- [ ] XSS 페이로드 텍스트 → 에러 UI에서 안전하게 렌더링 (React 자동 이스케이프)

### 성능 검증

- [ ] URL 입력 시 기존 대비 응답 시간 차이 없음
- [ ] 텍스트 입력 시 Places API 1회만 호출 (중복 없음)
- [ ] 전체 파이프라인 10초 이내 완료

### 하위 호환 검증

- [ ] 기존 프론트엔드 코드(`{ url: "https://..." }`)가 정상 동작
- [ ] 기존 DB 데이터(source_url이 있는 places)에 영향 없음
- [ ] enrichFromUrl 기존 호출자(scrape route 등)에 영향 없음

---

## 8. 기술부채 (이번 PR 이후)

| 항목 | 우선순위 | 설명 |
|------|---------|------|
| scrape+enrich 병렬화 | P1 | Promise.allSettled로 직렬→병렬 (최악 25초→8초) |
| enrichFromUrl 중복 fetch 제거 | P1 | scrape 결과 name을 직접 textSearch에 전달 |
| reviews 필드 lazy-load 분리 | P2 | DEFAULT_FIELD_MASK에서 제거, 상세 조회 전용 |
| 전체 파이프라인 soft timeout | P2 | 10초 budget, 초과 시 부분 데이터 반환 |
| fetchOgTitle 300ms soft timeout | P2 | 현재 4초 hard만 있음 |
| Places API 캐싱 레이어 | P2 | 같은 검색어 → 캐시 히트 |
