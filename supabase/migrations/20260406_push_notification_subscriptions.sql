-- notification_subscriptions: Web Push 구독 정보 저장
CREATE TABLE IF NOT EXISTS notification_subscriptions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint    TEXT NOT NULL,
  p256dh      TEXT NOT NULL,
  auth        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, endpoint)
);

-- RLS 활성화
ALTER TABLE notification_subscriptions ENABLE ROW LEVEL SECURITY;

-- 본인 구독만 조회/삽입/삭제
CREATE POLICY "subscriptions_select_own"
  ON notification_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "subscriptions_insert_own"
  ON notification_subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "subscriptions_delete_own"
  ON notification_subscriptions FOR DELETE
  USING (auth.uid() = user_id);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_notification_subscriptions_user_id
  ON notification_subscriptions (user_id);
