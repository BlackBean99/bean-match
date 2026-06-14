#!/bin/sh

set -eu

title="${1:-Codex}"
message="${2:-작업이 완료되었습니다.}"

escaped_title=$(printf '%s' "$title" | sed 's/\\/\\\\/g; s/"/\\"/g')
escaped_message=$(printf '%s' "$message" | sed 's/\\/\\\\/g; s/"/\\"/g')

osascript -e "display notification \"$escaped_message\" with title \"$escaped_title\""
