# DEC-93: 접근성(Accessibility) 개선 계획

> **작성일**: 2026-04-18
> **작성자**: CTO
> **상태**: 계획 수립 완료 → 엔지니어 위임 대기
> **우선순위**: P2 (Low)
> **관련 이슈**: DEC-93

---

## 1. 현황 요약

코드베이스 분석 결과, triplan은 기본적인 접근성 인프라(skip-to-main, focus-visible ring, aria-label on nav, role="alert" on error boundary)가 갖춰져 있으나, WCAG 2.1 AA 수준에는 미달하는 항목이 다수 존재.

| 영역 | 현재 등급 | 주요 이슈 |
|------|-----------|-----------|
| ARIA 속성 | 중간 | 복잡 위젯(드롭다운, 드래그) aria 부족 |
| 시맨틱 HTML | 중간 | section/article 미사용, div 남발 |
| 키보드 내비게이션 | 중간 | DnD 키보드 대체 없음, 드롭다운 화살표키 미지원 |
| 이미지 alt | 양호 | 데코레이션 아이콘 aria-hidden 불일치 |
| 폼 접근성 | 중간 | aria-describedby/aria-required 미적용 |
| 컬러 대비 | 중간 | muted-foreground 저대비 위험 |
| 포커스 표시기 | 양호 | hover-only 버튼 focus 미노출 |
| sr-only | 약함 | skip link 외 거의 미사용 |
| 터치 타겟 | 중간 | 일부 20px 미만 |
| 에러 메시지 | 약함 | aria-live/aria-describedby 없음 |

---

## 2. 범위 (Scope)

### 할 것 (In Scope)
- WCAG 2.1 AA 수준 달성을 위한 최소 필수 개선
- 폼 접근성 강화 (aria-describedby, aria-required, aria-live)
- 키보드 내비게이션 보완 (hover-only → focus 포함)
- 데코레이션 아이콘 aria-hidden 통일
- 에러 메시지 실시간 공지 (aria-live)
- 터치 타겟 최소 44px 보장

### 안 할 것 (Not Doing)
- WCAG 2.1 AAA 수준 (7:1 대비율 등)
- 스크린 리더 전체 플로우 테스트 자동화
- DnD 키보드 대체 UI (별도 태스크로 분리 — 복잡도 높음)
- 다크모드 컬러 대비 전면 재설계 (P2 컬러 팔레트 태스크와 병합)
- axe-core CI 통합 (Phase 4 출시 준비 시점에 도입)

---

## 3. 태스크 분해

### Task A: 폼 접근성 강화 (FrontendEngineer)

**대상 파일**:
- `src/components/places/place-form.tsx`
- `src/app/(auth)/login/login-page.tsx`
- `src/app/(auth)/signup/signup-page.tsx`
- `src/components/checklist/inline-add-input.tsx`

**작업 내용**:
1. 모든 Input에 `aria-describedby` 연결 — 에러 메시지 `<p>` 태그에 `id` 부여 후 연결
2. 필수 필드에 `aria-required="true"` 추가
3. 폼 제출 실패 시 첫 번째 에러 필드로 포커스 이동 (`ref.focus()`)
4. 에러 메시지 컨테이너에 `role="alert"` 또는 `aria-live="assertive"` 추가

**수용 기준**:
- [ ] 모든 폼 입력 필드의 에러 메시지가 aria-describedby로 연결됨
- [ ] 필수 필드가 aria-required로 마크됨
- [ ] 폼 실패 시 첫 에러 필드로 포커스 이동
- [ ] 스크린 리더가 에러 메시지를 즉시 공지함

---

### Task B: 아이콘/데코레이션 접근성 통일 (FrontendEngineer)

**대상 파일**:
- `src/components/layout/sidebar.tsx` — ChevronRight 등
- `src/app/(auth)/login/login-page.tsx` — Plane, Cloud 장식 아이콘
- `src/app/(auth)/signup/signup-page.tsx` — 동일
- `src/components/places/vote-button.tsx`
- 전체 Lucide 아이콘 사용처

**작업 내용**:
1. 장식용 아이콘에 `aria-hidden="true"` 일괄 추가
2. 의미 있는 아이콘 버튼에 `aria-label` 누락 확인 및 보완
3. 아이콘만으로 구성된 버튼에 `<span className="sr-only">` 레이블 추가

**수용 기준**:
- [ ] 모든 장식 아이콘에 aria-hidden="true" 적용
- [ ] 아이콘 전용 버튼에 sr-only 또는 aria-label 100% 적용

---

### Task C: hover-only 버튼 → focus 포함 (FrontendEngineer)

**대상 파일**:
- `src/components/schedule/draggable-item.tsx` (라인 76-98)

**작업 내용**:
1. `opacity-0 group-hover:opacity-100` → `opacity-0 group-hover:opacity-100 group-focus-within:opacity-100` 변경
2. 모바일에서도 액션 버튼 접근 가능하도록 터치 시 표시 로직 추가

**수용 기준**:
- [ ] Tab 키로 draggable-item 내부 진입 시 액션 버튼 표시
- [ ] 모바일 터치로도 액션 버튼 접근 가능

---

### Task D: 터치 타겟 최소 크기 보장 (FrontendEngineer)

**대상 파일**:
- `src/components/places/vote-button.tsx` — 별 버튼 (현재 ~20px)
- `src/components/checklist/checklist-item.tsx` — 체크 버튼, 아바타

**작업 내용**:
1. 터치 타겟 최소 44x44px 보장 (패딩 확장 또는 min-w/min-h)
2. vote-button 별 클릭 영역 확대

**수용 기준**:
- [ ] 모든 인터랙티브 요소 최소 44x44px 터치 영역
- [ ] 기존 시각적 크기 유지하면서 히트 영역만 확장

---

### Task E: aria-live 실시간 공지 (FrontendEngineer)

**대상 파일**:
- `src/components/ui/sonner.tsx` (토스트 알림)
- `src/components/realtime/activity-toast.tsx`
- 로딩 상태 표시 컴포넌트들

**작업 내용**:
1. 토스트 컴포넌트에 `aria-live="polite"` 확인 (Sonner가 자체 지원하는지 확인 후)
2. 로딩 스피너에 `role="status"` + `aria-label="로딩 중"` 추가
3. 데이터 변경 성공/실패 알림이 스크린 리더에 전달되는지 확인

**수용 기준**:
- [ ] 토스트 알림이 스크린 리더에서 자동 공지됨
- [ ] 로딩 상태가 role="status"로 마크됨

---

## 4. 의존성 및 순서

```
Task A (폼 접근성) ← 독립, 최우선
Task B (아이콘 접근성) ← 독립, 병렬 가능
Task C (hover→focus) ← 독립, 병렬 가능
Task D (터치 타겟) ← 독립, 병렬 가능
Task E (aria-live) ← Sonner 라이브러리 동작 확인 필요
```

모든 태스크가 독립적이므로 **병렬 진행 가능**.

---

## 5. 테스트 전략

- **수동 검증**: Tab 키만으로 전체 플로우 탐색, 스크린 리더(VoiceOver) 테스트
- **자동 검증**: Lighthouse Accessibility 점수 측정 (before/after 비교)
- **회귀 방지**: 기존 E2E 테스트(Playwright) 통과 확인

---

## 6. 리스크

| 리스크 | 대응 |
|--------|------|
| Sonner 토스트가 이미 aria-live 지원할 수 있음 | 라이브러리 코드 확인 후 중복 적용 방지 |
| shadcn/ui 컴포넌트가 이미 접근성 처리 중일 수 있음 | base-ui 기반 확인 (Radix → base-ui 전환됨) |
| 터치 타겟 확대 시 레이아웃 깨짐 | min-w/min-h + overflow 처리 |

---

## 7. 완료 기준

- [ ] Lighthouse Accessibility 점수 90+ (현재 측정값 대비 개선)
- [ ] 키보드만으로 주요 플로우(여행 생성 → 장소 추가 → 일정 배치) 완료 가능
- [ ] 모든 폼 에러가 스크린 리더에서 즉시 공지됨
- [ ] 아이콘 전용 버튼 100% 레이블 보유
