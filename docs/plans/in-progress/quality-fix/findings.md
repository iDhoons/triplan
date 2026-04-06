# Findings

## Diagnostic Summary (2026-03-25)

6개 전문가 에이전트 진단 결과:
- Project Health: C (4 Warnings)
- Build Validator: ESLint 36 errors / 50 warnings
- Security: HIGH 4 / MEDIUM 7 / LOW 3
- Perf Profiler: CRITICAL 2 (Realtime, Image) + WARNING 8
- API Review: CRITICAL 3 / WARNING 8 / INFO 7
- Critic (6-Lens): CRITICAL 1 / WARNING 15

## Cross-Agent Findings (중복 발견)

| 이슈 | 발견 에이전트 수 | 합의 심각도 |
|------|-----------------|-------------|
| Weather API 권한 누락 | 3 (API, Security, Critic) | CRITICAL |
| Realtime 필터 누락 | 2 (Perf, Critic) | CRITICAL |
| Query Key 불일치 | 2 (Critic, Perf) | HIGH |
| Error 응답 형식 혼재 | 3 (API, Critic, Security) | WARNING |
| Rate Limiting 누락 | 2 (API, Security) | HIGH |
| In-memory Rate Limiter | 2 (Security, Critic) | WARNING |

## Technical Decisions

| Decision | Options Considered | Choice | Reason |
|----------|--------------------|--------|--------|
| Realtime filter for schedule_items | trip_id 컬럼 추가 vs schedule_id 기반 필터 | 조사 필요 | schedule_items에 trip_id 직접 컬럼 없음 |
| Rate Limiter 전환 | Upstash Redis vs Vercel KV vs 현행 유지 | Phase 3에서 결정 | Phase 1에서는 기존 in-memory 패턴 사용 |
| viewer 역할 집행 | RLS만 의존 vs API guard 추가 vs 둘 다 | API guard 추가 | 방어 심층 원칙 |

## Issues

- `schedule_items` 테이블에 `trip_id` 컬럼이 직접 없어서 Realtime 필터를 걸기 어려울 수 있음
- Next.js 16.2.1 업그레이드 시 middleware → proxy 마이그레이션과 겹칠 수 있음
- `@dnd-kit` dynamic import 시 SSR/hydration 이슈 가능성
