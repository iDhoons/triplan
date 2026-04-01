# Triplan Project Comprehensive Evaluation Report

**Date**: 2026-04-01
**Method**: 6-Expert Panel (Architecture, Security, Frontend, API, Database, Performance)
**Scope**: Full codebase analysis — 181 files, 21,654 lines, 21 API endpoints, 10 migrations

---

## Executive Summary

| Expert | Domain | Grade | Key Strength | Top Issue |
|--------|--------|-------|-------------|-----------|
| Martin Fowler | Architecture | **A-** | Module boundaries + layer separation | Constants duplication |
| Troy Hunt | Security | **B+** | Guard system + automated coverage test | In-memory rate limiter on serverless |
| Dan Abramov | Frontend | **B+** | Realtime-to-cache integration | Query key factory partial adoption |
| Sam Newman | API | **B+** | Progressive auth guards + Anti-Corruption Layer | Error format inconsistency |
| Martin Kleppmann | Database | **B** | RLS policies + helper functions | Missing indexes on core FK columns |
| Brendan Gregg | Performance | **B** | Data fetching (React Query + parallel) | Server Component underutilization |

### Overall Grade: **B+**

잘 설계된 프로덕션 수준의 여행 협업 앱. 아키텍처와 보안 기반이 탄탄하며, 데이터 레이어(React Query + Realtime)가 특히 우수. 주요 개선 영역은 DB 인덱싱, rate limiter 인프라, Server Component 활용.

---

## Cross-Expert Validated Findings

2명 이상의 전문가가 독립적으로 발견한 항목. 신뢰도 높음.

### 1. Query Key 일관성 부재 (Frontend + Architecture)

- **신뢰도**: HIGH (2명 독립 발견)
- `query-keys.ts` 팩토리가 존재하지만 11+ hooks가 raw string 사용
- `RealtimeProvider`의 15+ 하드코딩 키가 hooks와 수동 동기화 필요
- **위험**: 키 변경 시 Realtime sync가 silent하게 깨짐
- **수정**: 모든 queryKey/invalidateQueries 호출을 `queryKeys.*`로 통일

### 2. In-memory Rate Limiter (Security + API + Database)

- **신뢰도**: VERY HIGH (3명 독립 발견)
- Vercel serverless에서 인스턴스별 독립 Map → 실질적으로 무효
- YouTube endpoint만 DB 기반 3단계 제한이 적용된 모범 사례
- **위험**: Gemini/Places API 비용 폭주 가능
- **수정**: Upstash Redis 또는 YouTube 패턴(DB 기반)을 비용 발생 API에 확대

### 3. Server Component 미활용 (Frontend + Performance)

- **신뢰도**: HIGH (2명 독립 발견)
- 86개 "use client" 파일, 핵심 페이지(Dashboard, PlaceDetail, Members)가 모두 클라이언트
- 빈 HTML → JS 로드 → hydration → 데이터 페칭 waterfall 발생
- **수정**: HydrationBoundary + prefetchQuery 패턴으로 SSR 데이터 주입

---

## Priority Action Items

### CRITICAL (즉시 수정)

| # | Issue | Expert | Impact | Effort |
|---|-------|--------|--------|--------|
| C-1 | DB 인덱스 추가: activity_logs(trip_id, created_at), trip_members(trip_id, user_id) 등 6개 | Database | 전체 쿼리 성능 + RLS 성능 | 30분 |
| C-2 | Base schema migration 생성 (`supabase db dump`) | Database | 환경 재현성, 신규 개발자 온보딩 | 1시간 |
| C-3 | Schedule items N+1 reorder → RPC 전환 | Database | N개 UPDATE → 1개 atomic RPC | 30분 |

### HIGH (1주 내 수정)

| # | Issue | Expert | Impact | Effort |
|---|-------|--------|--------|--------|
| H-1 | Rate limiter → Upstash Redis 또는 DB 기반 전환 | Security x3 | API 비용 보호 | 2시간 |
| H-2 | Query key factory 전체 적용 (hooks + RealtimeProvider) | Frontend + Arch | Silent bug 제거 | 2시간 |
| H-3 | Error response format 통일 (7곳 `errorResponse()` 적용) | API | Client 계약 일관성 | 30분 |
| H-4 | resolve-photos Place ID 형식 검증 추가 | Security | 외부 API URL 주입 방지 | 5분 |
| H-5 | share/receive FormData null/타입 검증 | Security | 입력 안전성 | 10분 |

### MEDIUM (2주 내 수정)

| # | Issue | Expert | Impact | Effort |
|---|-------|--------|--------|--------|
| M-1 | PlaceImage `loading="lazy"` 추가 | Performance | 초기 네트워크 50-70% 감소 | 5분 |
| M-2 | Photos resolve 순차 루프 → Promise.allSettled 병렬화 | Performance | 사진 로딩 60-80% 단축 | 30분 |
| M-3 | activity_logs UPDATE/DELETE RLS 정책 제거 (append-only) | Database | 감사 로그 무결성 | 5분 |
| M-4 | place_votes UPDATE RLS 정책 추가 | Database | 재투표 시 silent fail 방지 | 10분 |
| M-5 | URL regex param 추출 → Next.js route params 전환 (5곳) | API | 취약한 param 추출 제거 | 30분 |
| M-6 | cursor 파라미터 ISO 8601 형식 검증 | Security | 비정상 입력 방지 | 5분 |
| M-7 | MembersPage: useState → useTripMembers hook 전환 | Frontend | Realtime 동기화 활성화 | 20분 |

### LOW (백로그)

| # | Issue | Expert | Impact | Effort |
|---|-------|--------|--------|--------|
| L-1 | Server Component prefetch 도입 (Dashboard, PlaceDetail) | Frontend + Perf | TTFB 개선 | 반나절 |
| L-2 | Constants 중복 정리 (CATEGORY_LABELS) | Architecture | DRY 원칙 | 5분 |
| L-3 | Stats API: JS 집계 → SQL GROUP BY 전환 | Database | 대규모 activity 시 성능 | 30분 |
| L-4 | 이미지 캐시 ExpirationPlugin (maxEntries: 100) | Performance | 장기 사용 캐시 제한 | 10분 |
| L-5 | @dnd-kit optimizePackageImports 추가 | Performance | 비일정 페이지 번들 감소 | 5분 |
| L-6 | 외부 API 1회 재시도 + backoff 추가 | API + Perf | 일시적 장애 복원력 | 1시간 |
| L-7 | notifications.activity_log_id 타입 text → uuid 수정 | Database | 참조 무결성 | 10분 |
| L-8 | CSP nonce 기반 강화 (unsafe-inline 제거 검토) | Security | XSS 방어 강화 | 2시간 |

---

## Strength Highlights (Best Practices)

프로젝트에서 특히 우수한 패턴들:

1. **Realtime-to-Cache Integration** (Frontend A-)
   - RealtimeProvider의 선택적 캐시 패칭 (INSERT→invalidate, UPDATE→setQueryData)
   - presenceEventTarget의 EventTarget 패턴으로 Context 리렌더 방지
   - Self-triggered event 억제

2. **Progressive Auth Guard Chain** (API/Security A)
   - `withAuth` → `withTripMember` → `withTripEditor` 3단계 래퍼
   - `guards-coverage.test.ts`로 모든 route의 가드 적용 자동 검증

3. **Anti-Corruption Layer** (API B+)
   - 각 외부 서비스(Places, Routes, Weather, YouTube)가 `lib/` 하위 독립 모듈
   - Directions API의 3단계 graceful degradation (mode fallback → transit → Haversine)

4. **RLS Helper Functions** (Database A-)
   - `is_trip_member()`, `get_trip_role()`, `is_trip_editor_or_admin()` SECURITY DEFINER
   - `search_path = public` 설정으로 CVE-2018-1058 방어
   - notifications `WITH CHECK (false)`로 클라이언트 직접 삽입 차단

5. **Image Proxy Pipeline** (Performance A-)
   - 서버사이드 WebP 변환 (sharp, quality 80)
   - Width breakpoint snap (200/400/800/1200)으로 CDN 캐시 파편화 방지
   - `Cache-Control: public, max-age=86400, s-maxage=604800`

6. **SSRF Defense** (Security PASS)
   - `url-parser.ts`: DNS lookup으로 사설 IP 차단 + 리다이렉트 1회 제한

7. **Prompt Injection Defense** (Security PASS)
   - `ai-sanitize.ts`: 인젝션 패턴 감지/차단 + DB 데이터 이스케이프

---

## Grade Distribution

```
A-  ████████████████████████░░░░░░  Architecture
B+  ██████████████████████░░░░░░░░  Security
B+  ██████████████████████░░░░░░░░  Frontend
B+  ██████████████████████░░░░░░░░  API
B   ████████████████████░░░░░░░░░░  Database
B   ████████████████████░░░░░░░░░░  Performance
────────────────────────────────────
B+  ██████████████████████░░░░░░░░  OVERALL
```

### B+ → A- 달성 조건
CRITICAL 3건 + HIGH 5건 해결 시 전체 등급 A- 달성 가능 (예상 소요: 8시간)

### A- → A 달성 조건
추가로 Server Component prefetch 도입 + Rate limiter Redis 전환 + 전체 migration 정비

---

## Methodology

- 6명의 전문가 에이전트가 독립적으로 코드베이스를 분석 (병렬 실행)
- 교차 검증: 2명 이상 독립 발견 시 신뢰도 상향
- 의견 충돌 시 코드 증거 기반 판정 (SSRF: Security가 방어 코드 확인 → 하향)
- 등급 기준: A(production-excellent), B(production-ready), C(functional-needs-work), D/F(blocking)
