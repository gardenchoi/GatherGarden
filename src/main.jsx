import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { createClient } from "@supabase/supabase-js";
import "./styles.css";

const ROOMS = [
  { id: "main", label: "재택타운", zone: "로비", accent: "#e2574c", spawn: { x: 505, y: 430 } },
  { id: "meeting-room", label: "회의실 A", zone: "주간 싱크", accent: "#9b6bd3", spawn: { x: 175, y: 215 } },
  { id: "focus-room", label: "뽀모도로 룸", zone: "함께 집중", accent: "#58b368", spawn: { x: 740, y: 200 } },
];

const COLORS = ["#e2574c", "#58b368", "#e8a33d", "#4a90d9", "#9b6bd3", "#d3699b"];
const WORLD = { width: 980, height: 640 };
const STEP = 18;

const FURNITURE = [
  { type: "wall meeting", x: 44, y: 52, w: 260, h: 184, label: "MEETING" },
  { type: "wall cafe", x: 330, y: 52, w: 330, h: 170, label: "CAFE" },
  { type: "wall focus", x: 704, y: 52, w: 220, h: 184, label: "FOCUS" },
  { type: "rug work", x: 52, y: 278, w: 528, h: 178, label: "OPEN DESKS" },
  { type: "rug game", x: 650, y: 280, w: 266, h: 170, label: "GAME" },
  { type: "rug lounge", x: 80, y: 488, w: 320, h: 112, label: "LOUNGE" },
  { type: "desk", x: 94, y: 120, w: 154, h: 52 },
  { type: "chair", x: 94, y: 88, w: 36, h: 36 },
  { type: "chair", x: 146, y: 88, w: 36, h: 36 },
  { type: "chair", x: 198, y: 88, w: 36, h: 36 },
  { type: "chair", x: 112, y: 176, w: 36, h: 36 },
  { type: "chair", x: 176, y: 176, w: 36, h: 36 },
  { type: "counter", x: 370, y: 92, w: 210, h: 48 },
  { type: "machine", x: 408, y: 60, w: 38, h: 38, label: "☕" },
  { type: "machine", x: 518, y: 60, w: 38, h: 38, label: "🥤" },
  { type: "table", x: 406, y: 166, w: 58, h: 58 },
  { type: "table", x: 536, y: 166, w: 58, h: 58 },
  { type: "desk", x: 730, y: 116, w: 70, h: 44 },
  { type: "desk", x: 820, y: 116, w: 70, h: 44 },
  { type: "bean", x: 762, y: 176, w: 58, h: 38 },
  { type: "desk", x: 104, y: 320, w: 82, h: 46 },
  { type: "desk", x: 230, y: 320, w: 82, h: 46 },
  { type: "desk", x: 356, y: 320, w: 82, h: 46 },
  { type: "desk", x: 104, y: 398, w: 82, h: 46 },
  { type: "desk", x: 230, y: 398, w: 82, h: 46 },
  { type: "desk", x: 356, y: 398, w: 82, h: 46 },
  { type: "plant", x: 52, y: 298, w: 42, h: 52 },
  { type: "plant", x: 548, y: 384, w: 42, h: 52 },
  { type: "arcade", x: 694, y: 322, w: 54, h: 76, label: "99" },
  { type: "arcade", x: 770, y: 322, w: 54, h: 76, label: "GO" },
  { type: "tv", x: 840, y: 318, w: 50, h: 42 },
  { type: "sofa", x: 130, y: 538, w: 130, h: 42 },
  { type: "table", x: 282, y: 526, w: 66, h: 54 },
  { type: "booth", x: 780, y: 500, w: 72, h: 78, label: "CALL" },
  { type: "plant", x: 890, y: 532, w: 42, h: 52 },
];

const NPCS = [
  { id: "latte", name: "라떼", color: "#e8a33d", x: 450, y: 156, status: "커피 브레이크" },
  { id: "jay", name: "제이", color: "#9b6bd3", x: 152, y: 156, status: "회의 중" },
  { id: "mimosa", name: "미모사", color: "#d3699b", x: 796, y: 172, status: "뽀모도로" },
  { id: "pingu", name: "핑구", color: "#5561d8", x: 746, y: 410, status: "게임 중" },
  { id: "tofu", name: "두부", color: "#4fae9e", x: 530, y: 510, status: "온라인" },
];

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

function getId() {
  const stored = localStorage.getItem("gg-player-id");
  if (stored) return stored;
  const next = crypto.randomUUID();
  localStorage.setItem("gg-player-id", next);
  return next;
}

function getProfile() {
  try {
    return JSON.parse(localStorage.getItem("gg-profile") || "null");
  } catch {
    return null;
  }
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function roomById(roomId) {
  return ROOMS.find((room) => room.id === roomId) || ROOMS[0];
}

function presenceList(state, selfId) {
  return Object.values(state)
    .flat()
    .filter((entry) => entry?.id && entry.id !== selfId)
    .map((entry) => ({
      id: entry.id,
      name: entry.name || "방문자",
      color: entry.color || COLORS[0],
      x: Number(entry.x) || 0,
      y: Number(entry.y) || 0,
      room: entry.room,
      lastSeen: entry.lastSeen || Date.now(),
    }));
}

function timeLabel(value = Date.now()) {
  const date = new Date(value);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function JoinScreen({ onJoin }) {
  const [name, setName] = useState(getProfile()?.name || "");
  const [color, setColor] = useState(getProfile()?.color || COLORS[0]);

  function submit(event) {
    event.preventDefault();
    const cleanName = name.trim().slice(0, 16);
    if (!cleanName) return;
    const profile = { id: getId(), name: cleanName, color };
    localStorage.setItem("gg-profile", JSON.stringify(profile));
    onJoin(profile);
  }

  return (
    <main className="join-screen">
      <DecorativeTown />
      <section className="welcome-card">
        <div className="brand-card">재택타운</div>
        <p>재택러들의 픽셀 아지트</p>
        <form onSubmit={submit}>
          <label>
            <span>닉네임</span>
            <input
              autoFocus
              maxLength={16}
              placeholder="정원"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <div className="swatches" aria-label="아바타 색상">
            {COLORS.map((item) => (
              <button
                aria-label={`색상 ${item}`}
                className={item === color ? "swatch active" : "swatch"}
                key={item}
                onClick={() => setColor(item)}
                style={{ background: item }}
                type="button"
              />
            ))}
          </div>
          <button className="primary" type="submit">입장하기</button>
        </form>
        <small>WASD / 방향키 이동 · 같은 방 채팅 · 실시간 아바타</small>
      </section>
    </main>
  );
}

function DecorativeTown() {
  return (
    <div className="decor-town" aria-hidden="true">
      {FURNITURE.map((item, index) => (
        <div
          className={`tile ${item.type}`}
          key={`${item.type}-${index}`}
          style={{ left: item.x, top: item.y, width: item.w, height: item.h }}
        >
          {item.label}
        </div>
      ))}
    </div>
  );
}

function Avatar({ player, self, npc }) {
  return (
    <div
      className={self ? "avatar self" : npc ? "avatar npc" : "avatar"}
      style={{ left: player.x, top: player.y, "--avatar-color": player.color }}
    >
      <div className="avatar-body">
        <span className="eye left" />
        <span className="eye right" />
        <span className="shirt" />
      </div>
      <strong>{self ? "나" : player.name}</strong>
    </div>
  );
}

function WorldMap({ profile, room, position, peers }) {
  return (
    <section className="world-frame">
      <div className="world" style={{ "--room-accent": room.accent }}>
        <DecorativeTown />
        <div className="path horizontal" />
        <div className="path vertical" />
        {NPCS.map((npc) => <Avatar key={npc.id} player={npc} npc />)}
        {peers.map((peer) => <Avatar key={peer.id} player={peer} />)}
        <Avatar player={{ ...profile, ...position }} self />
      </div>
    </section>
  );
}

function MiniMap({ position, peers }) {
  const scaleX = 184 / WORLD.width;
  const scaleY = 120 / WORLD.height;

  return (
    <aside className="minimap" aria-label="미니맵">
      <div className="mini-grid" />
      {NPCS.map((npc) => (
        <span
          className="mini-dot npc"
          key={npc.id}
          style={{ left: npc.x * scaleX, top: npc.y * scaleY, background: npc.color }}
        />
      ))}
      {peers.map((peer) => (
        <span
          className="mini-dot"
          key={peer.id}
          style={{ left: peer.x * scaleX, top: peer.y * scaleY, background: peer.color }}
        />
      ))}
      <span
        className="mini-dot self"
        style={{ left: position.x * scaleX, top: position.y * scaleY }}
      />
    </aside>
  );
}

function ChatPanel({ messages, draft, setDraft, sendMessage, peers, profile, panelOpen, setPanelOpen }) {
  const listRef = useRef(null);
  const people = [{ ...profile, status: "온라인" }, ...peers, ...NPCS];

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, panelOpen]);

  return (
    <aside className={panelOpen ? "side-panel open" : "side-panel"}>
      <div className="panel-tabs">
        <button type="button">채팅</button>
        <button type="button">참가자 ({peers.length + 1})</button>
        <button type="button" onClick={() => setPanelOpen(false)}>×</button>
      </div>
      <div className="messages" ref={listRef}>
        {messages.map((message) => (
          <div className={message.system ? "message system" : "message"} key={message.id}>
            {!message.system && (
              <div className="message-meta">
                <b style={{ color: message.color }}>{message.name}</b>
                <span>{timeLabel(message.at)}</span>
              </div>
            )}
            <span>{message.text}</span>
          </div>
        ))}
      </div>
      <div className="people-strip">
        {people.slice(0, 8).map((person) => (
          <span key={person.id || person.name} title={person.name} style={{ "--avatar-color": person.color }} />
        ))}
      </div>
      <form className="chat-form" onSubmit={sendMessage}>
        <input
          maxLength={160}
          placeholder="메시지 입력..."
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        <button type="submit">전송</button>
      </form>
    </aside>
  );
}

function App() {
  const [profile, setProfile] = useState(getProfile());
  const [roomId, setRoomId] = useState("main");
  const [position, setPosition] = useState(roomById("main").spawn);
  const [peers, setPeers] = useState([]);
  const [messages, setMessages] = useState([
    { id: "welcome", system: true, text: "재택타운에 입장했어요. 환영해요!", at: Date.now() },
  ]);
  const [draft, setDraft] = useState("");
  const [panelOpen, setPanelOpen] = useState(true);
  const channelRef = useRef(null);
  const room = useMemo(() => roomById(roomId), [roomId]);

  useEffect(() => {
    setPosition(room.spawn);
    setPeers([]);
    setMessages((prev) => [
      ...prev.slice(-80),
      { id: `${room.id}-${Date.now()}`, system: true, text: `${room.label}로 이동했습니다.`, at: Date.now() },
    ]);
  }, [room.id]);

  useEffect(() => {
    if (!profile || !supabase) return undefined;

    const channel = supabase.channel(`gathergarden:${room.id}`, {
      config: {
        broadcast: { self: false },
        presence: { key: profile.id },
      },
    });

    channelRef.current = channel;

    channel
      .on("presence", { event: "sync" }, () => {
        setPeers(presenceList(channel.presenceState(), profile.id));
      })
      .on("broadcast", { event: "chat" }, ({ payload }) => {
        setMessages((prev) => [...prev.slice(-80), payload]);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            ...profile,
            ...position,
            room: room.id,
            lastSeen: Date.now(),
          });
        }
      });

    return () => {
      channelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [profile?.id, room.id]);

  useEffect(() => {
    if (!profile || !channelRef.current) return;
    channelRef.current.track({
      ...profile,
      ...position,
      room: room.id,
      lastSeen: Date.now(),
    });
  }, [profile, position.x, position.y, room.id]);

  useEffect(() => {
    function onKeyDown(event) {
      if (event.target instanceof HTMLInputElement) return;
      const key = event.key.toLowerCase();
      const move = {
        arrowup: [0, -STEP],
        w: [0, -STEP],
        arrowdown: [0, STEP],
        s: [0, STEP],
        arrowleft: [-STEP, 0],
        a: [-STEP, 0],
        arrowright: [STEP, 0],
        d: [STEP, 0],
      }[key];

      if (!move) return;
      event.preventDefault();
      setPosition((current) => ({
        x: clamp(current.x + move[0], 28, WORLD.width - 28),
        y: clamp(current.y + move[1], 38, WORLD.height - 32),
      }));
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  if (!profile) {
    return <JoinScreen onJoin={setProfile} />;
  }

  function changeRoom(nextRoomId) {
    setRoomId(nextRoomId);
  }

  async function sendMessage(event) {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    const message = {
      id: crypto.randomUUID(),
      name: profile.name,
      color: profile.color,
      text,
      at: Date.now(),
    };

    setMessages((prev) => [...prev.slice(-80), message]);
    setDraft("");
    await channelRef.current?.send({ type: "broadcast", event: "chat", payload: message });
  }

  return (
    <main className="app-shell">
      <WorldMap profile={profile} room={room} position={position} peers={peers} />

      <header className="top-hud">
        <div>
          <b>{room.label}</b>
          <span>{peers.length + 1}명 접속 중</span>
        </div>
        <small>📍 {room.zone}</small>
      </header>

      <nav className="room-switcher" aria-label="방 이동">
        {ROOMS.map((item) => (
          <button
            className={item.id === room.id ? "active" : ""}
            key={item.id}
            onClick={() => changeRoom(item.id)}
            style={{ "--room-accent": item.accent }}
            type="button"
          >
            {item.label}
          </button>
        ))}
      </nav>

      <MiniMap position={position} peers={peers} />

      {!supabase && (
        <div className="config-banner">
          Supabase env가 아직 없습니다. Vercel에 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY를 넣으면 실시간 모드가 켜집니다.
        </div>
      )}

      <ChatPanel
        draft={draft}
        messages={messages}
        panelOpen={panelOpen}
        peers={peers}
        profile={profile}
        sendMessage={sendMessage}
        setDraft={setDraft}
        setPanelOpen={setPanelOpen}
      />

      <footer className="bottom-toolbar">
        <div className="my-card">
          <span className="mini-avatar" style={{ "--avatar-color": profile.color }} />
          <div>
            <b>{profile.name}</b>
            <span>{supabase ? "온라인" : "로컬 미리보기"}</span>
          </div>
        </div>
        <button type="button" title="마이크">🎙️<span>마이크</span></button>
        <button type="button" title="카메라">📷<span>카메라</span></button>
        <button type="button" title="리액션">👍<span>리액션</span></button>
        <button type="button" title="채팅" onClick={() => setPanelOpen(true)}>💬<span>채팅</span></button>
        <button type="button" title="도움말">⌨️<span>도움말</span></button>
      </footer>

      <div className="hint-toast">WASD / 방향키로 이동 · 방 버튼으로 공간 이동</div>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
