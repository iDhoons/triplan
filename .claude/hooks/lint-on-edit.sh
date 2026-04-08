#!/bin/bash
# PostToolUse Hook — JS/TS 파일 수정 시 eslint --fix 실행
#
# 글로벌 auto-format.sh가 prettier를 처리하지만, 이 프로젝트는 prettier 없이
# eslint만 사용하므로 프로젝트 훅에서 eslint --fix를 실행

INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty' 2>/dev/null)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null)

case "$TOOL_NAME" in
  Edit|Write|MultiEdit) ;;
  *) exit 0 ;;
esac

[[ -z "$FILE_PATH" || ! -f "$FILE_PATH" ]] && exit 0

# JS/TS 파일만 대상
case "$FILE_PATH" in
  *.ts|*.tsx|*.js|*.jsx|*.mjs|*.cjs) ;;
  *) exit 0 ;;
esac

# 프로젝트 루트
PROJECT_ROOT=$(cd "$(dirname "$FILE_PATH")" 2>/dev/null && git rev-parse --show-toplevel 2>/dev/null)
[[ -z "$PROJECT_ROOT" ]] && exit 0

ESLINT_BIN="$PROJECT_ROOT/node_modules/.bin/eslint"
[[ ! -x "$ESLINT_BIN" ]] && exit 0

"$ESLINT_BIN" --fix "$FILE_PATH" 2>/dev/null || true
exit 0
