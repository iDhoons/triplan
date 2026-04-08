-- =============================================================
-- Guest Mode: invite_tokens 테이블
-- CEO 결정 (2026-04-08):
--   - 7일 만료
--   - URL 파라미터 + 서버 검증 방식 (?invite=<token>)
--   - invite_tokens 테이블 기반 trip 접근 제어
--   - read-only 범위: places + schedules (checklist 제외)
-- =============================================================

CREATE TABLE invite_tokens (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id     UUID        NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  token       TEXT        NOT NULL UNIQUE,
  created_by  UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 토큰으로 빠른 조회 (게스트 API 주요 패턴)
CREATE INDEX idx_invite_tokens_token      ON invite_tokens(token);
-- trip 기준 목록 조회 (관리자 UI)
CREATE INDEX idx_invite_tokens_trip_id    ON invite_tokens(trip_id);
-- 만료 토큰 정리용
CREATE INDEX idx_invite_tokens_expires_at ON invite_tokens(expires_at);

-- ─────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────

ALTER TABLE invite_tokens ENABLE ROW LEVEL SECURITY;

-- 여행 멤버는 해당 여행의 토큰 목록 조회 가능
CREATE POLICY "invite_tokens_select_member"
  ON invite_tokens FOR SELECT
  TO authenticated
  USING (is_trip_member(trip_id));

-- 편집자/관리자만 토큰 생성 가능
CREATE POLICY "invite_tokens_insert_editor_admin"
  ON invite_tokens FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = created_by
    AND is_trip_editor_or_admin(trip_id)
  );

-- 편집자/관리자는 토큰 삭제(revoke) 가능
CREATE POLICY "invite_tokens_delete_editor_admin"
  ON invite_tokens FOR DELETE
  TO authenticated
  USING (is_trip_editor_or_admin(trip_id));

-- ─────────────────────────────────────────────────────────────
-- 만료 토큰 자동 정리 함수 (pg_cron에서 주기적 호출 가능)
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.cleanup_expired_invite_tokens()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM invite_tokens WHERE expires_at < now();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;
