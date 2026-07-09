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
  auth: {
    async getUser() {
      if (!client) return null;
      const { data } = await client.auth.getSession();
      const u = data && data.session && data.session.user;
      if (!u) return null;
      return {
        id: u.id,
        email: u.email,
        googleName:
          (u.user_metadata && (u.user_metadata.full_name || u.user_metadata.name)) || "",
      };
    },
    onChange(cb) {
      if (!client) return;
      client.auth.onAuthStateChange((_event, session) => cb(session && session.user ? true : false));
    },
    signInGoogle() {
      if (!client) return;
      return client.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin + window.location.pathname },
      });
    },
    signOut() {
      if (!client) return Promise.resolve();
      return client.auth.signOut();
    },
    async getProfile(id) {
      if (!client) return null;
      const { data } = await client
        .from("profiles")
        .select("id, name")
        .eq("id", id)
        .maybeSingle();
      return data || null;
    },
    async saveProfile(id, name) {
      if (!client) return { ok: false, error: "no-client" };
      const { error } = await client.from("profiles").upsert({ id, name });
      if (error) return { ok: false, error: error.message };
      return { ok: true };
    },
  },
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
  seats: {
    async list() {
      if (!client) return { ok: false, error: "no-client", rows: [] };
      const { data, error } = await client.from("seats").select("seat_id, user_id");
      if (error) return { ok: false, error: error.message, rows: [] };
      const ids = (data || []).map((r) => r.user_id);
      const names = {};
      if (ids.length) {
        const { data: profs } = await client
          .from("profiles")
          .select("id, name")
          .in("id", ids);
        (profs || []).forEach((p) => { names[p.id] = p.name; });
      }
      return {
        ok: true,
        rows: (data || []).map((r) => ({
          seatId: r.seat_id,
          userId: r.user_id,
          name: names[r.user_id] || "주민",
        })),
      };
    },
    async claim(seatId) {
      if (!client) return { ok: false, error: "no-client" };
      const { data } = await client.auth.getSession();
      const u = data && data.session && data.session.user;
      if (!u) return { ok: false, error: "not-signed-in" };
      await client.from("seats").delete().eq("user_id", u.id);
      const { error } = await client.from("seats").insert({ seat_id: seatId, user_id: u.id });
      if (error) return { ok: false, error: error.message };
      return { ok: true };
    },
  },
  stamps: {
    async feed() {
      if (!client) return { ok: false, error: "no-client", rows: [] };
      const { data, error } = await client
        .from("stamps")
        .select("id, user_id, day, message, created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) return { ok: false, error: error.message, rows: [] };
      const ids = [...new Set((data || []).map((r) => r.user_id))];
      const names = {};
      if (ids.length) {
        const { data: profs } = await client.from("profiles").select("id, name").in("id", ids);
        (profs || []).forEach((p) => { names[p.id] = p.name; });
      }
      return { ok: true, rows: (data || []).map((r) => ({ ...r, name: names[r.user_id] || "주민" })) };
    },
    async mine() {
      if (!client) return { ok: false, error: "no-client", days: [] };
      const { data: s } = await client.auth.getSession();
      const u = s && s.session && s.session.user;
      if (!u) return { ok: false, error: "not-signed-in", days: [] };
      const { data, error } = await client
        .from("stamps")
        .select("day")
        .eq("user_id", u.id)
        .order("day", { ascending: false })
        .limit(400);
      if (error) return { ok: false, error: error.message, days: [] };
      return { ok: true, days: (data || []).map((r) => r.day) };
    },
    async add(message) {
      if (!client) return { ok: false, error: "no-client" };
      const { data: s } = await client.auth.getSession();
      const u = s && s.session && s.session.user;
      if (!u) return { ok: false, error: "not-signed-in" };
      const { error } = await client.from("stamps").insert({ user_id: u.id, message });
      if (error) return { ok: false, error: error.message, duplicate: error.code === "23505" };
      return { ok: true };
    },
    async counts() {
      if (!client) return { ok: false, error: "no-client", map: {} };
      const { data, error } = await client.from("stamps").select("user_id, day").limit(2000);
      if (error) return { ok: false, error: error.message, map: {} };
      const map = {};
      for (const r of data || []) {
        const m = map[r.user_id] || (map[r.user_id] = { count: 0, lastDay: null });
        m.count++;
        if (!m.lastDay || r.day > m.lastDay) m.lastDay = r.day;
      }
      return { ok: true, map };
    },
  },
  diary: {
    async list() {
      if (!client) return { ok: false, error: "no-client", rows: [] };
      const { data, error } = await client
        .from("diaries")
        .select("id, content, created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) return { ok: false, error: error.message, rows: [] };
      return { ok: true, rows: data || [] };
    },
    async add(content) {
      if (!client) return { ok: false, error: "no-client" };
      const { data } = await client.auth.getSession();
      const u = data && data.session && data.session.user;
      if (!u) return { ok: false, error: "not-signed-in" };
      const { error } = await client.from("diaries").insert({ user_id: u.id, content });
      if (error) return { ok: false, error: error.message };
      return { ok: true };
    },
  },
  work: {
    async get() {
      if (!client) return { ok: false, error: "no-client", row: null };
      const { data: s } = await client.auth.getSession();
      const u = s && s.session && s.session.user;
      if (!u) return { ok: false, error: "not-signed-in", row: null };
      const { data, error } = await client
        .from("work_status")
        .select("status, started_at, prev_status, prev_elapsed_ms, changed_at")
        .eq("user_id", u.id)
        .maybeSingle();
      if (error) return { ok: false, error: error.message, row: null };
      return { ok: true, row: data || null };
    },
    async save(row) {
      if (!client) return { ok: false, error: "no-client" };
      const { data: s } = await client.auth.getSession();
      const u = s && s.session && s.session.user;
      if (!u) return { ok: false, error: "not-signed-in" };
      const { error } = await client
        .from("work_status")
        .upsert({ user_id: u.id, ...row });
      if (error) return { ok: false, error: error.message };
      return { ok: true };
    },
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
