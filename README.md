# Piața Unirii (통일 광장, 클루즈나포카) — 모델 비교

하나의 장면 명세를 여러 코딩 에이전트가 **독립적으로 구현**해 한 화면에서 나란히 비교하는 저장소입니다.

모든 런은 [`prompt.md`](prompt.md)의 동일한 브리프를 구현합니다 — 루마니아 **클루즈나포카(Cluj-Napoca)의 Piața Unirii** 를 복셀 아트 시뮬레이션으로 만든 것으로, **성 미하일 성당**(Biserica Sfântul Mihail)과 **마차이 코르비누스 동상대**(Matthias Corvinus Monumental Ensemble)를 중심으로 궤도 카메라, 시네마틱 플라이오버(Flyover), 시간대 토글을 제공합니다.

## 디렉터리 구성

- `prompt.md` — 모든 에이전트에게 공통으로 주어진 장면 명세서입니다.
- `runs/<model>-<effort>-NN/` — 각 에이전트의 자기완결 런 하나. `index.html` 이 진입점입니다.
- `comparison/` — 두 런을 나란히 띄워 비교하는 2분할 뷰어입니다.
- `comparison/runs.json` — 각 런의 메타데이터(공급사, 에이전트, 모델, effort, 시작 시각, 소요 시간).

## 어떻게 실행하나요

모든 런은 **빌드 단계 없는 정적·오프라인 전용**입니다. 네트워크 요청이 일절 없습니다. 저장소 루트를 HTTP 로 서빙하고 `/comparison/` 으로 들어가면 됩니다.

```bash
python3 -m http.server 8000
# 그 다음 브라우저로 http://localhost:8000/comparison/ 접속
```

런의 `index.html` 을 파일 시스템에서 직접 열면 동작하지 않습니다. ES Module 이라 **HTTP 출처(origin)** 가 필요합니다.

## 런을 추가하려면

런은 사람이 직접 만드는 게 아니라, **각각 다른 코딩 에이전트(`<model> <effort>`)가 생성**합니다 — 자세한 스캐폴드 규칙은 [`CLAUDE.md`](CLAUDE.md)를 참고하세요.

핵심 규칙 한 줄 요약: **각 에이전트는 `prompt.md` 만 받아서 독립적으로 구현**하며, 다른 런의 소스를 절대 열거나 참고하지 않습니다.

## 어떤 에이전트들이 참여했나요

| 런 | 공급사 | 에이전트 | 모델 | effort | 소요 시간 |
|---|---|---|---|---|---|
| `gpt-5.6-sol-xhigh-01` | OpenAI | Codex | gpt-5.6-sol | xhigh | 약 12분 |
| `fable-5.1-xhigh-01` | Anthropic | Claude Code | fable-5.1 | xhigh | 약 80분 |
| `gpt-astra-xhigh-01` | OpenAI | Codex | GPT-Astra | xhigh | 약 36분 |
| `opus-5-xhigh-02` | Anthropic | Claude Code | opus-5 | xhigh | 약 2시간 45분 |

소요 시간은 각 런의 메타데이터(`comparison/runs.json`) 기준입니다.

## 라이선스 / 인용

원본 저장소 danmana/piata-unirii 의 결과를 그대로 복제하여 한국어로 지역화한 포크입니다. 모든 런의 코드는 원작자의 라이선스를 따릅니다.