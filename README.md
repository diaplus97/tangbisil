# ☕ 온라인 탕비실

익명의 동료들과 커피 한잔 — 실시간 온라인 탕비실.

커피를 내려 자리를 잡으면 공유 카운터에 내 컵이 올라가고, 같은 시간에 접속한 사람들의 컵과 한 줄 메시지가 실시간으로 보입니다. 디저트를 집어 먹고, 냉동만두를 데우고, 자판기 음료를 뽑고, 화분에 물을 주고, 창밖 날씨와 뉴스 티커를 구경하며 잠깐 쉬었다 가는 공간입니다.

**v0.2 — 살아있는 탕비실**
- **식은 컵**: 다녀간 사람의 컵이 몇 시간 동안 회색으로 남아 "흔적"이 됩니다. 빈 방도 비어 보이지 않아요.
- **ASMR 사운드**: 커피 추출, 빗소리(실제 날씨 연동), 전자레인지, 고양이 골골송까지 — 전부 Web Audio 합성(오디오 파일 0개). 헤더의 🔇 버튼으로 켭니다.
- **탕비실 고양이 "탕비"**: 카운터를 어슬렁거리는 상주 고양이. 쓰다듬어 보세요.
- **출근 도장 + 쉼 타이머**: 하루 첫 커피에 도장이 찍히고 연속 출근 스트릭과 오늘 쉰 시간이 기록됩니다.
- **오늘의 주제**: 벽에 붙은 잡담 주제가 매일 바뀝니다.

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

## 배포 (Vercel 기준)

1. 이 레포를 Vercel에 연결 (Framework: Vite 자동 감지)
2. Build Command `npm run build` / Output Directory `dist` (기본값)
3. 환경변수 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` 등록

Cloudflare Pages, Netlify도 동일한 설정으로 배포 가능합니다.

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
