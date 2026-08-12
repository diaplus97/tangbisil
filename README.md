# ☕ 온라인 탕비실

익명의 동료들과 커피 한잔 — 실시간 온라인 탕비실.

커피를 내려 자리를 잡으면 공유 카운터에 내 컵이 올라가고, 같은 시간에 접속한 사람들의 컵과 한 줄 메시지가 실시간으로 보입니다. 디저트를 집어 먹고, 냉동만두를 데우고, 자판기 음료를 뽑고, 화분에 물을 주고, 창밖 날씨와 뉴스 티커를 구경하며 잠깐 쉬었다 가는 공간입니다.

**v0.2 — 살아있는 탕비실**
- **식은 컵**: 다녀간 사람의 컵이 몇 시간 동안 회색으로 남아 "흔적"이 됩니다. 빈 방도 비어 보이지 않아요.
- **ASMR 사운드**: 커피 추출, 빗소리(실제 날씨 연동), 전자레인지, 고양이 골골송까지 — 전부 Web Audio 합성(오디오 파일 0개). 헤더의 🔇 버튼으로 켭니다.
- **탕비실 고양이 "탕비"**: 카운터를 어슬렁거리는 상주 고양이. 쓰다듬어 보세요.
- **픽셀 오브젝트**: 문이 벌컥 열리는 전자레인지(창 너머 만두가 돌아가고 타이머가 줄어요), 유리창에 음료가 진열된 자판기, 쿠키 항아리가 놓인 나무 선반, 추출 중 커피가 차오르는 머신.
- **출근 도장 + 쉼 타이머**: 하루 첫 커피에 도장 — 연속 출근 스트릭(헤더 🔥)과 오늘 쉰 시간이 시계 상태창에 은은하게 표시됩니다.

## 기술 스택

- **프론트엔드**: React 18 + TypeScript + Vite 7
- **스타일**: Tailwind CSS 4 (+ 대부분 인라인 픽셀 스타일, DotGothic16 폰트)
- **실시간 백엔드**: Supabase (Postgres + Realtime + Presence)
- **외부 데이터**: open-meteo(날씨·미세먼지), 연합뉴스 RSS

## 로컬 실행

```bash
npm install
npm run dev        # http://localhost:5173
```

환경변수 없이 실행하면 **오프라인 데모 모드**(혼자 있는 방)로 동작합니다.
실시간 모드를 쓰려면 `.env.example`을 `.env`로 복사하고 Supabase 값을 채우세요.

## Supabase 설정 (실시간 모드)

1. [supabase.com](https://supabase.com)에서 프로젝트 생성
2. **SQL Editor**에서 [`supabase/schema.sql`](./supabase/schema.sql) 전체 실행
3. **Settings → API**의 Project URL과 anon key를 `.env`에 입력:

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

## 배포

어느 방식이든 환경변수 `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`를 등록하지 않으면
오프라인 데모 모드로 빌드됩니다 (빌드는 실패하지 않음).

### Cloudflare Pages (권장)

무료 플랜에서 대역폭 제한이 없고 상업적 사용도 허용되어, 광고·후원 등 수익화를 붙일 때 가장 안전합니다.
`public/_redirects`(SPA 폴백)와 `public/_headers`(캐시 정책)가 이미 들어 있어 추가 설정이 필요 없습니다.

1. Cloudflare 대시보드 → **Workers & Pages** → **Create** → **Pages** → 이 레포 연결
2. 빌드 설정 — 프레임워크 프리셋 `Vite`, Build command `npm run build`, Output directory `dist`
3. **Settings → Environment variables**에 Supabase 값 두 개 등록 후 재배포

### GitHub Pages (현재 설정됨)

[`.github/workflows/deploy.yml`](./.github/workflows/deploy.yml)이 `main` 푸시마다 자동 배포합니다.
최초 1회만 레포 **Settings → Pages → Source**를 `GitHub Actions`로 바꿔주면 됩니다.
Supabase 값은 **Settings → Secrets and variables → Actions**에 등록합니다.

하위 경로(`/<레포명>/`)로 서빙되므로 워크플로가 `BASE_PATH`를 자동으로 맞춥니다.

### Vercel

[`vercel.json`](./vercel.json)이 있어 레포 연결만 하면 배포됩니다.
단, 무료(Hobby) 플랜은 약관상 상업적 사용이 금지되어 있어 수익화 단계에서는 유료 플랜이 필요합니다.

## 프로젝트 구조

```
src/
├── context/BreakRoomContext.tsx   # 핵심 상태 — 컵/메시지/presence 실시간 동기화
├── pages/TangbirsilRoom.tsx       # 메인 룸 레이아웃
├── components/
│   ├── BreakRoomScene.tsx         # 방 씬 (전자레인지·디저트·자판기 포함)
│   ├── SharedCounter.tsx          # 공유 카운터 + 컵 결투
│   ├── CoffeeMachine.tsx          # 커피 내리기 (자리잡기)
│   ├── ComposerBar.tsx            # 한 줄 메시지 입력
│   └── ...                        # 창문 날씨, 시계, 화분, 티커 등
└── hooks/                         # 날씨·미세먼지·뉴스·시계
```

## npm 스크립트

| 명령 | 설명 |
|---|---|
| `npm run dev` | 개발 서버 |
| `npm run build` | 프로덕션 빌드 (`dist/`) |
| `npm run preview` | 빌드 결과 미리보기 |
| `npm run typecheck` | TypeScript 타입 검사 |
