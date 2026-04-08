#!/bin/bash
# PostToolUse Hook — 소스 파일 수정 시 관련 vitest 테스트 실행
#
# 동작:
#   - src/ 내 파일 수정 → 같은 이름의 .test.ts 찾아서 실행
#   - 테스트 파일 자체 수정 → 해당 테스트 실행
#   - 관련 테스트 없으면 스킵 (전체 실행 안 함)

INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty' 2>/dev/null)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null)

case "$TOOL_NAME" in
  Edit|Write|MultiEdit) ;;
  *) exit 0 ;;
esac

[[ -z "$FILE_PATH" || ! -f "$FILE_PATH" ]] && exit 0

# TS/TSX 파일만
case "$FILE_PATH" in
  *.ts|*.tsx) ;;
  *) exit 0 ;;
esac

# config/설정 파일 제외
case "$FILE_PATH" in
  *config*|*next.config*|*.d.ts) exit 0 ;;
esac

PROJECT_ROOT=$(cd "$(dirname "$FILE_PATH")" 2>/dev/null && git rev-parse --show-toplevel 2>/dev/null)
[[ -z "$PROJECT_ROOT" ]] && exit 0

VITEST_BIN="$PROJECT_ROOT/node_modules/.bin/vitest"
[[ ! -x "$VITEST_BIN" ]] && exit 0

# 테스트 파일 결정
BASENAME=$(basename "$FILE_PATH" .ts)
BASENAME=$(basename "$BASENAME" .tsx)
DIR=$(dirname "$FILE_PATH")

if [[ "$BASENAME" == *.test || "$BASENAME" == *.spec ]]; then
  TEST_FILE="$FILE_PATH"
elif [[ -f "$DIR/${BASENAME}.test.ts" ]]; then
  TEST_FILE="$DIR/${BASENAME}.test.ts"
elif [[ -f "$DIR/${BASENAME}.test.tsx" ]]; then
  TEST_FILE="$DIR/${BASENAME}.test.tsx"
elif [[ -f "$DIR/__tests__/${BASENAME}.test.ts" ]]; then
  TEST_FILE="$DIR/__tests__/${BASENAME}.test.ts"
elif [[ -f "$DIR/__tests__/${BASENAME}.test.tsx" ]]; then
  TEST_FILE="$DIR/__tests__/${BASENAME}.test.tsx"
else
  exit 0
fi

RESULT=$(timeout 30 "$VITEST_BIN" run --reporter=dot "$TEST_FILE" 2>&1)
EXIT_CODE=$?

if [[ $EXIT_CODE -eq 0 ]]; then
  CONTEXT="[test] $(basename "$TEST_FILE"): PASS"
else
  TAIL=$(echo "$RESULT" | tail -15)
  CONTEXT="[test] $(basename "$TEST_FILE"): FAIL\n${TAIL}"
fi

ESCAPED=$(echo -e "$CONTEXT" | jq -Rs .)
cat <<EOF
{
  "hookSpecificOutput": {
    "hookEventName": "PostToolUse",
    "additionalContext": $ESCAPED
  }
}
EOF

exit 0
