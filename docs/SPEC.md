---
title: 여행 플래너 기술 사양
version: v1.0
status: active
created: 2026-03-11
updated: 2026-03-11
owner: daehoonkim
---

## Changelog

| 버전 | 날짜  | 작성자     | 변경 내용                        |
| ---- | ----- | ---------- | -------------------------------- |
| v1.0 | 03-11 | daehoonkim | 초안 작성 — 현재 구현 기반 역기획 |

---

# SPEC: 여행 플래너 기술 사양

> **관련 문서**: [PRD](./PRD.md) | [TRD](./TRD.md) | [TASKS](./TASKS.md)

---

## 1. 입력 (Inputs)

### 1.1 여행 정보

| 필드 | 타입 | 필수 | 기본값 | 설명 |
| ---- | ---- | ---- | ------ | ---- |
| title | string | ✅ | - | 여행 제목 (1~100자) |
| destination | string | ✅ | - | 여행지 (1~200자) |
| start_date | date | ✅ | - | 출발일 (YYYY-MM-DD) |
| end_date | date | ✅ | - | 도착일 (≥ start_date) |
| cover_image_url | string | ❌ | null | 커버 이미지 URL |

**생성 시**: `create_trip_with_member` RPC로 여행 + 생성자(admin) 동시 생성. `invite_code`는 nanoid(8)로 자동 생성.

### 1.2 장소 등록

#### 수동 입력

| 필드 | 타입 | 필수 | 기본값 | 설명 |
| ---- | ---- | ---- | ------ | ---- |
| name | string | ✅ | - | 장소명 (1~200자) |
| category | enum | ✅ | "other" | accommodation / attraction / restaurant / other |
| url | string | ❌ | null | 참고 URL |
| memo | string | ❌ | null | 메모 |
| latitude | number | ❌ | null | 위도 (-90~90) |
| longitude | number | ❌ | null | 경도 (-180~180) |
| address | string | ❌ | null | 주소 |

#### Google Places 검색

| 필드 | 소스 | 설명 |
| ---- | ---- | ---- |
| name | Places API | 장소명 |
| address | Places API | 포맷 주소 |
| latitude/longitude | Places API | 좌표 |
| rating | Places API | 평점 (0~5) |
| image_urls | Places Photo | 대표 이미지 |
| google_place_id | Places API | 고유 ID (중복 방지) |

#### URL 공유 (Share Target)

| 필드 | 소스 | 설명 |
| ---- | ---- | ---- |
| source_url | 사용자 입력 | 원본 URL (최대 2048자, HTTPS만) |
| name | 풍부화 후 | 초기: "불러오는 중..." → 파싱 결과 |
| enriched | 시스템 | false → true (풍부화 완료 시) |

### 1.3 숙소 추가 필드

| 필드 | 타입 | 필수 | 설명 |
| ---- | ---- | ---- | ---- |
| price_per_night | number | ❌ | 1박 요금 (원 단위) |
| cancel_policy | string | ❌ | 취소 정책 |
| amenities | string[] | ❌ | 편의시설 목록 |
| check_in_time | string | ❌ | 체크인 시간 (HH:MM) |
| check_out_time | string | ❌ | 체크아웃 시간 (HH:MM) |

### 1.4 관광지 추가 필드

| 필드 | 타입 | 필수 | 설명 |
| ---- | ---- | ---- | ---- |
| admission_fee | number | ❌ | 입장료 (원 단위) |
| estimated_duration | number | ❌ | 예상 소요 시간 (분) |
| opening_hours | Record<string, string> | ❌ | 요일별 운영시간 |

### 1.5 일정 항목

| 필드 | 타입 | 필수 | 기본값 | 설명 |
| ---- | ---- | ---- | ------ | ---- |
| title | string | ✅ | - | 활동 제목 |
| start_time | string | ❌ | null | 시작 시간 (HH:MM) |
| end_time | string | ❌ | null | 종료 시간 (HH:MM) |
| place_id | string | ❌ | null | 연결된 장소 ID |
| memo | string | ❌ | null | 메모 |
| transport_to_next | string | ❌ | null | 다음 장소 이동수단 |
| sort_order | number | ✅ | 자동 | 정렬 순서 |

### 1.6 지출 기록

| 필드 | 타입 | 필수 | 설명 |
| ---- | ---- | ---- | ---- |
| title | string | ✅ | 지출 항목명 |
| amount | number | ✅ | 금액 (> 0) |
| currency | enum | ✅ | KRW / JPY / USD / EUR / CNY / THB / VND |
| category | enum | ✅ | accommodation / food / transport / activity / shopping / other |
| paid_by | string | ✅ | 결제자 user_id |
| date | date | ✅ | 지출 날짜 |
| memo | string | ❌ | 메모 |

### 1.7 AI 요청

| 필드 | 타입 | 필수 | 설명 |
| ---- | ---- | ---- | ---- |
| trip_id | string | ✅ | 여행 ID |
| message | string | ✅ | 사용자 메시지 |
| type | enum | ❌ | recommend / generate-schedule / route-check / fill-empty |
| history | array | ❌ | 이전 대화 히스토리 `[{ role, content }]` |

---

## 2. 출력 (Outputs)

### 2.1 대시보드

| 출력 | 설명 |
| ---- | ---- |
| 여행 카드 그리드 | 내가 참여한 여행 목록 (카드: 제목, 목적지, 날짜, 커버) |
| 여행 생성 버튼 | + 버튼으로 새 여행 생성 다이얼로그 |

### 2.2 장소 목록

| 출력 | 설명 |
| ---- | ---- |
| 장소 카드 리스트 | 이미지, 이름, 카테고리 뱃지, 투표 수, 삭제 버튼 |
| 장소 지도 | Google Maps에 모든 장소 마커 표시 |
| 투표 현황 | 장소별 좋아요 수 + 내 투표 상태 |
| 비교 페이지 | 장소 2개 이상 나란히 비교 (투표 기반) |

### 2.3 일정표

| 출력 | 설명 |
| ---- | ---- |
| 캘린더 뷰 | 날짜별 일정 목록 (date-fns 기반) |
| 타임라인 뷰 | 시간대별 일정 항목 (세로 타임라인) |
| 드래그앤드롭 | dnd-kit으로 항목 순서 변경 |
| 장소 사이드바 | 왼쪽에 미배치 장소 목록 → 일정으로 드래그 |
| 경로 지도 | 하루 동선을 지도에 표시 |

### 2.4 예산

| 출력 | 설명 |
| ---- | ---- |
| 예산 현황 | 통화별 총 예산 vs 현재 지출 |
| 지출 목록 | 카테고리 아이콘 + 금액 + 결제자 |
| 정산 현황 | 누가 누구에게 얼마 줘야 하는지 자동 계산 |
| 정산 완료 | 정산 체크 처리 |

### 2.5 AI 응답

| 출력 | 설명 |
| ---- | ---- |
| 마크다운 응답 | AI가 한국어로 추천/일정/동선 분석 결과 제공 |
| 대화 히스토리 | 바텀시트에서 이전 대화 유지 |

### 2.6 실시간

| 출력 | 설명 |
| ---- | ---- |
| 온라인 멤버 | 현재 접속 중인 멤버 아바타 표시 |
| 활동 토스트 | "OOO님이 장소를 추가했습니다" 실시간 알림 |
| 데이터 동기화 | 다른 멤버의 변경사항 자동 반영 |

---

## 3. 인증 & 접근제어

### 3.1 인증 흐름

```
비인증 → /login → Supabase OAuth (Google 등)
     → /api/auth/callback → 세션 쿠키 설정
     → /dashboard 리다이렉트
```

### 3.2 경로 보호

| 경로 패턴 | 접근 조건 |
| --------- | --------- |
| `/login`, `/signup` | 비인증만 (인증 시 → /dashboard) |
| `/join/[inviteCode]` | 인증 필요 (비인증 시 → /login) |
| `/dashboard`, `/trips/**` | 인증 필요 |
| `/api/auth/callback` | 공개 |
| `/api/**` (나머지) | JWT 인증 필수 |
| `/offline` | 공개 (PWA 폴백) |

### 3.3 역할 권한

| 동작 | admin | editor | viewer |
| ---- | ----- | ------ | ------ |
| 여행 정보 보기 | ✅ | ✅ | ✅ |
| 장소 추가/삭제 | ✅ | ✅ | ❌ |
| 장소 투표 | ✅ | ✅ | ✅ |
| 일정 편성/수정 | ✅ | ✅ | ❌ |
| 지출 기록 | ✅ | ✅ | ❌ |
| 후기 작성 | ✅ | ✅ | ✅ |
| 멤버 초대 | ✅ | ❌ | ❌ |
| 멤버 역할 변경 | ✅ | ❌ | ❌ |
| 여행 수정/삭제 | ✅ | ❌ | ❌ |

---

## 4. 규칙 (Rules)

### 4.1 URL 풍부화

| 규칙 | 값 |
| ---- | -- |
| 지원 프로토콜 | HTTPS만 (HTTP 거부) |
| URL 최대 길이 | 2,048자 |
| SSRF 방어 | DNS 해석 → 사설 IP 차단 (10.x, 172.16-31.x, 192.168.x, 127.x) |
| 응답 크기 제한 | 5MB |
| 풍부화 재시도 | enrich_attempts 기록, 수동 재시도 가능 |
| 중복 감지 | google_place_id 또는 source_url 기준 |

### 4.2 지원 스크래핑 사이트

| 도메인 | 파서 | 추출 정보 |
| ------ | ---- | --------- |
| booking.com | BookingParser | 호텔명, 주소, 평점, 가격 |
| agoda.com | AgodaParser | 호텔명, 주소, 평점, 가격 |
| airbnb.com/co.kr | AirbnbParser | 숙소명, 위치, 가격 |
| yanolja.com | YanoljaParser | 숙소명, 주소, 가격 |
| goodchoice.kr | GoodchoiceParser | 숙소명, 주소 |
| hotels.com | 메타태그 | 호텔명, 설명 |
| trip.com | 메타태그 | 호텔명, 설명 |
| expedia.com | 메타태그 | 호텔명, 설명 |
| google.com/maps | Places API | 전체 정보 |
| naver.com | 메타태그 | 장소명, 설명 |
| kakao.com | 메타태그 | 장소명, 설명 |
| (기타) | 메타태그 + JSON-LD | 제목, 설명, OG이미지 |

### 4.3 Rate Limiting

| API | 제한 | 윈도우 | 구현 |
| --- | ---- | ------ | ---- |
| `/api/places/share` | 10 req | 60초 | In-memory Map (사용자별) |
| (나머지 API) | 미적용 | - | 향후 Redis 기반 확대 |

### 4.4 AI 프롬프트 규칙

| type | 첫 메시지 동작 | 이어지는 대화 |
| ---- | ------------- | ------------ |
| recommend | 취향 질문 (음식/활동/예산) | 맞춤 추천 제공 |
| generate-schedule | 여행 강도/시작시간 질문 | 일정표 제안 |
| route-check | 현재 동선 분석 | 대안 경로 제시 |
| fill-empty | 빈 날짜 확인 + 취향 질문 | 활동 추천 |

**공통 규칙**:
- 모든 응답 한국어
- 여행 컨텍스트 (제목, 목적지, 기간, 장소, 일정) 자동 주입
- 모델: `gemini-2.0-flash`

### 4.5 Realtime 동기화

| 테이블 | 이벤트 | 무효화 대상 |
| ------ | ------ | ----------- |
| places | INSERT/UPDATE/DELETE | `["places", tripId]` |
| place_votes | * | `["places", tripId]`, `["place_votes", tripId]` |
| schedule_items | * | `["schedules", tripId]` |
| activity_logs | INSERT | `["activity_logs", tripId]` + CustomEvent |

### 4.6 PWA

| 항목 | 값 |
| ---- | -- |
| Service Worker | Serwist (프로덕션만 활성화) |
| API/Supabase 캐싱 | NetworkFirst |
| 이미지 캐싱 | CacheFirst |
| 정적 자산 캐싱 | StaleWhileRevalidate |
| Share Target | GET `/share-target?url=&title=&text=` |
| Sticky Context | 30분 내 같은 여행에 자동 저장 |
| 오프라인 폴백 | `/offline` 페이지 |

---

## 5. 유효성 검증

### 5.1 클라이언트 사이드

| 대상 | 규칙 |
| ---- | ---- |
| 여행 제목 | 1~100자, 빈 문자열 불가 |
| 여행 날짜 | end_date ≥ start_date |
| 장소명 | 1~200자 |
| 지출 금액 | > 0, 숫자만 |
| URL | HTTP/HTTPS 프로토콜 |

### 5.2 서버 사이드

| 대상 | 규칙 |
| ---- | ---- |
| JWT | Supabase Auth 검증 |
| trip_id | UUID 형식 + trip_members 존재 확인 |
| URL (Share) | 프로토콜 + 도메인 + 길이(2048) + SSRF 체크 |
| Rate Limit | 사용자별 분당 요청 수 |

---

## 6. 기본값

| 항목 | 기본값 |
| ---- | ------ |
| 장소 카테고리 | "other" |
| 예산 통화 | "KRW" |
| 멤버 역할 (초대 참가 시) | "editor" |
| 멤버 역할 (생성자) | "admin" |
| React Query staleTime | 60초 |
| React Query retry | 1회 |
| 반응형 브레이크포인트 | md (768px) |
| 사이드바 너비 (데스크톱) | 64px |
| BottomNav 높이 (모바일) | 64px |
| AI 모델 | gemini-2.0-flash |
| Share Target Sticky 기간 | 30분 |
| 풍부화 초기 상태 | enriched: false |

---

## 7. 성능 목표

| 지표 | 목표 | 측정 방법 |
| ---- | ---- | --------- |
| LCP (Largest Contentful Paint) | < 2.5s | Lighthouse |
| INP (Interaction to Next Paint) | < 200ms | Lighthouse |
| CLS (Cumulative Layout Shift) | < 0.1 | Lighthouse |
| API 응답 (일반) | < 500ms | 서버 로그 |
| AI 첫 응답 | < 3s | 사용자 체감 |
| 페이지 전환 | < 300ms | App Router |
| 동시 접속자 (여행당) | 10명 | Supabase Realtime |
