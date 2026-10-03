#!/bin/sh
# 테스트용 가짜 서버 세 개를 띄운다. 이미 떠 있으면 건너뛴다.
#   8790 구글 OAuth · 8795 공고 사이트 · 8796 공고 목록/RSS
# 사용: sh tests/mocks/start.sh
DIR="$(cd "$(dirname "$0")" && pwd)"
for spec in "google:8790" "notice-site:8795" "notice-list:8796"; do
  name="${spec%%:*}"; port="${spec##*:}"
  # 응답 코드와 상관없이 연결만 되면 떠 있는 것이다
  if curl -s -o /dev/null --max-time 1 "http://127.0.0.1:$port/" 2>/dev/null; then
    echo "  $name($port) 이미 실행 중"
  else
    nohup node "$DIR/$name.mjs" >"${TMPDIR:-/tmp}/mock-$name.log" 2>&1 &
    echo "  $name($port) 시작"
  fi
done
