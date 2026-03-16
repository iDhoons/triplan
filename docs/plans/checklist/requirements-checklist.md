# 여행 준비물 공동 체크리스트 — 요구사항 명세

> **작성일**: 2026-03-16
> **상태**: 요구사항 확정
> **다음 단계**: `/sc:design` → 아키텍처 설계 또는 `/sc:workflow` → 구현 계획

---

## 1. 기능 요약

여행 멤버 전원이 공유하는 준비물/할 일 체크리스트.
카테고리별 분류, 담당자 배정, 우선순위 정렬, 체크 히스토리 추적, 실시간 동기화.

---

## 2. 기능 요구사항 (Functional Requirements)

### FR1. 체크리스트 CRUD

| 동작 | 설명 |
|------|------|
| 추가 | 이름(필수), 카테고리(필수), 담당자(선택), 메모(선택), 우선순위(선택) |
| 수정 | 모든 필드 편집 가능 |
| 삭제 | 확인 후 제거 |
| 체크 토글 | 탭/클릭으로 완료/미완료 전환. **모든 역할(viewer 포함) 가능** |

### FR2. 카테고리 (7개 고정)

| 카테고리 | key | 설명 |
|----------|-----|------|
| 필수 서류 | `documents` | 여권, 비자, 보험증서 |
| 의류 | `clothing` | 겉옷, 속옷, 수영복 |
| 전자기기 | `electronics` | 충전기, 와이파이에그, 어댑터 |
| 세면/의약 | `hygiene` | 세면도구, 상비약, 선크림 |
| 공동 준비물 | `shared` | 보드게임, 간식, 구급키트 |
| 할 일 | `todo` | 환전, 보험 가입, 숙소 확인 |
| 쇼핑 | `shopping` | 현지에서 살 것들 |

### FR3. 담당자 배정

- trip_members 중 1명 선택 또는 미배정
- 기본값: 미배정
- 언제든 변경 가능

### FR4. 우선순위

| 우선순위 | key | 표시 |
|----------|-----|------|
| 높음 | `high` | 빨간 뱃지 |
| 보통 | `medium` | 기본 (표시 없음) |
| 낮음 | `low` | 회색 |

- 기본값: `medium`

### FR5. 정렬 옵션

| 정렬 기준 | 설명 |
|-----------|------|
| 수동 (드래그) | 카테고리 내에서 드래그앤드롭으로 순서 변경 |
| 생성순 | created_at 오름차순 (기본값) |
| 급한순서 | priority high → medium → low, 미완료 우선 |

### FR6. 카테고리별 뷰

- 기본: 카테고리별 섹션 그룹핑
- 각 카테고리 헤더에 진행률 표시 (예: "3/7")
- 카테고리 접기/펼치기

### FR7. 체크 히스토리 추적

- 누가, 언제, 어떤 항목을 체크/언체크했는지 기록
- 기존 `activity_logs` 테이블 활용 또는 전용 로그 테이블
- UI: 항목별 "히스토리 보기" (간단한 타임라인)

### FR8. 네비게이션

- `tripNav`에 체크리스트 탭 추가
- 위치: 예산 다음, 후기 앞 → `[장소, 일정, 예산, 체크리스트, 후기, 멤버]`
- 경로: `trips/[tripId]/checklist`
- 아이콘: `ListChecks` (Lucide)

### FR9. 권한

| 역할 | 조회 | 체크 토글 | 추가/수정/삭제 | 드래그 정렬 |
|------|------|-----------|---------------|-------------|
| admin | ✅ | ✅ | ✅ | ✅ |
| editor | ✅ | ✅ | ✅ | ✅ |
| viewer | ✅ | ✅ | ❌ | ❌ |

### FR10. 실시간 동기화

- Supabase Realtime (Postgres Changes) → React Query invalidate
- 기존 RealtimeProvider 패턴 활용

---

## 3. 비기능 요구사항 (Non-Functional Requirements)

| ID | 요구사항 | 설명 |
|----|----------|------|
| NFR1 | 모바일 우선 | 기존 반응형 패턴 동일 (모바일 → md: 데스크톱) |
| NFR2 | 낙관적 업데이트 | 체크 토글, 정렬 변경은 즉시 반영 |
| NFR3 | RLS | trip_members만 접근 가능 |
| NFR4 | 성능 | 항목 100개까지 부드러운 렌더링 |

---

## 4. 데이터 모델 (예상)

### checklist_items

```
checklist_items
├── id          uuid        PK, gen_random_uuid()
├── trip_id     uuid        FK → trips, NOT NULL
├── category    text        NOT NULL (7개 enum)
├── title       text        NOT NULL
├── is_checked  boolean     DEFAULT false
├── priority    text        DEFAULT 'medium' (high/medium/low)
├── position    integer     카테고리 내 정렬 순서
├── assigned_to uuid        FK → profiles, NULLABLE
├── memo        text        NULLABLE
├── created_by  uuid        FK → profiles, NOT NULL
├── created_at  timestamptz DEFAULT now()
└── updated_at  timestamptz DEFAULT now()
```

### checklist_logs (체크 히스토리)

```
checklist_logs
├── id              uuid        PK
├── checklist_item_id uuid      FK → checklist_items
├── action          text        'checked' | 'unchecked'
├── performed_by    uuid        FK → profiles
└── performed_at    timestamptz DEFAULT now()
```

---

## 5. 사용자 스토리

| # | 역할 | 스토리 | 인수 조건 |
|---|------|--------|-----------|
| US1 | 멤버 | 준비물을 카테고리별로 추가한다 | 이름+카테고리 입력 후 리스트에 표시 |
| US2 | 멤버 | 항목을 체크하여 완료 표시한다 | 토글 즉시 반영, 히스토리 기록 |
| US3 | 멤버 | 담당자를 지정하여 누가 챙길지 정한다 | 멤버 목록에서 선택, 아바타 표시 |
| US4 | 멤버 | 카테고리별 진행률을 한눈에 본다 | 헤더에 "3/7" 형태 표시 |
| US5 | 멤버 | 급한 것 위주로 정렬한다 | 정렬 토글로 high→low 순 |
| US6 | 멤버 | 드래그로 원하는 순서로 정렬한다 | 카테고리 내 순서 변경 후 저장 |
| US7 | viewer | 항목을 체크할 수 있지만 추가/삭제는 못 한다 | 토글만 활성, CRUD 버튼 숨김 |
| US8 | 멤버 | 누가 언제 체크했는지 히스토리를 본다 | 항목별 타임라인 표시 |
| US9 | 멤버 | 다른 멤버의 변경이 실시간 반영된다 | Realtime으로 자동 갱신 |

---

## 6. 범위 밖 (v2 이후)

- AI 기반 준비물 자동 추천 (여행지/날짜/일정 기반)
- 프리셋 템플릿 ("해외여행 필수", "캠핑", "출장")
- 일정/예산과의 연동 (기한 있는 할 일, 구매 비용 연결)
- 카테고리 커스텀 생성

---

## 7. 다음 단계

1. **`/sc:design`** → DB 스키마 확정, API 설계, 컴포넌트 구조
2. **`/sc:workflow`** → 단계별 구현 계획 (마이그레이션 → API → UI)
