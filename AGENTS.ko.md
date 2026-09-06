# 런 스캐폴드 규칙 (한국어)

`prompt.md` 는 모든 에이전트에게 공통으로 주어지는 장면 명세입니다. `<model> <effort>` 조합의 새 런을 시작하라는 요청을 받으면 아래 규칙을 따르세요.

## 절대 어기지 말 것

**기존 런은 엄격히 금지 영역입니다.** 다른 런의 내용을 절대 열지 말고, 검색하지 말고, 들여다보지도 말고, 실행하지도 말고, 복사하지도 마세요. 참고 자료나 영감의 원천으로 사용해서도 안 됩니다. **기존 런의 이름이나 `comparison/runs.json` 만 읽어서** 다음 일련번호를 고를 수는 있습니다.

## 새 런을 시작하는 절차

1. 구현을 시작하기 전에 `startedAt` 을 **ISO 8601 타임스탬프**로 기록하세요.
2. 새 런 폴더명은 `<model>-<effort>-NN` 형식으로, `NN` 은 비어 있는 다음 두 자리 일련번호입니다.
3. 오직 `runs/<name>/` 디렉터리만 만드세요. 진입점은 `index.html` 이고, 모든 보조 파일은 그 안에 둡니다.
4. 완료되면 `{ "name", "provider", "agent", "model", "effort", "startedAt", "durationSeconds" }` 를 `comparison/runs.json` 에 append 하세요. `provider` 는 `OpenAI` / `Anthropic`, `agent` 는 `Codex` / `Claude Code` 를 사용하고, 경과 시간(벽시계)을 정수 초 단위로 기록합니다.
5. 커밋은 오직 `runs/<name>/` 과 `comparison/runs.json` 만 포함합니다. 의미 있는 커밋 메시지를 직접 작성하고, 무관한 변경은 절대 포함하지 마세요.
6. 모든 경로는 **상대 로컬 경로만** 사용하세요. 결과물은 **네트워크 요청 없이 오프라인**에서 동작해야 합니다.

## 절대 편집하지 말 것

- `prompt.md`
- 다른 런들 (소유자: 다른 에이전트)
- `comparison/` 디렉터리 내 `runs.json` 외의 다른 모든 파일

---

> **참고**: 원본 저장소(`danmana/piata-unirii`)의 `AGENTS.md` 는 `CLAUDE.md` 의 심볼릭 링크였습니다. 이 한국어화 버전에서는 두 파일을 모두 독립된 사본으로 유지합니다 — 본 파일은 안내문만 담고, 위 내용은 `CLAUDE.md` 와 의미가 동일합니다.