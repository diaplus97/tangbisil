# 창밖 풍경 v2 · 바다와 푸른 하늘 · 2026-11-04

## 반복 영상 추가 · 2026-11-05

현재는 아래 원경을 기반으로 하늘·섬·해안을 고정하고 수면을 주기적으로 변형한 24초 시네마그래프를 사용한다. `scripts/prepare-sea.py`에서 직접 제작했으며 촬영 영상이나 영상 생성 서비스 출력은 아니다. 1280×640/24fps WebM(VP9, 약 1.41MB)을 우선하고 MP4(H.264, 약 4.87MB)를 대안으로 제공한다. 정지 JPG는 초기 로딩·동작 감소·재생 실패 시 유지한다. GIF는 사용하지 않는다. 영상 프레임·주기·해시는 `sea-video.json`에 있다.

Three VideoTexture로 창문 평면 안에서만 재생한다. 탭이 숨겨지거나 방이 화면 밖이거나 모달이 열리면 중단한다. 동작 감소 설정에서는 사용자 선택 전 정지 상태로 시작하고, 설정에서 언제든 움직임을 끌 수 있다. 카메라와 실내 전체는 영상에 포함되지 않는다.

파도 환경음은 영상과 독립된 44초 PCM WAV 루프다. pulswelle의 [Waves at Baltic Sea shore.wav](https://freesound.org/people/pulswelle/sounds/339517/) 공개 HQ MP3 미리보기에서 12초부터 48초를 편집하고 4초 겹침으로 연결했다. CC0 1.0이며 출처·처리·해시는 `SEA_CREDITS.txt`와 `sea-audio.json`에 기록한다. 기본 무음, 별도 켜기/끄기와 파도 음량을 제공한다. 실제 주관적 청취를 완료했다고 주장하지 않는다.

아래는 정지 원경의 제작 기록이다. 단일 평면의 깊이별 시차 한계는 여전히 남지만 ‘파도 애니메이션 없음’은 위 반복 영상으로 대체한다.

사용자가 첨부한 SANSA 화면에서 참고한 것은 단순한 캐릭터와 세밀한 환경의 조합이다. 첨부 이미지의 픽셀·모델·텍스처는 게임 자산으로 재사용하지 않았다. SANSA의 실제 제작 기술은 확인하지 않았다.

사용자는 회사 주변 같은 풍경보다 바다·산속·푸른 하늘처럼 보기 좋은 풍경을 원한다고 추가했다. 이에 기본 창밖을 바다와 먼 섬, 넓은 하늘로 교체했다. 숲과 하늘은 후속 후보이며 현재 선택 메뉴나 자동 순환 기능은 없다. 풍경의 이미지·구도·대체 색·접근성 설명을 `src/experience/three/windowView.ts`로 모아 후속 자산 교체가 방과 간식 로직에 영향을 주지 않게 했다.

## 현재 자산

- 런타임: `src/assets/environments/pantry-sea-v1.jpg`, 1774 × 887, 320,428 bytes. 내장 image_gen으로 새로 생성한 사실적 표현의 풍경이며 실사 촬영 사진이 아니다. 원본 PNG를 시각 변경 없이 JPEG 품질 91로 압축했다.
- 원본: `C:/Users/민준12/.codex/generated_images/01a1a41a-fbf6-7de2-8c1b-27e94b785b85/exec-6056a428-58e4-40b6-97e3-9a56329be755.png`. 실행에 원본 경로가 필요하지 않다.
- 게임에서는 창문 안에만 표시한다. 실내 카메라는 창틀보다 뒤에 있는 가상 평면으로 시선을 투영한다. 창틀은 실제 입체이며 시점 변화에 따른 가림을 유지한다. 풍경 자체는 단일 평면이므로 섬과 바다 각각의 입체 시차나 파도 애니메이션은 없다.
- 이전 동네 풍경 `src/assets/environments/pantry-window-v1.jpg`는 비교 기록으로 보관하며 현재 실행본에서는 불러오지 않는다.
- 3D 선택 때만 해시가 붙은 로컬 자산을 요청한다. 외부 이미지 서비스에 의존하지 않는다. 로딩 실패 시 단순한 풍경색으로 돌아가고 간식·접속 기능은 계속 작동한다. 방 해제 시 텍스처·재질을 해제하며 해제 뒤 도착한 이미지도 정리한다.
- 해 질 무렵은 풍경의 색온도와 실내 조명을 함께 바꾼다. 별도로 촬영·생성한 일몰 장면이나 실제 시간 변화는 아니다.

## 다음 제작 기준

창밖, 흡연실의 원경, 간식의 가까운 표면처럼 오래 보거나 직접 만지는 곳에 세부 묘사를 집중한다. 캐릭터 실루엣·행동과 읽어야 할 UI는 단순하게 둔다. 사실적인 부분과 단순한 부분 사이의 빛 방향, 색온도, 크기, 선명도는 함께 검토한다. 고정 시점에서는 환경 이미지와 입체 전경을 조합하고, 자유 이동을 채택하면 실제 입체 환경이나 깊이별 레이어로 교체한다.

후속 환경 자산은 직접 촬영·제작하거나 사용 범위가 확인된 자료로 교체할 수 있다. 현재 이미지는 비주얼 방향을 실제 게임에서 평가하기 위한 첫 자산이다. 이번 변경으로 모든 가구·캐릭터·간식의 최종 품질이 완료된 것으로 간주하지 않는다.

## 바다 풍경 생성 프롬프트

도구: 내장 `image_gen`. 새 이미지를 생성했으며 기존 동네 풍경이나 SANSA 화면을 편집 입력으로 사용하지 않았다.

```text
Use case: photorealistic-natural
Asset type: a wide panoramic outdoor background texture viewed through the window of a quiet shared break room in a 3D browser game.
Primary request: a beautiful restorative sea view, clear blue sky, a calm blue sea and distant forested islands. A place to rest the eyes and feel gently away from work.
Composition: landscape panorama, 2:1 aspect ratio, level camera, straight horizontal horizon at 45 percent from the top, moderate natural lens around 50mm, viewed from a low coastal bluff 8 metres above the water. The central 80 percent must stay open: blue water, broad sky, and a low forested island chain across the far horizon; do not fill the center with a big island. Small distant islands with atmospheric softness. The bottom edge shows fine water ripples, and only the extreme lower right may have a small natural coastal rock or green headland. Broad unbroken sky with a few soft white cumulus clouds, clean breathable negative space. Detailed but restful.
Lighting: fresh clear early afternoon, sunshine from upper left, natural sea blue with restrained turquoise shallows, cloud whites retain detail, realistic slight haze at the far horizon. Calm small ripples, a soft sparse glimmer of sunlight, no dramatic waves. Natural photographic realism, refined believable water and foliage, balanced exposure, no heavy color grading.
Constraints: scenery ONLY. No room, window frame, glass reflections, buildings, roads, cities, people, boats, furniture, text, logos, borders or watermarks. No tourism poster, no dramatic tropical fantasy, no orange sunset, no exaggerated HDR, no glossy AI concept-art look, no painting, no low-poly. Do not include an interior mockup. The scene should be beautiful enough to gaze at for a quiet break.
```

## 이전 동네 풍경 생성 프롬프트 (현재 미사용)

도구: 내장 `image_gen` (CLI/API 우회 사용 없음). 첨부 SANSA 이미지를 편집 입력으로 전달하지 않고 아래 설명으로 새 자산을 생성했다.

```text
Use case: photorealistic-natural
Asset type: a high resolution wide landscape environment background texture for the view OUTSIDE a Korean office pantry window in an actual 3D browser game, not a game screenshot or a room mockup.
Primary request: natural photographic realism, a tranquil ordinary Korean urban neighborhood seen from the third or fourth floor, with layered treetops, low and mid rise buildings, and a distant softly hazy wooded mountain ridge. Believable everyday place where an office worker rests their eyes.
Composition: panoramic landscape 2.5:1 aspect ratio. Camera level, straight verticals, moderate telephoto 50mm equivalent, no fisheye. Upper 35 percent is pale natural blue sky with a few very soft clouds. Mountain ridge stretches across background near upper middle. Middle distance modest off-white concrete and warm brick buildings 3-8 stories, believable straight windows, rooftop details, balcony rails, staggered depths, not a dense futuristic skyline. Lower 35 percent is richly detailed green ginkgo, zelkova and maple canopies with some pale autumn yellow foliage, dappled leaves, tiny branches. Edges continue naturally.
Lighting: quiet late afternoon at 3:30 pm, sun from upper left, realistic restrained exposure and color, slight atmospheric perspective, no dramatic sunset, no artificial golden glow. Detailed photographic textures, subtle imperfect materials, organic foliage, balanced greens, warm gray masonry.
Constraints: outdoors ONLY, unobstructed landscape. No window frame, glass, interior, furniture, people, characters, words, signage, logos, borders, collage or watermarks. No painterly brushwork, clay, low-poly, illustration, miniature tilt-shift, plastic surfaces, candy colors, exaggerated depth of field or oversaturation. It must feel like looking at an ordinary real Korean neighborhood, not generative concept art.
```
