# Activity Logs Logging Strategy Analysis

**Date**: 2026-03-19  
**Project**: Travel Planner (Next.js 16 + Supabase)  
**Analysis Scope**: activity_logs 테이블 자동 기록 방식 평가

---

## Current State Assessment

### ✅ What's Already Working

1. **Realtime Provider** (`realtime-provider.tsx`)
   - activity_logs INSERT 구독 중 (line 113-131)
   - presenceEventTarget로 activity 이벤트 발행
   - ActivityToast가 이를 수신하여 토스트 표시

2. **YouTube Analysis**
   - `/api/youtube/extract-places` (line 88-102)
   - fire-and-forget 방식으로 activity_logs.insert() 실행
   - Rate limit 데이터 소스로도 활용

3. **RLS & Permissions**
   - activity_logs 테이블에 이미 RLS 정책 설정 (20260311_add_rls_policies.sql)
   - INSERT: editor/admin만 가능
   - SELECT: trip 멤버 모두 가능

### ❌ What's Missing

| 작업 유형 | 현재 상태 | 커버리지 |
|----------|---------|---------|
| place_added | Application-level만 정의 (activity-toast.tsx 포맷) | 실제 INSERT 없음 |
| place_removed | 미구현 | - |
| place_updated | 미구현 | - |
| schedule_item_added | 미구현 | - |
| schedule_item_removed | 미구현 | - |
| schedule_updated | Activity toast 포맷만 있음 | 실제 INSERT 없음 |
| member_joined | 미구현 | - |
| vote_added | 미구현 | - |

**결론**: activity_logs INSERT는 기대와 달리 **매우 제한적**

---

## Strategy Comparison Matrix

### Option A: Database Triggers (권장)

#### 장점
✅ **일관성 (Consistency)**
- 모든 INSERT/UPDATE/DELETE 자동 캡처
- Application-level 기록 누락 불가능
- 트랜잭션 내 atomic하게 기록

✅ **확장성 (Scalability)**
- 새 기능 추가 시 코드 변경 불필요
- 향후 notification 시스템 구축 용이
- 감사 기록(audit trail) 자동 완성

✅ **성능 (Performance)**
- 클라이언트 왕복 감소 (Insert → Toast 즉시 반영)
- 대량 작업 시 batch insert 트리거 1회 실행
- Realtime 구독이 이미 활성화되어 있음

✅ **운영 (Operations)**
- 중복 로깅 방지 (한 곳에서만 관리)
- 권한 검증 DB에서 실행 (안전)
- 이미 RLS 인프라 존재

#### 단점
❌ **초기 개발 비용**
- Trigger 작성 + 테스트 필요
- Trigger 내 복잡한 로직은 PL/pgSQL 학습곡선

❌ **디버깅 복잡도**
- Trigger가 silent failure할 수 있음
- DB 로그 모니터링 필요

❌ **권한 제약**
- Trigger는 DB 사용자 권한으로만 실행
- 예: `user_id` 필드를 trigger에서 자동 채워야 함
  - 해결: `INSERT` 시점의 `auth.uid()` 활용 (SECURITY DEFINER)

---

### Option B: Application-Level

#### 장점
✅ **명시성 (Explicitness)**
- 어느 시점에 로그가 기록되는지 명확
- TypeScript 타입 체크 가능

✅ **유연성 (Flexibility)**
- 특정 조건에서만 로깅 (예: draft 상태 제외)
- 로그 조건부 필터링

#### 단점
❌ **버그 가능성 높음**
- 매번 INSERT 로직 작성 필요
- 누락 위험 (예: UI에서는 insert하지만, API에서 update한 경우)

❌ **코드 산재**
- 각 API route에 반복 코드
- 유지보수 난제

❌ **권한 문제**
- Application-level은 클라이언트 권한 (Supabase RLS)
- activity_logs INSERT가 RLS 정책 `is_trip_editor_or_admin` 필요
- → Viewer는 로그 기록 불가능 (투표, 댓글 같은 viewer 액션 미기록)

❌ **비동기 처리 문제**
- 메인 응답과 분리되면 유실 가능
- Rate limit 데이터 정합성 문제

---

## 📊 Technical Implementation: Database Triggers

### 설계 원칙

```
1. Trigger는 SECURITY DEFINER로 실행 (권한 상승)
2. auth.uid() 로 현재 사용자 자동 캡처
3. NEW/OLD 값 비교하여 변경 내용 metadata에 저장
4. Error는 로그하되, trigger 실패는 허용하지 않음
```

### Schema Design

#### Helper Function: `get_trip_from_*`

```sql
-- places 테이블에서 trip_id 추출
CREATE OR REPLACE FUNCTION public.get_trip_id_from_place(place_id uuid)
RETURNS uuid AS $$
  SELECT trip_id FROM places WHERE id = place_id;
$$ LANGUAGE sql STABLE;

-- schedule_items에서 trip_id 추출 (via schedules)
CREATE OR REPLACE FUNCTION public.get_trip_id_from_schedule_item(item_id uuid)
RETURNS uuid AS $$
  SELECT schedules.trip_id 
  FROM schedule_items
  JOIN schedules ON schedule_items.schedule_id = schedules.id
  WHERE schedule_items.id = item_id;
$$ LANGUAGE sql STABLE;

-- checklist_items에서 trip_id 추출
CREATE OR REPLACE FUNCTION public.get_trip_id_from_checklist_item(item_id uuid)
RETURNS uuid AS $$
  SELECT trip_id FROM checklist_items WHERE id = item_id;
$$ LANGUAGE sql STABLE;
```

#### Trigger 1: `places` 테이블

```sql
CREATE OR REPLACE FUNCTION public.log_place_activity()
RETURNS TRIGGER AS $$
DECLARE
  v_action text;
  v_metadata jsonb;
BEGIN
  v_action := CASE 
    WHEN TG_OP = 'INSERT' THEN 'place_added'
    WHEN TG_OP = 'UPDATE' THEN 'place_updated'
    WHEN TG_OP = 'DELETE' THEN 'place_removed'
  END;

  v_metadata := jsonb_build_object(
    'target_name', COALESCE(NEW.name, OLD.name),
    'category', COALESCE(NEW.category, OLD.category),
    'changes', CASE 
      WHEN TG_OP = 'UPDATE' THEN jsonb_build_object(
        'name', CASE WHEN OLD.name IS DISTINCT FROM NEW.name THEN jsonb_build_object('from', OLD.name, 'to', NEW.name) END,
        'memo', CASE WHEN OLD.memo IS DISTINCT FROM NEW.memo THEN jsonb_build_object('from', OLD.memo, 'to', NEW.memo) END,
        'latitude', CASE WHEN OLD.latitude IS DISTINCT FROM NEW.latitude THEN jsonb_build_object('from', OLD.latitude, 'to', NEW.latitude) END
      )
      ELSE null::jsonb
    END
  );

  INSERT INTO activity_logs (
    trip_id,
    user_id,
    action,
    target_type,
    target_id,
    metadata
  ) VALUES (
    COALESCE(NEW.trip_id, OLD.trip_id),
    auth.uid(),
    v_action,
    'place',
    COALESCE(NEW.id, OLD.id),
    v_metadata
  );

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
EXCEPTION WHEN others THEN
  -- Log but don't fail the trigger
  RAISE WARNING '[activity_logs trigger] Error in log_place_activity: %', SQLERRM;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER tr_log_place_activity
AFTER INSERT OR UPDATE OR DELETE ON places
FOR EACH ROW
EXECUTE FUNCTION log_place_activity();
```

#### Trigger 2: `schedule_items` 테이블

```sql
CREATE OR REPLACE FUNCTION public.log_schedule_item_activity()
RETURNS TRIGGER AS $$
DECLARE
  v_action text;
  v_trip_id uuid;
  v_metadata jsonb;
BEGIN
  v_action := CASE 
    WHEN TG_OP = 'INSERT' THEN 'schedule_item_added'
    WHEN TG_OP = 'UPDATE' THEN 'schedule_item_updated'
    WHEN TG_OP = 'DELETE' THEN 'schedule_item_removed'
  END;

  -- schedules를 통해 trip_id 획득
  SELECT schedules.trip_id INTO v_trip_id
  FROM schedules
  WHERE schedules.id = COALESCE(NEW.schedule_id, OLD.schedule_id);

  v_metadata := jsonb_build_object(
    'target_name', COALESCE(NEW.title, OLD.title),
    'place_id', COALESCE(NEW.place_id, OLD.place_id),
    'start_time', COALESCE(NEW.start_time::text, OLD.start_time::text)
  );

  INSERT INTO activity_logs (
    trip_id,
    user_id,
    action,
    target_type,
    target_id,
    metadata
  ) VALUES (
    v_trip_id,
    auth.uid(),
    v_action,
    'schedule_item',
    COALESCE(NEW.id, OLD.id),
    v_metadata
  );

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
EXCEPTION WHEN others THEN
  RAISE WARNING '[activity_logs trigger] Error in log_schedule_item_activity: %', SQLERRM;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER tr_log_schedule_item_activity
AFTER INSERT OR UPDATE OR DELETE ON schedule_items
FOR EACH ROW
EXECUTE FUNCTION log_schedule_item_activity();
```

#### Trigger 3: `checklist_items` 테이블 (체크/언체크)

```sql
CREATE OR REPLACE FUNCTION public.log_checklist_activity()
RETURNS TRIGGER AS $$
DECLARE
  v_action text;
  v_metadata jsonb;
BEGIN
  v_action := CASE 
    WHEN TG_OP = 'INSERT' THEN 'checklist_item_added'
    WHEN TG_OP = 'UPDATE' AND OLD.is_checked = false AND NEW.is_checked = true THEN 'checklist_item_checked'
    WHEN TG_OP = 'UPDATE' AND OLD.is_checked = true AND NEW.is_checked = false THEN 'checklist_item_unchecked'
    WHEN TG_OP = 'UPDATE' THEN 'checklist_item_updated'
    WHEN TG_OP = 'DELETE' THEN 'checklist_item_removed'
  END;

  v_metadata := jsonb_build_object(
    'target_name', COALESCE(NEW.title, OLD.title),
    'category', COALESCE(NEW.category, OLD.category)
  );

  INSERT INTO activity_logs (
    trip_id,
    user_id,
    action,
    target_type,
    target_id,
    metadata
  ) VALUES (
    COALESCE(NEW.trip_id, OLD.trip_id),
    auth.uid(),
    v_action,
    'checklist_item',
    COALESCE(NEW.id, OLD.id),
    v_metadata
  );

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
EXCEPTION WHEN others THEN
  RAISE WARNING '[activity_logs trigger] Error in log_checklist_activity: %', SQLERRM;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER tr_log_checklist_activity
AFTER INSERT OR UPDATE OR DELETE ON checklist_items
FOR EACH ROW
EXECUTE FUNCTION log_checklist_activity();
```

#### Trigger 4: `place_votes` 테이블

```sql
CREATE OR REPLACE FUNCTION public.log_place_vote_activity()
RETURNS TRIGGER AS $$
DECLARE
  v_trip_id uuid;
  v_place_name text;
  v_metadata jsonb;
BEGIN
  -- places를 통해 trip_id와 place name 획득
  SELECT places.trip_id, places.name INTO v_trip_id, v_place_name
  FROM places
  WHERE places.id = NEW.place_id;

  v_metadata := jsonb_build_object(
    'target_name', v_place_name,
    'vote_type', NEW.vote_type,
    'comment', NEW.comment
  );

  INSERT INTO activity_logs (
    trip_id,
    user_id,
    action,
    target_type,
    target_id,
    metadata
  ) VALUES (
    v_trip_id,
    NEW.user_id,
    'vote_added',
    'place_vote',
    NEW.id,
    v_metadata
  );

  RETURN NEW;
EXCEPTION WHEN others THEN
  RAISE WARNING '[activity_logs trigger] Error in log_place_vote_activity: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER tr_log_place_vote_activity
AFTER INSERT ON place_votes
FOR EACH ROW
EXECUTE FUNCTION log_place_vote_activity();
```

#### Trigger 5: `trip_members` 테이블 (join)

```sql
CREATE OR REPLACE FUNCTION public.log_member_activity()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO activity_logs (
    trip_id,
    user_id,
    action,
    target_type,
    target_id,
    metadata
  ) VALUES (
    NEW.trip_id,
    NEW.user_id,
    'member_joined',
    'trip_member',
    NEW.id,
    jsonb_build_object('role', NEW.role)
  );

  RETURN NEW;
EXCEPTION WHEN others THEN
  RAISE WARNING '[activity_logs trigger] Error in log_member_activity: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER tr_log_member_activity
AFTER INSERT ON trip_members
FOR EACH ROW
EXECUTE FUNCTION log_member_activity();
```

---

## ⚠️ Critical Considerations

### 1. **RLS Policy Interaction**

❌ **문제**: activity_logs RLS 정책이 `is_trip_editor_or_admin` 필수
```sql
CREATE POLICY "activity_logs_insert_editor_admin"
  ON activity_logs FOR INSERT
  TO authenticated
  WITH CHECK (is_trip_editor_or_admin(trip_id));
```

✅ **해결**: Trigger는 `SECURITY DEFINER`로 RLS 우회
- Trigger가 DB 수퍼유저 권한으로 실행
- 클라이언트 권한 무시하고 INSERT 수행
- 로그는 모든 사용자의 액션 기록 가능

### 2. **auth.uid() Availability**

⚠️ **주의**: `auth.uid()` 는 Supabase `auth` 스키마의 JWT에서 추출
```sql
-- 작동: authenticated session이 있을 때
INSERT INTO places ... -- auth.uid() = current user
-- 실패: cron job, service role로 실행할 때
supabase.rpc('update_enrichment', {}) -- auth.uid() = NULL
```

✅ **권장**: Service role 작업에서는 명시적 user_id 전달

### 3. **Performance Impact**

| 작업 | 영향도 | 대책 |
|-----|-------|------|
| Places bulk insert (20개) | 20 triggers | 수용 가능 (< 100ms) |
| YouTube add-places (batch) | Trigger per place | 여전히 빠름 (async) |
| Schedule reorder (10개) | 10 triggers | Trigger 조건화 가능 |

**최적화**: 불필요한 UPDATE는 trigger 조건으로 필터링
```sql
CREATE TRIGGER tr_log_schedule_item_activity
AFTER INSERT OR DELETE ON schedule_items
FOR EACH ROW ... 
-- UPDATE는 sort_order 변경만 감시하도록 조건화 필요
```

### 4. **Timestamp Precision**

- Trigger는 DB `now()` 사용 (UTC)
- Application은 클라이언트 시간 기반
- → 약간의 시간 편차 가능하지만 무시 가능

---

## 🎯 Implementation Roadmap

### Phase 1: Trigger 기반 로깅 (권장)
1. Migration 작성: `20260320_activity_triggers.sql`
2. Trigger 함수 5개 추가
3. 테스트: Direct DB INSERT 확인
4. Realtime 테스트: Socket에서 activity 이벤트 구독
5. UI 테스트: activity-toast.tsx 정상 표시

### Phase 2: Application 정리 (Hybrid)
1. `/api/youtube/extract-places` 유지 (이미 작동)
2. 기타 API route는 trigger에 맡김
3. Rate limit 쿼리: activity_logs 그대로 사용 가능

### Phase 3: Notification System (향후)
```
activity_logs INSERT (트리거)
    ↓
Realtime subscription (RealtimeProvider)
    ↓
ActivityToast 표시 (현재 작동)
    ↓
Notification이 필요하면:
  - 특정 action 감시
  - 사용자 선호도 기반 필터링
  - Email/Push 발송
```

---

## Advantages Summary

| 평가항목 | Trigger | App-Level |
|---------|---------|-----------|
| 일관성 | ✅✅✅ | ❌ |
| 확장성 | ✅✅✅ | ❌ |
| 성능 | ✅✅ | ✅ |
| 개발 난도 | ⚠️ 중상 | ✅ 낮음 |
| 유지보수 | ✅ 중앙화 | ❌ 산재 |
| 권한 관리 | ✅ 자동 | ❌ 수동 |
| 감사 기록 | ✅✅✅ | ❌ 부분 |

---

## Recommendation

### 최종 선택: **Option A (Database Triggers)** 

**이유**:
1. ✅ 이미 Realtime + RLS 인프라 완성
2. ✅ activity_logs 기반 rate limit 이미 작동 중 (youtube_analyze)
3. ✅ notification 확장 계획에 최적
4. ✅ 누락 위험 제거
5. ✅ 권한 일관성 보장

**Trade-off 수용**:
- PL/pgSQL 학습: 1-2시간
- Trigger 작성 + 테스트: 3-4시간
- 장기 유지보수: 크게 감소

---

## Migration Template

```sql
-- supabase/migrations/20260320_activity_triggers.sql
-- Activity logging via database triggers for all mutable tables

-- Step 1: Helper functions (copy from above)
-- Step 2: Create trigger functions (copy from above)
-- Step 3: Create triggers (copy from above)

-- Rollback (if needed):
-- DROP TRIGGER IF EXISTS tr_log_place_activity ON places;
-- DROP FUNCTION IF EXISTS log_place_activity();
-- ... (repeat for all 5)
```

