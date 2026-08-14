# ☕ 온라인 탕비실

익명의 동료들과 커피 한잔 — 실시간 온라인 탕비실.

커피를 내려 자리를 잡으면 공유 카운터에 내 컵이 올라가고, 같은 시간에 접속한 사람들의 컵과 한 줄 메시지가 실시간으로 보입니다. 디저트를 집어 먹고, 냉동만두를 데우고, 자판기 음료를 뽑고, 화분에 물을 주고, 창밖 날씨와 뉴스 티커를 구경하며 잠깐 쉬었다 가는 공간입니다.

**v0.2 — 살아있는 탕비실**
- **식은 컵**: 다녀간 사람의 컵이 몇 시간 동안 회색으로 남아 "흔적"이 됩니다. 빈 방도 비어 보이지 않아요.
- **ASMR 사운드**: 커피 추출, 빗소리(실제 날씨 연동), 전자레인지, 고양이 골골송까지 — 전부 Web Audio 합성(오디오 파일 0개). 헤더의 🔇 버튼으로 켭니다.
- **탕비실 고양이 "탕비"**: 카운터를 어슬렁거리는 상주 고양이. 쓰다듬어 보세요.
- **픽셀 오브젝트**: 문이 벌컥 열리는 전자레인지(창 너머 만두가 돌아가고 타이머가 줄어요), 유리창에 음료가 진열된 자판기, 쿠키 항아리가 놓인 나무 선반, 추출 중 커피가 차오르는 머신.
- **출근 도장 + 쉼 타이머**: 하루 첫 커피에 도장 — 연속 출근 스트릭(헤더 🔥)과 오늘 쉰 시간이 시계 상태창에 은은하게 표시됩니다.

**v0.3 — 흡연실 (프로토타입)**

탕비실 오른쪽 아래 `복도 → 흡연실` 문으로 들어갑니다.

- **소환 의식**: 담배 한 개비 = 실시간 12초. 연달아 **3개비**를 피우면 문이 열리고 누가 들어옵니다.
  개비마다 뭔가 일어납니다 — 재떨이에 꽁초가 쌓이고, 벽 낙서가 하나씩 드러나고, 복도에서 발자국이 들립니다.
  한 번 만난 뒤엔 한 대면 오고, 들어가면 이미 앉아 있기도 합니다.
- **비흡연자 경로**: 담배를 안 피우고 흡연실에 3분간 그냥 서 있어도 같은 사람이 옵니다.
- **기억하는 NPC**: 이전 대화, 고민, 그리고 **지난번에 준 조언의 결과**를 기억합니다.
  다음에 만나면 먼저 물어봅니다 — *"지난번에 팀장한테 말해보라 했잖아. 했어?"*
- **기억은 이 브라우저에만** 저장됩니다. 서버에 남지 않고, 다른 사람에게 보이지 않습니다.
  아저씨에게 "다 잊어줘"라고 하면 실제로 삭제됩니다.
- **안전장치**: 위기 신호가 감지되면 캐릭터를 유지한 채 상담 전화(109)로 연결합니다.

## 기술 스택

- **프론트엔드**: React 18 + TypeScript + Vite 7
- **스타일**: Tailwind CSS 4 (+ 대부분 인라인 픽셀 스타일, DotGothic16 폰트)
- **실시간 백엔드**: Supabase (Postgres + Realtime + Presence)
- **NPC AI**: Anthropic API (Cloudflare Pages Functions 프록시, SSE 스트리밍)
- **외부 데이터**: open-meteo(날씨·미세먼지), 연합뉴스 RSS

## 로컬 실행

```bash
npm install
npm run dev        # http://localhost:5173
```

환경변수 없이 실행하면 **오프라인 데모 모드**(혼자 있는 방)로 동작합니다.
실시간 모드를 쓰려면 `.env.example`을 `.env`로 복사하고 Supabase 값을 채우세요.

## Supabase 설정 (실시간 모드 = 동시접속)

1. [supabase.com](https://supabase.com)에서 프로젝트 생성
2. **SQL Editor**에서 [`supabase/schema.sql`](./supabase/schema.sql) 전체 실행
   — 실행이 끝나면 이 표가 나와야 합니다. 하나라도 `없음` 이면 아래 함정을 보세요.

   | 테이블 | 상태 |
   |---|---|
   | cups | ok |
   | fridge | ok |
   | vents | ok |

3. **Settings → API**의 Project URL과 anon key를 `.env`에 입력:

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

### ⚠️ 함정 — `already member` 오류 하나가 테이블을 전부 지운다

재실행할 때 이런 오류가 나면 **파일이 오래된 것**입니다.

```
ERROR: 42710: relation "cups" is already member of publication "supabase_realtime"
```

SQL Editor 는 스크립트 전체를 **한 트랜잭션**으로 돌립니다. 그래서 맨 끝의
`alter publication ... add table cups` 한 줄이 실패하면, **그 위에서 만든
테이블까지 전부 롤백**됩니다. 화면에는 오류 한 줄만 뜨는데 실제로는
아무것도 안 만들어져 있습니다. 실제로 이것 때문에 냉장고가 며칠 안 돌았습니다.

지금 `schema.sql` 은 이미 들어 있으면 건너뛰도록 고쳐져 있으니, 최신 파일을
받아서 실행하세요:

```
https://raw.githubusercontent.com/diaplus97/tangbisil/main/supabase/schema.sql
```

어떤 테이블이 있는지 바로 확인하려면:

```sql
select tablename from pg_tables where schemaname = 'public';
```

### ⚠️ `VITE_` 변수는 빌드할 때 번들에 박힌다

런타임에 읽는 값이 아닙니다. Cloudflare/Vercel 대시보드에 값을 넣기만 하고
**재배포를 안 하면 기존 번들은 그대로**라서 사이트는 계속 오프라인입니다.
에러가 안 나기 때문에 눈으로는 구별되지 않습니다.

값을 넣은 뒤 반드시 재배포하고, 아래로 확인하세요:

```bash
npm run verify:online https://내주소.pages.dev
```

번들에 설정이 실제로 박혔는지, cups 테이블이 읽히는지, 삭제가 막혀 있는지,
Realtime 웹소켓이 붙는지까지 한 번에 검사합니다.

### 보안 — anon key 는 공개 키입니다

anon key 는 브라우저 번들에 그대로 들어갑니다(원래 그런 용도의 키입니다).
따라서 **RLS 정책이 유일한 방어선**입니다. `schema.sql` 은 이렇게 잡혀 있습니다:

| 동작 | 허용 | 이유 |
|---|---|---|
| SELECT | ✅ | 남의 컵이 보여야 방이 성립함 |
| INSERT / UPDATE | ✅ | 익명 서비스라 "이 컵이 네 것인지" 서버가 검증할 방법이 없음 |
| DELETE | ❌ | 막지 않으면 누구나 요청 한 번으로 방 전체를 비울 수 있음 |

오래된 컵(8시간 경과)은 `prune_old_cups()` 함수로만 정리됩니다.

> 구버전 `public_all` 정책을 쓰던 프로젝트라면 `schema.sql` 을 **다시 실행**하세요.
> `npm run verify:online` 의 4번 항목이 이걸 잡아냅니다.

## 흡연실 NPC 설정 (AI 연동)

NPC 없이도 앱은 정상 동작합니다 — AI 서버가 없으면 아저씨가 등장은 하되 말을 못 합니다.

### 1. API 키

[console.anthropic.com](https://console.anthropic.com) 에서 API 키를 발급받습니다.
**Claude MAX/Pro 구독과는 별개인 종량제 크레딧**입니다. 구독은 이 앱의 API 호출을 덮지 않습니다.

### 2. 로컬 실행

API 키는 서버에서만 쓰이므로 `vite dev` 로는 NPC 대화가 안 됩니다. Pages Functions 런타임이 필요합니다:

```bash
cp .dev.vars.example .dev.vars   # ANTHROPIC_API_KEY 채우기
npm run build
npx wrangler pages dev dist      # http://localhost:8788
```

### 3. 배포 (Cloudflare Pages)

**Settings → Environment variables** 에 `ANTHROPIC_API_KEY` 를 **Secret 타입**으로 등록합니다.
나머지 값(`NPC_MODEL`, `DAILY_BUDGET_USD` 등)은 선택 사항입니다 — [`.dev.vars.example`](./.dev.vars.example) 참고.

> ⚠️ **[`wrangler.toml`](./wrangler.toml) 이 있으면 대시보드의 Functions 설정은 무시됩니다.**
> compatibility flags 와 KV 바인딩은 대시보드가 아니라 **반드시 `wrangler.toml` 에** 적어야 합니다.
> (환경변수/시크릿은 대시보드가 맞습니다)

`wrangler.toml` 의 `compatibility_flags = ["nodejs_compat"]` 는 **빼면 안 됩니다.**
`@anthropic-ai/sdk` 가 자격증명 체인 때문에 `node:fs` / `node:path` 를 정적 import 하는데,
이 플래그가 없으면 모듈 평가 단계에서 Worker 가 죽습니다.

### 4. 일일 예산 차단기 ⚠️ 배포 전 필수

하루 사용액이 상한을 넘으면 NPC 가 등장하지 않게 하는 장치입니다.
이게 없으면 트래픽이 몰렸을 때 청구액에 상한이 없습니다.

1. Cloudflare → **Workers & Pages → KV** 에서 네임스페이스 생성 (예: `tangbisil-budget`)
2. 생성된 ID 를 [`wrangler.toml`](./wrangler.toml) 의 `[[kv_namespaces]]` 블록에 넣고 주석 해제
3. `DAILY_BUDGET_USD` 환경변수로 상한 설정 (미설정 시 5달러)

바인딩이 없으면 차단기가 꺼진 채로 동작하며 서버 로그에 경고가 남습니다.
백업으로 Anthropic Console 의 사용량 알림도 함께 걸어두는 걸 권장합니다.

### 5. 배포 직후 확인

```bash
npm run verify:deploy https://<배포주소>
```

라우팅 → 키 등록 → 실제 응답까지 한 번에 확인하고, 아저씨가 뭐라고 답했는지도 찍어줍니다.
말투가 규칙에서 벗어나면(너무 길거나, 마크다운을 쓰거나, "힘내세요" 를 하거나) 같이 짚어줍니다.

이 확인이 필요한 이유: 정적 파일이 함수를 가리면 `/api/chat` 이 `index.html` 을 돌려주고,
클라이언트는 그걸 "AI 서버 없음" 으로 판단해 조용히 폴백합니다.
**아저씨가 등장은 하는데 말을 못 하는 상태가 에러 없이 만들어집니다.**

### 모델 바꿔보기

`NPC_MODEL` 환경변수만 바꾸면 코드 수정 없이 교체됩니다. 같은 하소연을 던져보고
아저씨 말투가 사는 쪽을 고르세요 (짧게 말하는지, 상투적인 위로를 안 하는지).

### 비용 참고

15턴 대화 1회 기준 (프롬프트 캐싱 적용) 대략:

| 모델 | 대화 1회 |
|---|---|
| `claude-opus-5` | 약 210원 |
| `claude-sonnet-5` (기본값) | 약 90원 |
| `claude-haiku-4-5` | 약 42원 |

사용자당 상한은 담배 갑(하루 20개비)과 일일 대화 턴 수(40턴)로,
서비스 전체 상한은 위의 예산 차단기로 걸립니다.

> **GitHub Pages 로는 NPC 가 동작하지 않습니다.** 정적 호스팅이라 서버 함수를 올릴 수 없습니다.
> AI 기능을 쓰려면 Cloudflare Pages(권장) 또는 Vercel 로 배포하세요.

## 배포

어느 방식이든 환경변수 `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`를 등록하지 않으면
오프라인 데모 모드로 빌드됩니다 (빌드는 실패하지 않음).

### Cloudflare Pages (권장)

무료 플랜에서 대역폭 제한이 없고 상업적 사용도 허용되어, 광고·후원 등 수익화를 붙일 때 가장 안전합니다.
`public/_redirects`(SPA 폴백)와 `public/_headers`(캐시 정책)가 이미 들어 있어 추가 설정이 필요 없습니다.

1. Cloudflare 대시보드 → **Workers & Pages** → **Create** → **Pages** → 이 레포 연결
2. 빌드 설정 — 프레임워크 프리셋 `Vite`, Build command `npm run build`, Output directory `dist`
3. **Settings → Environment variables** → **Production** 에 등록
   (Preview 는 별도 환경입니다. 배포 주소에서 쓰려면 Production 에 넣어야 합니다)

   | 이름 | 값 | 타입 |
   |---|---|---|
   | `VITE_SUPABASE_URL` | `https://xxxx.supabase.co` | Text |
   | `VITE_SUPABASE_ANON_KEY` | `eyJ...` | Text |
   | `ANTHROPIC_API_KEY` | `sk-ant-...` | **Secret** |

4. **Deployments → 최신 배포 → Retry deployment** 로 재빌드
   (환경변수만 추가하면 기존 번들은 안 바뀝니다)
5. `npm run verify:online <주소>` 로 확인

> 배포 주소 주의: `a385fd93.내앱.pages.dev` 처럼 앞에 해시가 붙은 주소는
> **그 시점 배포의 스냅샷**이라 영원히 그 빌드에 고정됩니다.
> 실제 서비스 주소는 해시 없는 `내앱.pages.dev` 입니다.

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
functions/api/chat.ts              # NPC AI 프록시 (API 키는 여기서만 쓰인다)
src/
├── context/
│   ├── BreakRoomContext.tsx       # 탕비실 상태 — 컵/메시지/presence 실시간 동기화
│   └── SmokingRoomContext.tsx     # 흡연실 상태 — 담배 메커닉 + NPC 대화
├── pages/TangbirsilRoom.tsx       # 룸 라우팅 (탕비실 ↔ 흡연실)
├── components/
│   ├── BreakRoomScene.tsx         # 탕비실 씬 (전자레인지·디저트·자판기 포함)
│   ├── SharedCounter.tsx          # 공유 카운터 + 컵 결투
│   ├── CoffeeMachine.tsx          # 커피 내리기 (자리잡기)
│   ├── ComposerBar.tsx            # 한 줄 메시지 입력
│   ├── SmokingRoom.tsx            # 흡연실 씬 (재떨이·낙서·NPC)
│   ├── NpcDialogue.tsx            # NPC 대화 패널
│   └── ...                        # 창문 날씨, 시계, 화분, 티커 등
├── lib/
│   ├── npcPrompt.ts               # NPC 캐릭터 프롬프트 + 위기 감지 + 요약 스키마
│   ├── npcMemory.ts               # 기억 (localStorage) — 프로필/요약/미결 과제
│   ├── npcClient.ts               # /api/chat 호출 + SSE 파싱
│   └── sound.ts                   # Web Audio 합성 효과음
└── hooks/                         # 날씨·미세먼지·뉴스·시계
```

## npm 스크립트

| 명령 | 설명 |
|---|---|
| `npm run dev` | 개발 서버 |
| `npm run build` | 프로덕션 빌드 (`dist/`) |
| `npm run preview` | 빌드 결과 미리보기 |
| `npm run typecheck` | TypeScript 타입 검사 |
