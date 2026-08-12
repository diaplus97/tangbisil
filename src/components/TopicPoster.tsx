/**
 * TopicPoster — 벽에 붙은 "오늘의 주제" 포스터
 *
 * 날짜 기준으로 로테이션되는 잡담 주제. 빈 방에서도 말 걸 거리를 만들어준다.
 */

const TOPICS = [
  "요즘 최애 간식은?",
  "커피는 하루에 몇 잔까지가 적당할까요",
  "점심 메뉴 추천 받습니다",
  "요즘 퇴근하고 뭐 하세요?",
  "월요일을 버티는 나만의 방법",
  "탕비실에 꼭 있었으면 하는 간식은?",
  "아아 vs 뜨아, 당신의 선택은",
  "최근에 본 것 중 제일 웃겼던 것",
  "오늘 저녁 뭐 먹지",
  "요즘 듣는 노래 하나만 공유해요",
  "스트레스 풀리는 나만의 방법",
  "지금 제일 가고 싶은 여행지는?",
  "믹스커피가 제일 맛있는 순간",
  "야근할 때 최고의 야식은?",
  "출근길에 듣기 좋은 노래",
  "요즘 빠져 있는 취미 있나요",
  "회사 앞 맛집 하나씩 공유해요",
  "금요일 오후를 버티는 법",
  "제일 좋아하는 계절과 이유",
  "탕비실 냉장고에 뭐가 있으면 행복할까",
  "핫초코가 생각나는 날씨네요",
  "요즘 제일 기대되는 일 하나",
  "커피에 곁들이면 최고인 디저트",
  "휴가 가면 제일 하고 싶은 것",
  "오늘 하루를 한 단어로 표현하면?",
  "일하다 웃음 터졌던 순간",
  "내일의 나에게 한마디",
  "요즘 나를 버티게 하는 것",
];

function todayTopic(): string {
  const daysSinceEpoch = Math.floor(Date.now() / 86_400_000);
  return TOPICS[daysSinceEpoch % TOPICS.length];
}

export default function TopicPoster({ compact = false }: { compact?: boolean }) {
  return (
    <div style={{
      background: "hsl(48 70% 88%)",
      border: "2px solid hsl(30 25% 40%)",
      boxShadow: "2px 3px 0 rgba(0,0,0,0.22)",
      transform: "rotate(-1.6deg)",
      padding: compact ? "4px 7px" : "6px 10px",
      maxWidth: compact ? 150 : 210,
      textAlign: "center",
      fontFamily: "'DotGothic16', monospace",
      position: "relative",
    }}>
      {/* 압정 */}
      <div style={{
        position: "absolute", top: -6, left: "50%", transform: "translateX(-50%)",
        fontSize: compact ? 9 : 11, lineHeight: 1,
      }}>
        📌
      </div>
      <div style={{ fontSize: compact ? 7 : 8, color: "hsl(28 60% 38%)", marginBottom: 2, marginTop: 2 }}>
        오늘의 주제
      </div>
      <div style={{ fontSize: compact ? 10 : 12, color: "hsl(30 30% 22%)", lineHeight: 1.45, wordBreak: "keep-all" }}>
        {todayTopic()}
      </div>
      {!compact && (
        <div style={{ fontSize: 7, color: "hsl(30 20% 52%)", marginTop: 3 }}>
          아래에서 한마디로 답해보세요
        </div>
      )}
    </div>
  );
}
