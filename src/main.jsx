import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { createClient } from "@supabase/supabase-js";
import "./styles.css";

const ROOMS = [
  { id: "main", label: "타운 광장", accent: "#58b368", spawn: { x: 470, y: 300 } },
  { id: "meeting-room", label: "회의실", accent: "#e8a33d", spawn: { x: 250, y: 220 } },
  { id: "focus-room", label: "집중방", accent: "#8d7ab0", spawn: { x: 650, y: 390 } },
];

const COLORS = ["#e2574c", "#58b368", "#e8a33d", "#7f9fe3", "#d46ac8", "#64c7c9"];
const WORLD = { width: 960, height: 620 };
const STEP = 18;

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
      <section className="join-panel">
        <div className="brand-mark">재택타운</div>
        <p>닉네임을 정하고 같은 방 사람들과 만나보세요.</p>
        <form onSubmit={submit}>
          <input
            autoFocus
            maxLength={16}
            placeholder="닉네임"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
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
      </section>
    </main>
  );
}

function Avatar({ player, self }) {
  return (
    <div className={self ? "avatar self" : "avatar"} style={{ left: player.x, top: player.y }}>
      <div className="avatar-body" style={{ background: player.color }}>
        <span />
      </div>
      <strong>{self ? "나" : player.name}</strong>
    </div>
  );
}

function WorldMap({ profile, room, position, peers }) {
  const roomAccent = room.accent;

  return (
    <section className="world-wrap">
      <div className="world" style={{ "--room-accent": roomAccent }}>
        <div className="grid" />
        <div className="area lounge">LOUNGE</div>
        <div className="area desks">DESKS</div>
        <div className="area focus">FOCUS</div>
        <div className="area meeting">MEETING</div>
        <div className="portal">PORTAL</div>
        {peers.map((peer) => <Avatar key={peer.id} player={peer} />)}
        <Avatar player={{ ...profile, ...position }} self />
      </div>
    </section>
  );
}

function ChatPanel({ messages, draft, setDraft, sendMessage, peers }) {
  const listRef = useRef(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  return (
    <aside className="side-panel">
      <div className="tabs">
        <span>채팅</span>
        <span>{peers.length + 1}명 접속</span>
      </div>
      <div className="messages" ref={listRef}>
        {messages.map((message) => (
          <div className={message.system ? "message system" : "message"} key={message.id}>
            {!message.system && <b style={{ color: message.color }}>{message.name}</b>}
            <span>{message.text}</span>
          </div>
        ))}
      </div>
      <form className="chat-form" onSubmit={sendMessage}>
        <input
          maxLength={160}
          placeholder="메시지 입력"
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
    { id: "welcome", system: true, text: "재택타운에 입장했습니다." },
  ]);
  const [draft, setDraft] = useState("");
  const channelRef = useRef(null);
  const room = useMemo(() => roomById(roomId), [roomId]);

  useEffect(() => {
    setPosition(room.spawn);
    setPeers([]);
    setMessages((prev) => [
      ...prev,
      { id: `${room.id}-${Date.now()}`, system: true, text: `${room.label}로 이동했습니다.` },
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
      {!supabase && (
        <div className="config-banner">
          Supabase env가 아직 없습니다. Vercel에 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY를 넣으면 실시간 모드가 켜집니다.
        </div>
      )}
      <header className="hud top">
        <div>
          <b>재택타운</b>
          <span>{room.label}</span>
        </div>
        <nav>
          {ROOMS.map((item) => (
            <button
              className={item.id === room.id ? "active" : ""}
              key={item.id}
              onClick={() => changeRoom(item.id)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </nav>
      </header>

      <WorldMap profile={profile} room={room} position={position} peers={peers} />

      <ChatPanel
        draft={draft}
        messages={messages}
        peers={peers}
        sendMessage={sendMessage}
        setDraft={setDraft}
      />

      <footer className="hud bottom">
        <div className="my-card">
          <span className="mini-avatar" style={{ background: profile.color }} />
          <div>
            <b>{profile.name}</b>
            <span>{supabase ? "Realtime online" : "Local preview"}</span>
          </div>
        </div>
        <div className="help">WASD / 방향키로 이동</div>
      </footer>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
