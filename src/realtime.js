import { createClient } from "@supabase/supabase-js";

const supabaseUrl = __TOWN_SUPABASE_URL__;
const supabaseAnonKey = __TOWN_SUPABASE_ANON_KEY__;
const client =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

function sessionId() {
  const stored = sessionStorage.getItem("town-session-id");
  if (stored) return stored;
  const next =
    (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2))
      .replace(/-/g, "")
      .slice(0, 12);
  sessionStorage.setItem("town-session-id", next);
  return next;
}

window.__townRT = {
  available: !!client,
  join(profile, handlers) {
    if (!client) return null;
    const id = sessionId();
    const ch = client.channel("wfh-town", {
      config: { presence: { key: id }, broadcast: { self: false } },
    });
    ch.on("presence", { event: "sync" }, () => handlers.onRoster(ch.presenceState()));
    ch.on("broadcast", { event: "move" }, ({ payload }) => handlers.onMove(payload));
    ch.on("broadcast", { event: "chat" }, ({ payload }) => handlers.onChat(payload));
    ch.on("broadcast", { event: "emote" }, ({ payload }) => handlers.onEmote(payload));
    ch.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await ch.track({
          id,
          name: profile.name,
          col: profile.col,
          style: profile.style,
          hair: profile.hair,
          x: profile.x,
          y: profile.y,
        });
      }
    });
    return {
      id,
      sendMove: (p) => ch.send({ type: "broadcast", event: "move", payload: p }),
      sendChat: (p) => ch.send({ type: "broadcast", event: "chat", payload: p }),
      sendEmote: (p) => ch.send({ type: "broadcast", event: "emote", payload: p }),
      updateProfile: (profile) =>
        ch.track({
          id,
          name: profile.name,
          col: profile.col,
          style: profile.style,
          hair: profile.hair,
          x: profile.x,
          y: profile.y,
        }),
    };
  },
  guestbook: {
    async list() {
      if (!client) return { ok: false, error: "no-client", rows: [] };
      const { data, error } = await client
        .from("guestbook")
        .select("id, created_at, name, col, message")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) return { ok: false, error: error.message, rows: [] };
      return { ok: true, rows: data || [] };
    },
    async add(name, col, message) {
      if (!client) return { ok: false, error: "no-client" };
      const { error } = await client
        .from("guestbook")
        .insert({ name, col, message });
      if (error) return { ok: false, error: error.message };
      return { ok: true };
    },
  },
};
