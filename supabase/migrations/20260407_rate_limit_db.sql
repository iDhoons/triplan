-- ============================================================================
-- Rate Limiter DB Foundation (DEC-89)
--
-- 현재 in-memory Map 방식(guards.ts)은 서버리스 환경에서 인스턴스 간 상태를
-- 공유하지 못해 실질적인 제한 효과가 없음.
-- PostgreSQL 기반 rate limiter로 교체:
--   - api_rate_limits 테이블: (key TEXT PK, count INT, window_start TIMESTAMPTZ)
--   - check_rate_limit(key, window_ms, max) RPC: 원자적 카운트 증가 + 검사
--
-- 사용 방법:
--   SELECT check_rate_limit('places-photo:user-123', 60000, 10);
--   -- true: 허용 / false: 차단
-- ============================================================================

-- ────────────────────────────────────────────────────────────
-- 테이블
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS api_rate_limits (
  key          TEXT        NOT NULL,
  count        INTEGER     NOT NULL DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT api_rate_limits_pkey PRIMARY KEY (key)
);

-- 오래된 윈도우 정리용 인덱스 (pg_cron / 수동 cleanup 지원)
CREATE INDEX IF NOT EXISTS idx_api_rate_limits_window_start
  ON api_rate_limits (window_start);

-- ────────────────────────────────────────────────────────────
-- RPC: check_rate_limit
--
-- 파라미터:
--   p_key        TEXT    — 복합 키 (예: 'places-photo:user-uuid')
--   p_window_ms  INTEGER — 윈도우 크기 (밀리초, 기본 60000 = 1분)
--   p_max        INTEGER — 윈도우 내 최대 요청 수
--
-- 반환: BOOLEAN
--   true  = 허용 (카운트 증가 완료)
--   false = 차단 (max 초과)
--
-- 동시성: ON CONFLICT DO UPDATE로 원자적 처리 (SELECT + UPDATE 없이 단일 쿼리)
-- RLS 우회: SECURITY DEFINER (서비스 역할 없이 API Route에서 직접 호출)
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_key       TEXT,
  p_window_ms INTEGER DEFAULT 60000,
  p_max       INTEGER DEFAULT 10
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window_start TIMESTAMPTZ;
  v_count        INTEGER;
BEGIN
  v_window_start := now() - (p_window_ms || ' milliseconds')::interval;

  -- 원자적 UPSERT:
  --   새 키 또는 만료된 윈도우 → 카운트 1로 초기화
  --   현재 윈도우 내 → 카운트 증가
  INSERT INTO api_rate_limits (key, count, window_start)
  VALUES (p_key, 1, now())
  ON CONFLICT (key) DO UPDATE
    SET
      count        = CASE
                       WHEN api_rate_limits.window_start < v_window_start
                       THEN 1                         -- 새 윈도우: 초기화
                       ELSE api_rate_limits.count + 1 -- 현재 윈도우: 증가
                     END,
      window_start = CASE
                       WHEN api_rate_limits.window_start < v_window_start
                       THEN now()
                       ELSE api_rate_limits.window_start
                     END
  RETURNING count INTO v_count;

  RETURN v_count <= p_max;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- RLS
-- api_rate_limits는 직접 SELECT/INSERT 허용 불필요.
-- 오직 check_rate_limit() SECURITY DEFINER 함수를 통해서만 접근.
-- ────────────────────────────────────────────────────────────

ALTER TABLE api_rate_limits ENABLE ROW LEVEL SECURITY;

-- 어떤 역할도 직접 접근 불가 (함수가 SECURITY DEFINER로 우회)
-- 정책 없음 = 기본 거부

-- ────────────────────────────────────────────────────────────
-- Cleanup 함수 (오래된 윈도우 삭제, pg_cron 또는 수동 호출)
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.cleanup_rate_limits(
  p_older_than_ms INTEGER DEFAULT 3600000 -- 기본 1시간 이상 된 항목 삭제
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM api_rate_limits
  WHERE window_start < now() - (p_older_than_ms || ' milliseconds')::interval;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

COMMENT ON TABLE api_rate_limits IS
  'API rate limiter 상태 저장소. check_rate_limit() 함수를 통해서만 접근.';

COMMENT ON FUNCTION public.check_rate_limit IS
  'API rate limit 원자적 검사 및 카운트 증가. true=허용, false=차단.';

COMMENT ON FUNCTION public.cleanup_rate_limits IS
  'api_rate_limits에서 오래된 윈도우 항목 정리. pg_cron 또는 수동 호출.';
