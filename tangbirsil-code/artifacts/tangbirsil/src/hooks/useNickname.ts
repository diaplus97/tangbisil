import { useState, useCallback } from "react";

const STORAGE_KEY = "tangbirsil_nickname";

function generateNickname(): string {
  const n = Math.floor(100 + Math.random() * 900);
  return `Anonymous${n}`;
}

function nicknameColor(nick: string): string {
  const colors = [
    "#e74c3c", "#e67e22", "#f39c12", "#27ae60",
    "#2980b9", "#8e44ad", "#16a085", "#c0392b",
    "#d35400", "#1abc9c",
  ];
  let hash = 0;
  for (let i = 0; i < nick.length; i++) hash = nick.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

export function useNickname() {
  const [nickname, setNickname] = useState<string>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || (() => {
        const n = generateNickname();
        localStorage.setItem(STORAGE_KEY, n);
        return n;
      })();
    } catch {
      return generateNickname();
    }
  });

  const reroll = useCallback(() => {
    const n = generateNickname();
    try { localStorage.setItem(STORAGE_KEY, n); } catch {}
    setNickname(n);
  }, []);

  return { nickname, reroll, color: nicknameColor(nickname) };
}
