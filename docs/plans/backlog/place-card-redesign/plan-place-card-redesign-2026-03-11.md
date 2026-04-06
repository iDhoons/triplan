# Place Card Redesign — 실행 계획

**Goal:** 장소 카드 콘텐츠를 유저 의사결정 중심으로 개선하고, 주소를 한글로 가공하며, 바텀시트 상세 뷰를 추가한다.
**기반:** Expert Panel 3-Round 합의 (2026-03-11)
**규모:** Medium (파일 5~6개, 마이그레이션 1개)

---

## 데이터 흐름 (현재 → 개선)

```
[현재]
Google Places API (language=ko 이미 적용) → enricher.ts
  → formattedAddress를 address에 저장
  → phone/website/review_count를 memo에 밀어넣기 (안티패턴)
  → address_components 미저장

[개선]
Google Places API → enricher.ts
  → formattedAddress를 address에 저장 (유지)
  → addressComponents를 address_components JSONB에 저장 (추가)
  → phone/website/review_count는 구조화 필드에 저장 (memo 밀어넣기 제거)
  → 카드에서는 formatShortAddress(address_components) 유틸로 표시
```

## Expert Panel 최종 합의 요약

| 결정 | 내용 |
|------|------|
| 주소 스키마 | address(원본) + address_components(JSONB) **2개만** |
| 주소 표시 | 유틸 함수로 런타임 조합. DB 파생 컬럼 안 만듦 |
| 주소 포맷 | 큰→작은 한국식: "타이베이, 신이구" |
| 백필 | 일괄 백필 안 함. Lazy backfill (조회 시 채우기) |
| 상세 뷰 | 모바일: Vaul Drawer (단일 스냅) / 데스크톱: 오버레이 사이드패널 |
| 카드 콘텐츠 | 장소명+카테고리+짧은주소+평점(+리뷰수)+메모1줄 |
| 카드에서 제거 | 전화번호, 웹사이트 URL, 수정/삭제 버튼 |
| 레이아웃 | 카테고리 통일 + 고유 정보는 별도 섹션 |
| 투표 배지 | Phase 2로 분리 (카드에 아바타 스택) |

---

## Scope

- **In (Phase 1 — 이번 작업):**
  - DB 마이그레이션: address_components JSONB 컬럼 추가
  - Places API 필드마스크에 addressComponents 추가
  - enricher.ts: address_components 저장 + memo 밀어넣기 제거
  - 주소 포맷팅 유틸 함수 (formatShortAddress, formatFullAddress)
  - PlaceCard UI 리디자인 (정보 재배치, 불필요 항목 제거, 카테고리별 보조 정보)
  - 카드 클릭 → Vaul Drawer 상세 뷰 (모바일, 단일 스냅)

- **Out (Phase 2 이후):**
  - 데스크톱 사이드패널
  - 투표 아바타 배지
  - searchParams URL 동기화
  - Drawer snapPoints 중간 단계
  - Lazy backfill 로직
  - place_votes 쿼리 분리 + Realtime

---

## Action Items

### Step 1: DB 마이그레이션
- [ ] `supabase/migrations/` 에 `address_components JSONB DEFAULT NULL` 컬럼 추가
- [ ] `src/types/database.ts`의 Place 인터페이스에 `address_components` 필드 추가

### Step 2: Places API 필드마스크 확장
- [ ] `src/lib/google-places/client.ts`의 `DEFAULT_FIELD_MASK`와 `DETAIL_FIELD_MASK`에 `addressComponents` 추가
- [ ] `PlacesTextSearchResult` 인터페이스에 `addressComponents` 타입 추가

### Step 3: enricher.ts 개선
- [ ] `mapPlaceResult()`에서 `address_components`를 반환 데이터에 포함
- [ ] `EnrichedPlaceData` 인터페이스에 `address_components` 추가
- [ ] memo 밀어넣기 제거 (phone/website/review_count는 이미 구조화 필드로 저장 중이므로 memo에서 제거)

### Step 4: 주소 유틸 함수 작성
- [ ] `src/lib/utils/address.ts` 생성
- [ ] `formatShortAddress(components, fallbackAddress)` — "타이베이, 신이구" (카드용)
- [ ] `formatFullAddress(components, fallbackAddress)` — 전체 한글 주소 (상세용)
- [ ] components가 null이면 fallbackAddress 반환 (하위 호환)

### Step 5: place-form.tsx 저장 로직 수정
- [ ] payload에 `address_components` 포함 (Google 검색 결과에서 가져온 경우)
- [ ] memo 밀어넣기 제거 (place-form.tsx 206~216줄)

### Step 6: PlaceCard UI 리디자인
- [ ] 전화번호, 웹사이트 URL 표시 제거
- [ ] 주소를 `formatShortAddress()` 유틸로 표시
- [ ] 평점 옆에 리뷰 수 병합: "⭐ 4.5 (37,275)"
- [ ] 카테고리별 보조 정보 1줄 추가:
  - 숙소: "₩XX,XXX / 박"
  - 관광지: 소요시간 + 입장료
  - 맛집: 가격대 (₩~₩₩₩₩)
- [ ] 수정/삭제 버튼 → "···" 드롭다운 메뉴로 이동
- [ ] 메모 2줄 → 1줄로 축소
- [ ] 이미지 없을 때 카테고리별 placeholder

### Step 7: Vaul Drawer 상세 뷰
- [ ] Vaul(shadcn Drawer) 설치/확인
- [ ] PlacesPage에 `useState<string | null>(selectedPlaceId)` 추가
- [ ] 카드 클릭 → selectedPlaceId 설정 → Drawer 열림
- [ ] PlaceDetailContent 컴포넌트 생성 (장소 상세 정보 표시)
  - 사진 갤러리, 전체 주소(한글+원본), 평점 상세, 영업시간, 전화/웹사이트, 메모, 지도(정적), 카테고리별 고유 정보
  - 하단 고정: "일정에 추가" + "···" (편집/삭제)

### Step 8: enrich API Route 수정
- [ ] `/api/places/[id]/enrich/route.ts`의 update payload에 `address_components` 포함

### Step 9: 검증
- [ ] `npm run build` 통과
- [ ] 기존 장소 (address_components=null) 카드가 기존 address로 정상 표시되는지 확인
- [ ] 새 장소 추가 시 address_components가 저장되고 한글 주소로 표시되는지 확인

---

## Open Questions

- (없음 — Expert Panel에서 모두 해결됨)
