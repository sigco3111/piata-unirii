# Piața Unirii, 클루즈나포카 — 복셀 미니어처

**Three.js(r185, 벤더링된 사본) 기반의 자기완결형 장면** — Piața Unirii(통일광장) 전체를 정교하게 재현합니다. **성 미하일 성당** 의 **80 m 네오-고딕 단일 종탑**, **마차이 코르비누스 동상대**, **로마 나포카 발굴 창**, **반피 궁전**, **이울리우 마니우 거리의 미러 빌딩**, **구 호텔 콘티넨탈**, 북·서·남쪽의 명명된 파사드들, 구시가지, 소메시 강(Someș), 그리고 클루즈를 둘러싼 구릉까지 포함합니다.

HTTP 프로토콜로 `index.html` 을 여세요(ES Module 이라서 — 비교 뷰어가 자동으로 그렇게 합니다). 네트워크 요청은 없습니다.

## 조작법

- 좌클릭 드래그 회전 · 우클릭 드래그 이동 · 스크롤 줌
- `R` 성당과 동상에 다시 중심 · `F` 시네마틱 플라이오버 · `T` 낮 ↔ 골든아워
- `V` 거리 수준 ↔ 항공 뷰 · `L` 떠 있는 랜드마크 라벨(기본 꺼짐) · `G` 군중·차량·카페 가구·창문 조명 재생성

## 디렉터리 구성

- `src/voxel.js` — 복셀 그리드, 셰이프 래스터라이저, AO 가 구워진 그리디 메셔, 지오메트리 싱크
- `src/ground.js` — 지형 높이맵(포장·도로·연석·분수대·발굴·강)
- `src/church.js`, `src/monument.js` — LOD 0 랜드마크(0.25 m / 0.125 m 복셀)
- `src/buildings.js`, `src/perimeter.js` — 매개변수화된 역사 파사드와 광장 네 면
- `src/city.js` — 외곽 블록(LOD 1/2/3), 구릉, 숲, 원경의 건물들
- `src/props.js` — 나무, 벤치, 가로등, 카페 테라스, 자전거, 분수 분사
- `src/agents.js` — 보행자, 자전거, 비둘기, 차량
- `src/labels.js` — 선택형 랜드마크/거리 라벨(DOM 오버레이를 월드 앵커에 고정)
- `src/sky.js`, `src/materials.js`, `src/world.js`, `src/main.js`

## 의존성

`vendor/` 폴더에 번들링된 사본을 사용하므로 **완전한 오프라인** 실행이 가능합니다.

- `vendor/three.module.js`, `vendor/three.core.js` (Three.js r185)
- `vendor/OrbitControls.js`

## 로컬 실행

```bash
python3 -m http.server 8000
# http://localhost:8000/runs/fable-5.1-xhigh-01/index.html
```

`file://` 로 직접 열면 동작하지 않습니다 — ES Module 의 보안 정책 때문이며, HTTP origin 이 필요합니다.