# Findings — Button Size System Redesign

## Requirements
- iOS HIG 수준의 버튼 크기 체계
- 모바일 PWA에서 44px 최소 터치 타겟 준수
- 컴포넌트 간 크기 일관성 확보
- 현재 21개 파일, 60개 size props 마이그레이션

## Research

### iOS 버튼 크기 체계
| iOS controlSize | 높이 (pt) | 용도 |
|-----------------|-----------|------|
| .mini/.small | 28pt | 도구 모음, 밀집 UI |
| .medium/.regular | 34pt | **기본값**. 일반 버튼 |
| .large | 50pt | 주요 CTA, 로그인, 결제 |

### Material Design 3
| MD3 Size | 높이 (dp) | 용도 |
|----------|-----------|------|
| XS | 32dp | 밀집 UI |
| S | 36dp | **기본값** |
| M | 40dp | 강조 |
| L | 48dp | 주요 CTA |
| XL | 56dp | 최대 강조 |

### 터치 타겟 기준
| 가이드라인 | 최소 크기 |
|-----------|----------|
| Apple HIG | 44 × 44pt |
| Material Design | 48 × 48dp |
| WCAG 2.2 AA (2.5.8) | 24 × 24px |
| WCAG 2.2 AAA (2.5.5) | 44 × 44px |

### 현재 프로젝트 크기 체계
| Size | 높이 | 사용 횟수 | 문제 |
|------|------|----------|------|
| xs | 24px (h-6) | 0 | 사용 안 됨 |
| sm | 28px (h-7) | **35+** | 사실상 기본, 44px 미달 |
| default | 32px (h-8) | ~10 | 44px 미달 |
| lg | 36px (h-9) | 1 | 44px 미달 |

**핵심 문제**: 가장 많이 쓰이는 크기(28px)가 최소 터치 타겟(44px)의 64%

### 연관 컴포넌트 현재 상태
| Component | Height | Button 정렬 |
|-----------|--------|------------|
| Input | h-8 (32px) | button-default 일치 |
| Select | h-8 (32px) | button-default 일치 |
| Tabs | h-8 (32px) | button-default 일치 |
| Avatar-sm | size-6 (24px) | button-xs 일치 |
| Avatar-default | size-8 (32px) | button-default 일치 |
| Badge | h-5 (20px) | 불일치 (독자 크기) |

## Technical Decisions
| Decision | Options Considered | Choice | Reason |
|----------|-------------------|--------|--------|
| 크기 체계 기준 | iOS only / MD3 only / Hybrid | **iOS-first Hybrid** | 주 타겟이 모바일 PWA, iOS 사용자 비율 높음 |
| default 높이 | 36px / 40px / 44px | **44px (h-11)** | Apple HIG 최소 터치 타겟과 일치, 모든 standard 버튼이 자동으로 접근성 충족 |
| 마이그레이션 방식 | 점진적 / 일괄 | **일괄** | 크기 정의 변경 후 전체 교체가 일관성 보장 |

## Issues
- Badge(h-5=20px)는 독자적 크기 → 이번 범위에서 제외 (터치 타겟 아님)
- Avatar 크기도 별도 체계 → 이번 범위에서 제외
- Calendar의 date 버튼도 icon 사이즈 사용 → 함께 조정 필요
