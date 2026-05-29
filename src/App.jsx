import { useState, useEffect, useCallback, useRef } from "react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// ─── Supabase ─────────────────────────────────────────────────────────────────

async function sbFetch(endpoint, options = {}, token = null) {
  const { headers: extraHeaders, ...restOptions } = options;
  const res = await fetch(`${SUPABASE_URL}${endpoint}`, {
    ...restOptions,
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token || SUPABASE_ANON_KEY}`,
      ...(extraHeaders || {}),
    },
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { data, error: res.ok ? null : data };
}

const auth = {
  signIn: (email, password) =>
    sbFetch("/auth/v1/token?grant_type=password", { method: "POST", body: JSON.stringify({ email, password }) }),
  signUp: (email, password, fullName) =>
    sbFetch("/auth/v1/signup", { method: "POST", body: JSON.stringify({ email, password, data: { full_name: fullName } }) }),
};

const db = {
  getProfile: (id, token) =>
    sbFetch(`/rest/v1/profiles?id=eq.${id}&select=*`, { method: "GET" }, token),
  getProfileByAuthId: (authId, token) =>
    sbFetch(`/rest/v1/profiles?auth_id=eq.${authId}&select=*`, { method: "GET" }, token),
  getProfileByInviteToken: (tok, token) =>
    sbFetch(`/rest/v1/profiles?invite_token=eq.${tok}&select=*`, { method: "GET" }, token),
  createManagedProfile: (fullName, memberType, createdBy, inviteEmail, token) =>
    sbFetch("/rest/v1/profiles", {
      method: "POST", headers: { Prefer: "return=representation" },
      body: JSON.stringify({ id: crypto.randomUUID(), full_name: fullName, profile_type: "managed", created_by: createdBy, invite_email: inviteEmail || null, invite_token: crypto.randomUUID() }),
    }, token),
  claimProfile: (profileId, authId, email, token) =>
    sbFetch(`/rest/v1/profiles?id=eq.${profileId}`, {
      method: "PATCH", headers: { Prefer: "return=representation" },
      body: JSON.stringify({ auth_id: authId, email, profile_type: "user" }),
    }, token),
  getMyCircles: (profileId, token) =>
    sbFetch(`/rest/v1/circle_members?user_id=eq.${profileId}&select=*,circle:circles(*)&order=joined_at.desc`, { method: "GET" }, token),
  getAllCircles: (token) =>
    sbFetch(`/rest/v1/circles?select=*&order=created_at.desc`, { method: "GET" }, token),
  createCircle: (name, description, userId, token) =>
    sbFetch("/rest/v1/circles", {
      method: "POST", headers: { Prefer: "return=representation" },
      body: JSON.stringify({ name, description, created_by: userId }),
    }, token),
  addMember: (circleId, profileId, role, status, memberType, token) =>
    sbFetch("/rest/v1/circle_members", {
      method: "POST", headers: { Prefer: "return=representation" },
      body: JSON.stringify({ circle_id: circleId, user_id: profileId, role, status, member_type: memberType }),
    }, token),
  getCircleMembers: (circleId, token) =>
    sbFetch(`/rest/v1/circle_members?circle_id=eq.${circleId}&select=*,profile:profiles(*)&order=joined_at.asc`, { method: "GET" }, token),
  updateMemberStatus: (id, status, token) =>
    sbFetch(`/rest/v1/circle_members?id=eq.${id}`, {
      method: "PATCH", headers: { Prefer: "return=representation" },
      body: JSON.stringify({ status }),
    }, token),
  updateMemberRole: (id, role, token) =>
    sbFetch(`/rest/v1/circle_members?id=eq.${id}`, {
      method: "PATCH", headers: { Prefer: "return=representation" },
      body: JSON.stringify({ role }),
    }, token),

  // ── Events ──
  getCircleEvents: (circleId, weekStart, weekEnd, token) =>
    sbFetch(
      `/rest/v1/events?circle_id=eq.${circleId}&start_time=lte.${weekEnd}&end_time=gte.${weekStart}&select=*,event_members(profile_id)&order=start_time.asc`,
      { method: "GET" }, token
    ),
  createEvent: (payload, token) =>
    sbFetch("/rest/v1/events", {
      method: "POST", headers: { Prefer: "return=representation" },
      body: JSON.stringify(payload),
    }, token),
  updateEvent: (id, payload, token) =>
    sbFetch(`/rest/v1/events?id=eq.${id}`, {
      method: "PATCH", headers: { Prefer: "return=representation" },
      body: JSON.stringify(payload),
    }, token),
  deleteEvent: (id, token) =>
    sbFetch(`/rest/v1/events?id=eq.${id}`, { method: "DELETE" }, token),
  setEventMembers: async (eventId, profileIds, token) => {
    await sbFetch(`/rest/v1/event_members?event_id=eq.${eventId}`, { method: "DELETE" }, token);
    if (!profileIds.length) return { error: null };
    return sbFetch("/rest/v1/event_members", {
      method: "POST", headers: { Prefer: "return=representation" },
      body: JSON.stringify(profileIds.map(pid => ({ event_id: eventId, profile_id: pid }))),
    }, token);
  },
};

// ─── Theme ────────────────────────────────────────────────────────────────────

const T = {
  teal: "#0D4F4F", tealDark: "#0A3D3D", tealMid: "#1A7070",
  tealLight: "#E8F4F4", tealFaint: "#F0F5F5", tealText: "#7DDDD0",
  tealMuted: "#5BBFB5", coral: "#FF6B4A", coralLight: "#FFF0EC",
  coralDark: "#CC4422", white: "#FFFFFF", ink: "#0A2E2E",
  inkMid: "#2E5555", border: "#D8EAEA", borderMid: "#B8D8D8",
  muted: "#7AAAA8", surface: "#FFFFFF",
};

// Member palette — 8 distinct colours for member columns
const MEMBER_PALETTE = [
  { bg: "#FFF0EC", text: "#A83200", border: "#FBBFAC" }, // coral
  { bg: "#E8F4F4", text: "#0A4040", border: "#9DD8D0" }, // teal
  { bg: "#EEF2FF", text: "#3730A3", border: "#C7D2FE" }, // indigo
  { bg: "#FEF9C3", text: "#854D0E", border: "#FDE68A" }, // amber
  { bg: "#F0FDF4", text: "#14532D", border: "#BBF7D0" }, // green
  { bg: "#FDF4FF", text: "#6B21A8", border: "#E9D5FF" }, // purple
  { bg: "#FFF1F2", text: "#9F1239", border: "#FECDD3" }, // rose
  { bg: "#F0F9FF", text: "#075985", border: "#BAE6FD" }, // sky
];

const memberColor = (idx) => MEMBER_PALETTE[idx % MEMBER_PALETTE.length];

// ─── Date helpers ─────────────────────────────────────────────────────────────

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function getMonday(d) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function isToday(d) { return isSameDay(d, new Date()); }

function weekRange(monday) {
  const sunday = addDays(monday, 6);
  sunday.setHours(23, 59, 59, 999);
  return { start: monday.toISOString(), end: sunday.toISOString() };
}

function fmtDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function fmtTime(d) {
  return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}

function fmtDateTime(d) { return `${fmtDate(d)}T${fmtTime(d)}`; }

function parseLocal(str) {
  if (!str) return null;
  const d = new Date(str);
  return isNaN(d) ? null : d;
}

function displayTime(isoStr) {
  const d = new Date(isoStr);
  let h = d.getHours(), m = d.getMinutes();
  const ampm = h >= 12 ? "pm" : "am";
  h = h % 12 || 12;
  return m === 0 ? `${h}${ampm}` : `${h}:${String(m).padStart(2,"0")}${ampm}`;
}

function eventOverlapsDay(event, day) {
  const dayStart = new Date(day); dayStart.setHours(0,0,0,0);
  const dayEnd   = new Date(day); dayEnd.setHours(23,59,59,999);
  const evStart  = new Date(event.start_time);
  const evEnd    = new Date(event.end_time);
  return evStart <= dayEnd && evEnd >= dayStart;
}

function eventStartsOnDay(event, day) {
  return isSameDay(new Date(event.start_time), day);
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', system-ui, sans-serif; background: ${T.tealFaint}; min-height: 100vh; color: ${T.ink}; -webkit-font-smoothing: antialiased; }

  .app { min-height: 100vh; display: flex; flex-direction: column; }

  /* ── Header ── */
  .header { background: ${T.teal}; position: sticky; top: 0; z-index: 100; }
  .header-top { display: flex; align-items: center; justify-content: space-between; padding: 0 28px; height: 56px; }
  .header-brand { font-size: 17px; font-weight: 600; letter-spacing: 0.06em; color: ${T.white}; text-transform: uppercase; }
  .header-right { display: flex; align-items: center; gap: 16px; }
  .header-avatar { width: 32px; height: 32px; border-radius: 50%; background: ${T.tealMid}; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 600; color: ${T.tealText}; letter-spacing: 0.04em; flex-shrink: 0; }
  .header-signout { font-size: 13px; color: ${T.tealMuted}; background: none; border: none; cursor: pointer; padding: 4px 0; transition: color 0.15s; }
  .header-signout:hover { color: ${T.white}; }

  /* ── Tab bar ── */
  .tab-bar { background: ${T.tealDark}; display: flex; padding: 0 28px; border-top: 1px solid rgba(255,255,255,0.06); }
  .tab { font-size: 13px; font-weight: 500; color: ${T.tealMuted}; padding: 10px 16px; border: none; background: none; cursor: pointer; border-bottom: 2px solid transparent; transition: color 0.15s, border-color 0.15s; white-space: nowrap; }
  .tab:hover { color: ${T.white}; }
  .tab.active { color: ${T.white}; border-bottom-color: ${T.coral}; }

  /* ── Circle hero ── */
  .circle-hero { background: ${T.teal}; padding: 20px 28px; border-bottom: 1px solid ${T.tealDark}; }
  .circle-hero-name { font-size: 20px; font-weight: 600; color: ${T.white}; margin-bottom: 4px; }
  .circle-hero-desc { font-size: 13px; color: ${T.tealMuted}; }
  .circle-hero-meta { font-size: 12px; color: ${T.tealMuted}; margin-top: 8px; }

  /* ── Content ── */
  .content { flex: 1; max-width: 720px; margin: 0 auto; padding: 28px 24px; width: 100%; }
  .content-full { flex: 1; padding: 0; overflow: hidden; display: flex; flex-direction: column; }

  /* ── Weekly view ── */
  .week-toolbar {
    background: ${T.white}; border-bottom: 1px solid ${T.border};
    display: flex; align-items: center; justify-content: space-between;
    padding: 12px 20px; flex-shrink: 0; gap: 12px; flex-wrap: wrap;
  }
  .week-nav { display: flex; align-items: center; gap: 8px; }
  .week-nav-btn {
    background: transparent; border: 1px solid ${T.border}; border-radius: 6px;
    width: 30px; height: 30px; cursor: pointer; display: flex; align-items: center;
    justify-content: center; color: ${T.muted}; transition: all 0.15s;
  }
  .week-nav-btn:hover { border-color: ${T.teal}; color: ${T.teal}; background: ${T.tealLight}; }
  .week-nav-btn svg { width: 14px; height: 14px; stroke: currentColor; stroke-width: 2; fill: none; stroke-linecap: round; stroke-linejoin: round; }
  .week-label { font-size: 14px; font-weight: 600; color: ${T.ink}; min-width: 160px; text-align: center; }
  .week-today-btn {
    background: transparent; border: 1px solid ${T.border}; border-radius: 6px;
    padding: 5px 12px; font-size: 12px; font-weight: 500; color: ${T.muted};
    cursor: pointer; transition: all 0.15s;
  }
  .week-today-btn:hover { border-color: ${T.teal}; color: ${T.teal}; }

  /* ── Grid ── */
  .week-grid-wrap { flex: 1; overflow: auto; }
  .week-grid {
    display: grid;
    min-width: 600px;
  }

  /* Day label row */
  .grid-day-label {
    background: ${T.white}; border-bottom: 1px solid ${T.border};
    border-right: 1px solid ${T.border}; padding: 8px 10px;
    position: sticky; top: 0; z-index: 10;
  }
  .grid-day-label:first-child { border-right: 1px solid ${T.border}; }
  .day-label-date { font-size: 18px; font-weight: 600; color: ${T.ink}; line-height: 1; }
  .day-label-name { font-size: 11px; font-weight: 500; color: ${T.muted}; text-transform: uppercase; letter-spacing: 0.06em; margin-top: 2px; }
  .day-label-date.today { color: ${T.coral}; }
  .day-label-name.today { color: ${T.coral}; }

  /* Member header row */
  .grid-member-header {
    background: ${T.tealFaint}; border-bottom: 1px solid ${T.border};
    border-right: 1px solid ${T.border}; padding: 8px 10px;
    position: sticky; top: 0; z-index: 10;
    display: flex; flex-direction: column; align-items: center; gap: 4px;
  }
  .member-avatar-grid {
    width: 28px; height: 28px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 10px; font-weight: 700; flex-shrink: 0;
  }
  .member-name-grid { font-size: 11px; font-weight: 600; text-align: center; line-height: 1.2; }

  /* Cells */
  .grid-cell {
    border-right: 1px solid ${T.border}; border-bottom: 1px solid ${T.border};
    padding: 6px; min-height: 80px; vertical-align: top;
    cursor: pointer; transition: background 0.1s; position: relative;
  }
  .grid-cell:hover { background: ${T.tealFaint}; }
  .grid-cell.is-today { background: rgba(255,107,74,0.03); }
  .grid-cell.is-today:hover { background: rgba(255,107,74,0.07); }

  /* Event chips */
  .event-chip {
    border-radius: 5px; padding: 4px 7px; margin-bottom: 4px;
    font-size: 11px; font-weight: 500; line-height: 1.3;
    cursor: pointer; transition: opacity 0.15s; border-width: 1px; border-style: solid;
    word-break: break-word;
  }
  .event-chip:hover { opacity: 0.8; }
  .event-chip-title { font-weight: 600; display: block; }
  .event-chip-time  { font-size: 10px; opacity: 0.8; margin-top: 1px; display: block; }
  .event-chip-cont  { font-size: 9px; opacity: 0.6; margin-top: 1px; display: block; font-style: italic; }

  .add-chip {
    border-radius: 5px; padding: 3px 6px;
    font-size: 10px; font-weight: 500; color: ${T.muted};
    border: 1px dashed ${T.border}; cursor: pointer;
    transition: all 0.15s; display: inline-block; margin-top: 2px;
  }
  .add-chip:hover { border-color: ${T.teal}; color: ${T.teal}; background: ${T.tealLight}; }

  /* ── List/Manage screens ── */
  .section-title { font-size: 13px; font-weight: 600; color: ${T.muted}; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 12px; margin-top: 24px; }
  .section-title:first-child { margin-top: 0; }

  .list-item { background: ${T.surface}; border: 1px solid ${T.border}; border-radius: 10px; padding: 14px 18px; display: flex; align-items: center; gap: 14px; margin-bottom: 8px; transition: border-color 0.15s; }
  .list-item:hover { border-color: ${T.borderMid}; }
  .list-item.clickable { cursor: pointer; }
  .list-item.clickable:hover { border-color: ${T.tealMid}; }

  .list-icon { width: 40px; height: 40px; border-radius: 9px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .list-icon svg { width: 18px; height: 18px; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; fill: none; }
  .list-icon.teal { background: ${T.teal}; } .list-icon.teal svg { stroke: ${T.tealText}; }
  .list-icon.light { background: ${T.tealLight}; } .list-icon.light svg { stroke: ${T.teal}; }
  .list-icon.managed { background: #F5F0FF; } .list-icon.managed svg { stroke: #7C3AED; }

  .list-body { flex: 1; min-width: 0; }
  .list-name { font-size: 14px; font-weight: 500; color: ${T.ink}; margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .list-sub  { font-size: 12px; color: ${T.muted}; }
  .list-right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; flex-wrap: wrap; justify-content: flex-end; }

  /* ── Badges ── */
  .badge { font-size: 11px; font-weight: 600; padding: 3px 9px; border-radius: 999px; letter-spacing: 0.03em; white-space: nowrap; }
  .badge-admin    { background: ${T.teal};       color: ${T.tealText}; }
  .badge-member   { background: ${T.tealLight};  color: ${T.teal}; }
  .badge-pending  { background: ${T.coralLight}; color: ${T.coralDark}; }
  .badge-rejected { background: #FEF2F2;          color: #991B1B; }
  .badge-managed  { background: #F5F0FF;          color: #6D28D9; border: 1px solid #DDD6FE; }
  .badge-family   { background: ${T.tealLight};  color: ${T.teal}; }
  .badge-friend   { background: #FFF7ED;          color: #92400E; }

  /* ── Buttons ── */
  .btn-primary { background: ${T.coral}; color: ${T.white}; border: none; border-radius: 8px; padding: 9px 20px; font-family: inherit; font-size: 13px; font-weight: 600; cursor: pointer; transition: background 0.15s, transform 0.1s; white-space: nowrap; }
  .btn-primary:hover:not(:disabled) { background: ${T.coralDark}; }
  .btn-primary:active:not(:disabled) { transform: scale(0.98); }
  .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

  .btn-secondary { background: transparent; color: ${T.teal}; border: 1px solid ${T.border}; border-radius: 8px; padding: 8px 16px; font-family: inherit; font-size: 13px; font-weight: 500; cursor: pointer; transition: all 0.15s; }
  .btn-secondary:hover { border-color: ${T.teal}; background: ${T.tealLight}; }
  .btn-secondary:disabled { opacity: 0.5; cursor: not-allowed; }

  .btn-ghost { background: transparent; border: none; color: ${T.muted}; font-family: inherit; font-size: 12px; font-weight: 500; cursor: pointer; padding: 6px 10px; border-radius: 6px; transition: all 0.15s; }
  .btn-ghost:hover:not(:disabled) { background: ${T.tealLight}; color: ${T.teal}; }
  .btn-ghost:disabled { opacity: 0.4; cursor: not-allowed; }

  .btn-approve { background: ${T.teal}; color: ${T.white}; border: none; border-radius: 7px; padding: 6px 14px; font-family: inherit; font-size: 12px; font-weight: 600; cursor: pointer; transition: background 0.15s; }
  .btn-approve:hover:not(:disabled) { background: ${T.tealMid}; }
  .btn-approve:disabled { opacity: 0.5; cursor: not-allowed; }

  .btn-reject { background: transparent; color: ${T.coralDark}; border: 1px solid #FECACA; border-radius: 7px; padding: 6px 14px; font-family: inherit; font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.15s; }
  .btn-reject:hover:not(:disabled) { background: ${T.coralLight}; }
  .btn-reject:disabled { opacity: 0.5; cursor: not-allowed; }

  .btn-invite { background: transparent; color: #7C3AED; border: 1px solid #DDD6FE; border-radius: 7px; padding: 6px 12px; font-family: inherit; font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.15s; white-space: nowrap; }
  .btn-invite:hover { background: #F5F0FF; }
  .btn-invite.copied { border-color: #6BCB77; color: #276749; background: #f0fff4; }

  .btn-danger { background: transparent; color: #991B1B; border: 1px solid #FECACA; border-radius: 8px; padding: 8px 16px; font-family: inherit; font-size: 13px; font-weight: 500; cursor: pointer; transition: all 0.15s; }
  .btn-danger:hover { background: #FEF2F2; }

  /* ── Forms ── */
  .field { margin-bottom: 16px; }
  .field-label { display: block; font-size: 12px; font-weight: 600; color: ${T.inkMid}; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 6px; }
  .field-input { width: 100%; border: 1px solid ${T.border}; border-radius: 8px; padding: 9px 12px; font-family: inherit; font-size: 14px; color: ${T.ink}; background: ${T.white}; outline: none; transition: border-color 0.15s, box-shadow 0.15s; }
  .field-input:focus { border-color: ${T.teal}; box-shadow: 0 0 0 3px rgba(13,79,79,0.12); }
  textarea.field-input { resize: vertical; min-height: 72px; }
  .field-hint { font-size: 12px; color: ${T.muted}; margin-top: 5px; }

  .type-row { display: flex; gap: 8px; }
  .type-btn { flex: 1; border: 1px solid ${T.border}; border-radius: 8px; padding: 8px 12px; font-family: inherit; font-size: 13px; font-weight: 500; cursor: pointer; background: ${T.white}; color: ${T.muted}; transition: all 0.15s; text-align: center; }
  .type-btn:hover { border-color: ${T.tealMid}; color: ${T.teal}; }
  .type-btn.selected { border-color: ${T.teal}; background: ${T.tealLight}; color: ${T.teal}; }

  /* Member checkbox grid */
  .member-checks { display: flex; flex-direction: column; gap: 6px; }
  .member-check-row { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 8px; border: 1px solid ${T.border}; cursor: pointer; transition: all 0.15s; }
  .member-check-row:hover { border-color: ${T.borderMid}; background: ${T.tealFaint}; }
  .member-check-row.checked { border-color: ${T.teal}; background: ${T.tealLight}; }
  .member-check-row input { accent-color: ${T.teal}; width: 15px; height: 15px; cursor: pointer; }
  .member-check-avatar { width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 9px; font-weight: 700; flex-shrink: 0; }
  .member-check-name { font-size: 13px; font-weight: 500; color: ${T.ink}; }

  /* ── Msgs ── */
  .msg { padding: 10px 14px; border-radius: 8px; font-size: 13px; font-weight: 500; margin-top: 12px; line-height: 1.5; }
  .msg.error   { background: ${T.coralLight}; color: ${T.coralDark}; }
  .msg.success { background: ${T.tealLight};  color: ${T.teal}; }

  /* ── Auth ── */
  .auth-wrap { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: ${T.tealFaint}; padding: 24px; }
  .auth-card { background: ${T.white}; border: 1px solid ${T.border}; border-radius: 14px; padding: 36px 32px; width: 100%; max-width: 400px; }
  .auth-logo-wrap { margin-bottom: 28px; }
  .auth-logo { font-size: 20px; font-weight: 700; color: ${T.teal}; letter-spacing: 0.08em; text-transform: uppercase; display: block; margin-bottom: 6px; }
  .auth-tagline { font-size: 13px; color: ${T.muted}; }
  .auth-tabs { display: flex; margin-bottom: 24px; border-bottom: 1px solid ${T.border}; }
  .auth-tab { flex: 1; padding: 10px; font-family: inherit; font-size: 13px; font-weight: 500; color: ${T.muted}; background: none; border: none; border-bottom: 2px solid transparent; margin-bottom: -1px; cursor: pointer; transition: color 0.15s, border-color 0.15s; }
  .auth-tab.active { color: ${T.teal}; border-bottom-color: ${T.coral}; }

  /* ── Empty ── */
  .empty { text-align: center; padding: 48px 24px; color: ${T.muted}; font-size: 14px; font-weight: 500; }
  .empty-icon { width: 48px; height: 48px; border-radius: 12px; background: ${T.tealLight}; margin: 0 auto 14px; display: flex; align-items: center; justify-content: center; }
  .empty-icon svg { width: 22px; height: 22px; stroke: ${T.teal}; stroke-width: 1.8; fill: none; }

  /* ── Modal ── */
  .modal-backdrop { position: fixed; inset: 0; background: rgba(10,46,46,0.5); z-index: 200; display: flex; align-items: center; justify-content: center; padding: 24px; overflow-y: auto; }
  .modal { background: ${T.white}; border-radius: 14px; padding: 28px; width: 100%; max-width: 480px; box-shadow: 0 20px 48px rgba(10,46,46,0.2); animation: modalIn 0.2s ease; position: relative; }
  @keyframes modalIn { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
  .modal-title { font-size: 16px; font-weight: 600; color: ${T.ink}; margin-bottom: 4px; }
  .modal-sub   { font-size: 13px; color: ${T.muted}; margin-bottom: 20px; line-height: 1.5; }
  .modal-footer { display: flex; gap: 10px; margin-top: 20px; align-items: center; }

  /* ── Invite box ── */
  .invite-box { background: ${T.tealFaint}; border: 1px solid ${T.border}; border-radius: 8px; padding: 10px 12px; font-size: 12px; color: ${T.inkMid}; word-break: break-all; line-height: 1.5; margin-bottom: 10px; font-family: monospace; }

  /* ── Claim ── */
  .claim-header { background: ${T.teal}; padding: 32px 28px 28px; border-radius: 14px 14px 0 0; }
  .claim-title  { font-size: 20px; font-weight: 600; color: ${T.white}; margin-bottom: 6px; }
  .claim-sub    { font-size: 13px; color: ${T.tealMuted}; line-height: 1.5; }
  .claim-body   { padding: 24px 28px; }

  /* ── Misc ── */
  .page-header { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; margin-bottom: 20px; }
  .page-title  { font-size: 16px; font-weight: 600; color: ${T.ink}; }
  .divider { border: none; border-top: 1px solid ${T.border}; margin: 16px 0; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .spinner { width: 18px; height: 18px; border: 2px solid ${T.border}; border-top-color: ${T.teal}; border-radius: 50%; animation: spin 0.7s linear infinite; margin: 40px auto; }
  @keyframes fadeUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
  .fade-up { animation: fadeUp 0.25s ease both; }
  .search-wrap { position: relative; margin-bottom: 16px; }
  .search-icon { position: absolute; left: 11px; top: 50%; transform: translateY(-50%); pointer-events: none; }
  .search-icon svg { width: 15px; height: 15px; stroke: ${T.muted}; stroke-width: 2; fill: none; }
  .search-input { width: 100%; border: 1px solid ${T.border}; border-radius: 8px; padding: 9px 12px 9px 34px; font-family: inherit; font-size: 14px; color: ${T.ink}; background: ${T.white}; outline: none; transition: border-color 0.15s; }
  .search-input:focus { border-color: ${T.teal}; box-shadow: 0 0 0 3px rgba(13,79,79,0.12); }

  @media (max-width: 520px) {
    .header-top { padding: 0 16px; }
    .tab-bar { padding: 0 16px; }
    .content { padding: 20px 16px; }
    .circle-hero { padding: 16px; }
    .week-toolbar { padding: 10px 14px; }
    .modal { padding: 20px; }
  }
`;

// ─── Icons ────────────────────────────────────────────────────────────────────

const Ic = {
  users:       <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  user:        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>,
  plus:        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  search:      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  chevronL:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>,
  chevronR:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>,
  arrowLeft:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>,
  calendar:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  link:        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>,
  copy:        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>,
  check:       <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  trash:       <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>,
  x:           <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  circle:      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/></svg>,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const initials = (name) => {
  if (!name) return "?";
  const p = name.trim().split(" ");
  return p.length >= 2 ? (p[0][0] + p[p.length-1][0]).toUpperCase() : name.slice(0,2).toUpperCase();
};

function Spinner() { return <div className="spinner" />; }
function Msg({ msg }) { return msg ? <div className={`msg ${msg.type}`}>{msg.text}</div> : null; }
function EmptyState({ icon, text }) {
  return <div className="empty fade-up"><div className="empty-icon">{icon}</div>{text}</div>;
}

// ─── App shell ────────────────────────────────────────────────────────────────

function AppShell({ user, onSignOut, tabs, activeTab, onTabChange, children, fullWidth }) {
  const name = user?.profile?.full_name || user?.email?.split("@")[0] || "?";
  return (
    <div className="app">
      <header className="header">
        <div className="header-top">
          <span className="header-brand">Circles</span>
          <div className="header-right">
            <div className="header-avatar">{initials(name)}</div>
            {onSignOut && <button className="header-signout" onClick={onSignOut}>Sign out</button>}
          </div>
        </div>
        {tabs && (
          <div className="tab-bar">
            {tabs.map(t => (
              <button key={t.id} className={`tab ${activeTab===t.id?"active":""}`} onClick={() => onTabChange(t.id)}>{t.label}</button>
            ))}
          </div>
        )}
      </header>
      {fullWidth ? children : <div className="content">{children}</div>}
    </div>
  );
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

function AuthPage({ onLogin }) {
  const [mode, setMode]     = useState("signin");
  const [email, setEmail]   = useState("");
  const [pw, setPw]         = useState("");
  const [name, setName]     = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg]       = useState(null);

  const handle = async () => {
    if (!email || !pw) { setMsg({ type:"error", text:"Please fill in all fields." }); return; }
    setLoading(true); setMsg(null);
    if (mode === "signin") {
      const { data, error } = await auth.signIn(email, pw);
      if (error) { setMsg({ type:"error", text: error.error_description || error.message || "Sign in failed." }); }
      else {
        const token = data.access_token;
        let profile = null;
        const { data: byAuth } = await db.getProfileByAuthId(data.user.id, token);
        if (byAuth?.[0]) { profile = byAuth[0]; }
        else {
          const { data: byId } = await db.getProfile(data.user.id, token);
          profile = byId?.[0] || null;
          if (profile) await sbFetch(`/rest/v1/profiles?id=eq.${profile.id}`, { method:"PATCH", headers:{Prefer:"return=representation"}, body: JSON.stringify({ auth_id: data.user.id }) }, token);
        }
        if (!profile) { setMsg({ type:"error", text:"Could not load profile." }); setLoading(false); return; }
        onLogin({ ...data.user, profile, token });
      }
    } else {
      if (!name) { setMsg({ type:"error", text:"Please enter your name." }); setLoading(false); return; }
      const { error } = await auth.signUp(email, pw, name);
      if (error) { setMsg({ type:"error", text: error.error_description || error.message || "Sign up failed." }); }
      else { setMsg({ type:"success", text:"Account created. Check your email to confirm, then sign in." }); setMode("signin"); }
    }
    setLoading(false);
  };

  return (
    <div className="auth-wrap">
      <div className="auth-card fade-up">
        <div className="auth-logo-wrap">
          <span className="auth-logo">Circles</span>
          <span className="auth-tagline">Your people, your places.</span>
        </div>
        <div className="auth-tabs">
          <button className={`auth-tab ${mode==="signin"?"active":""}`} onClick={() => { setMode("signin"); setMsg(null); }}>Sign in</button>
          <button className={`auth-tab ${mode==="signup"?"active":""}`} onClick={() => { setMode("signup"); setMsg(null); }}>Create account</button>
        </div>
        {mode==="signup" && <div className="field"><label className="field-label">Full name</label><input className="field-input" type="text" placeholder="Your name" value={name} onChange={e=>setName(e.target.value)} /></div>}
        <div className="field"><label className="field-label">Email</label><input className="field-input" type="email" placeholder="you@example.com" value={email} onChange={e=>setEmail(e.target.value)} /></div>
        <div className="field"><label className="field-label">Password</label><input className="field-input" type="password" placeholder="••••••••" value={pw} onChange={e=>setPw(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handle()} /></div>
        <button className="btn-primary" style={{width:"100%",marginTop:4}} onClick={handle} disabled={loading}>{loading?"Just a moment…":mode==="signin"?"Sign in":"Create account"}</button>
        <Msg msg={msg} />
      </div>
    </div>
  );
}

// ─── Claim profile ────────────────────────────────────────────────────────────

function ClaimProfileScreen({ inviteToken, onClaimed }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode]       = useState("signup");
  const [name, setName]       = useState("");
  const [email, setEmail]     = useState("");
  const [pw, setPw]           = useState("");
  const [submitting, setSub]  = useState(false);
  const [msg, setMsg]         = useState(null);

  useEffect(() => {
    (async () => {
      const { data } = await db.getProfileByInviteToken(inviteToken, null);
      if (data?.length) { setProfile(data[0]); setName(data[0].full_name||""); setEmail(data[0].invite_email||""); }
      else setMsg({ type:"error", text:"This invite link is invalid or has already been used." });
      setLoading(false);
    })();
  }, [inviteToken]);

  const handle = async () => {
    if (!email||!pw) { setMsg({ type:"error", text:"Please fill in all fields." }); return; }
    setSub(true); setMsg(null);
    const claim = async (userId, token) => {
      await db.claimProfile(profile.id, userId, email, token);
      const { data: profiles } = await db.getProfileByAuthId(userId, token);
      onClaimed({ auth_id: userId, profile: profiles?.[0]||{}, token });
    };
    if (mode==="signup") {
      const { error: sErr } = await auth.signUp(email, pw, name||profile.full_name);
      if (sErr) { setMsg({ type:"error", text:sErr.error_description||"Sign up failed." }); setSub(false); return; }
      const { data: sIn, error: siErr } = await auth.signIn(email, pw);
      if (siErr) { setMsg({ type:"success", text:"Account created. Confirm your email then sign in." }); setSub(false); return; }
      await claim(sIn.user.id, sIn.access_token);
    } else {
      const { data: sIn, error: siErr } = await auth.signIn(email, pw);
      if (siErr) { setMsg({ type:"error", text:siErr.error_description||"Sign in failed." }); setSub(false); return; }
      await claim(sIn.user.id, sIn.access_token);
    }
  };

  if (loading) return <div className="auth-wrap"><Spinner /></div>;
  if (!profile) return <div className="auth-wrap"><div className="auth-card fade-up"><span className="auth-logo">Circles</span><Msg msg={msg}/></div></div>;

  return (
    <div className="auth-wrap">
      <div className="auth-card fade-up" style={{padding:0,overflow:"hidden"}}>
        <div className="claim-header">
          <div className="claim-title">You've been invited</div>
          <div className="claim-sub">A profile for <strong style={{color:T.white}}>{profile.full_name}</strong> is waiting. Create an account or sign in to claim it.</div>
        </div>
        <div className="claim-body">
          <div className="auth-tabs">
            <button className={`auth-tab ${mode==="signup"?"active":""}`} onClick={()=>{setMode("signup");setMsg(null);}}>Create account</button>
            <button className={`auth-tab ${mode==="signin"?"active":""}`} onClick={()=>{setMode("signin");setMsg(null);}}>I have an account</button>
          </div>
          {mode==="signup"&&<div className="field"><label className="field-label">Full name</label><input className="field-input" type="text" value={name} onChange={e=>setName(e.target.value)}/></div>}
          <div className="field"><label className="field-label">Email</label><input className="field-input" type="email" value={email} onChange={e=>setEmail(e.target.value)}/></div>
          <div className="field"><label className="field-label">Password</label><input className="field-input" type="password" placeholder="••••••••" value={pw} onChange={e=>setPw(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handle()}/></div>
          <button className="btn-primary" style={{width:"100%"}} onClick={handle} disabled={submitting}>{submitting?"Just a moment…":mode==="signup"?"Claim my profile":"Sign in and claim"}</button>
          <Msg msg={msg}/>
        </div>
      </div>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

function Dashboard({ user, onSignOut, onEnterCircle, onCreateCircle }) {
  const [tab, setTab]             = useState("circles");
  const [memberships, setMemberships] = useState([]);
  const [allCircles, setAllCircles] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState("");
  const [memberType, setMemberType] = useState("friend");
  const [joining, setJoining]     = useState(null);
  const [joinMsg, setJoinMsg]     = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data:m },{ data:c }] = await Promise.all([
      db.getMyCircles(user.profile.id, user.token),
      db.getAllCircles(user.token),
    ]);
    setMemberships(Array.isArray(m)?m:[]);
    setAllCircles(Array.isArray(c)?c:[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const myIds = memberships.map(m=>m.circle_id);
  const filtered = allCircles.filter(c=>!myIds.includes(c.id)&&c.name.toLowerCase().includes(search.toLowerCase()));

  const requestJoin = async (circle) => {
    setJoining(circle.id); setJoinMsg(null);
    const { error } = await db.addMember(circle.id, user.profile.id, "member", "pending", memberType, user.token);
    if (error) setJoinMsg({ type:"error", text:"Could not send request." });
    else { setJoinMsg({ type:"success", text:`Request sent to join "${circle.name}".` }); setMemberships(prev=>[...prev,{circle_id:circle.id,status:"pending"}]); }
    setJoining(null);
  };

  const statusBadge = (m) => {
    if (m.status==="pending")  return <span className="badge badge-pending">Pending</span>;
    if (m.status==="rejected") return <span className="badge badge-rejected">Rejected</span>;
    if (m.role==="admin")      return <span className="badge badge-admin">Admin</span>;
    return                            <span className="badge badge-member">Member</span>;
  };

  return (
    <AppShell user={user} onSignOut={onSignOut} tabs={[{id:"circles",label:"My circles"},{id:"discover",label:"Discover"}]} activeTab={tab} onTabChange={t=>{setTab(t);setJoinMsg(null);}}>
      {tab==="circles"&&(
        <>
          <div className="page-header"><div className="page-title">Your circles</div><button className="btn-primary" onClick={onCreateCircle}>New circle</button></div>
          {loading?<Spinner/>:memberships.length===0?<EmptyState icon={Ic.circle} text="You're not in any circles yet."/>:(
            <div className="fade-up">
              {memberships.map(m=>(
                <div key={m.id} className={`list-item ${m.status==="approved"?"clickable":""}`} onClick={()=>m.status==="approved"&&onEnterCircle(m.circle,m)}>
                  <div className={`list-icon ${m.role==="admin"?"teal":"light"}`}>{Ic.users}</div>
                  <div className="list-body"><div className="list-name">{m.circle?.name||"Unnamed"}</div><div className="list-sub">{m.circle?.description||"No description"}</div></div>
                  <div className="list-right">{statusBadge(m)}</div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
      {tab==="discover"&&(
        <>
          <div className="page-header"><div className="page-title">Find a circle</div></div>
          <div className="field" style={{marginBottom:12}}>
            <label className="field-label">Joining as</label>
            <div className="type-row">
              <button className={`type-btn ${memberType==="family"?"selected":""}`} onClick={()=>setMemberType("family")}>Family</button>
              <button className={`type-btn ${memberType==="friend"?"selected":""}`} onClick={()=>setMemberType("friend")}>Friend</button>
            </div>
          </div>
          <div className="search-wrap"><div className="search-icon">{Ic.search}</div><input className="search-input" placeholder="Search…" value={search} onChange={e=>setSearch(e.target.value)}/></div>
          <Msg msg={joinMsg}/>
          {loading?<Spinner/>:filtered.length===0?<EmptyState icon={Ic.search} text="No circles found."/>:(
            <div className="fade-up">
              {filtered.map(c=>(
                <div key={c.id} className="list-item">
                  <div className="list-icon light">{Ic.users}</div>
                  <div className="list-body"><div className="list-name">{c.name}</div><div className="list-sub">{c.description||"No description"}</div></div>
                  <div className="list-right"><button className="btn-primary" style={{padding:"6px 14px",fontSize:12}} disabled={joining===c.id} onClick={()=>requestJoin(c)}>{joining===c.id?"Sending…":"Request"}</button></div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </AppShell>
  );
}

// ─── Create Circle ────────────────────────────────────────────────────────────

function CreateCircle({ user, onBack, onCreated }) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg]   = useState(null);

  const handle = async () => {
    if (!name.trim()) { setMsg({ type:"error", text:"Please give your circle a name." }); return; }
    if (!user?.profile?.id) { setMsg({ type:"error", text:"Session error — please sign out and back in." }); return; }
    setLoading(true); setMsg(null);
    const { data:circles, error } = await db.createCircle(name.trim(), desc.trim(), user.profile.id, user.token);
    if (error||!circles?.length) { setMsg({ type:"error", text:`Could not create circle: ${error?.message||JSON.stringify(error)}` }); setLoading(false); return; }
    const circle = circles[0];
    const { error:mErr } = await db.addMember(circle.id, user.profile.id, "admin", "approved", "family", user.token);
    if (mErr) { setMsg({ type:"error", text:`Circle created but could not add you as admin.` }); setLoading(false); return; }
    onCreated(circle);
  };

  return (
    <AppShell user={user} onSignOut={null}>
      <button className="btn-ghost" style={{marginBottom:16,display:"flex",alignItems:"center",gap:6}} onClick={onBack}><span style={{display:"flex"}}>{Ic.arrowLeft}</span> My circles</button>
      <div className="page-header"><div className="page-title">Create a circle</div></div>
      <div style={{maxWidth:480}}>
        <div className="field"><label className="field-label">Circle name</label><input className="field-input" type="text" placeholder="e.g. The Brewis Family" value={name} onChange={e=>setName(e.target.value)} autoFocus/></div>
        <div className="field"><label className="field-label">Description <span style={{textTransform:"none",fontWeight:400,color:T.muted}}>(optional)</span></label><textarea className="field-input" placeholder="What is this circle about?" value={desc} onChange={e=>setDesc(e.target.value)}/></div>
        <div style={{fontSize:12,color:T.muted,marginBottom:20,lineHeight:1.5}}>You will be set as admin. Add members and approve requests from the circle page.</div>
        <button className="btn-primary" onClick={handle} disabled={loading}>{loading?"Creating…":"Create circle"}</button>
        <Msg msg={msg}/>
      </div>
    </AppShell>
  );
}

// ─── Weekly View ──────────────────────────────────────────────────────────────

function WeeklyView({ user, circle, approvedMembers, events, onEventClick, onCellClick }) {
  const [weekOffset, setWeekOffset] = useState(0);
  const monday = getMonday(addDays(new Date(), weekOffset * 7));
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));

  const weekStart = monday;
  const weekEnd   = addDays(monday, 6);
  weekEnd.setHours(23,59,59,999);

  // Mon name + year in header
  const monthsSpanned = weekStart.getMonth() !== weekEnd.getMonth()
    ? `${MONTH_LABELS[weekStart.getMonth()]} – ${MONTH_LABELS[weekEnd.getMonth()]} ${weekEnd.getFullYear()}`
    : `${MONTH_LABELS[weekStart.getMonth()]} ${weekStart.getFullYear()}`;

  // Filter events to this week
  const weekEvents = events.filter(ev => {
    const evStart = new Date(ev.start_time);
    const evEnd   = new Date(ev.end_time);
    return evStart <= weekEnd && evEnd >= weekStart;
  });

  // Total columns: 1 day-label col + N member cols
  const cols = approvedMembers.length;
  const gridCols = `80px repeat(${cols}, minmax(90px, 1fr))`;

  return (
    <div style={{display:"flex",flexDirection:"column",flex:1,overflow:"hidden"}}>
      {/* Toolbar */}
      <div className="week-toolbar">
        <div className="week-nav">
          <button className="week-nav-btn" onClick={()=>setWeekOffset(o=>o-1)} aria-label="Previous week">{Ic.chevronL}</button>
          <span className="week-label">{monthsSpanned}</span>
          <button className="week-nav-btn" onClick={()=>setWeekOffset(o=>o+1)} aria-label="Next week">{Ic.chevronR}</button>
        </div>
        <button className="week-today-btn" onClick={()=>setWeekOffset(0)}>Today</button>
      </div>

      {/* Grid */}
      <div className="week-grid-wrap">
        <div className="week-grid" style={{gridTemplateColumns:gridCols}}>

          {/* Row 1: top-left corner + member headers */}
          <div className="grid-day-label" style={{background:T.tealFaint,borderBottom:`1px solid ${T.border}`,borderRight:`1px solid ${T.border}`}} />
          {approvedMembers.map((m, mi) => {
            const pal = memberColor(mi);
            return (
              <div key={m.id} className="grid-member-header" style={{background:pal.bg,borderColor:T.border}}>
                <div className="member-avatar-grid" style={{background:pal.border,color:pal.text}}>{initials(m.profile?.full_name||"?")}</div>
                <div className="member-name-grid" style={{color:pal.text}}>{(m.profile?.full_name||"Unknown").split(" ")[0]}</div>
              </div>
            );
          })}

          {/* Rows 2–8: one per day */}
          {days.map((day, di) => {
            const todayDay = isToday(day);
            return [
              // Day label cell
              <div key={`label-${di}`} className="grid-day-label" style={todayDay?{background:T.coralLight}:{}}>
                <div className={`day-label-date ${todayDay?"today":""}`}>{day.getDate()}</div>
                <div className={`day-label-name ${todayDay?"today":""}`}>{DAY_LABELS[di]}</div>
              </div>,
              // Member cells
              ...approvedMembers.map((m, mi) => {
                const pal = memberColor(mi);
                // Events for this member on this day
                const cellEvents = weekEvents.filter(ev => {
                  const memberIds = ev.event_members?.map(em=>em.profile_id)||[];
                  return memberIds.includes(m.profile.id) && eventOverlapsDay(ev, day);
                });
                return (
                  <div
                    key={`cell-${di}-${mi}`}
                    className={`grid-cell ${todayDay?"is-today":""}`}
                    onClick={() => onCellClick({ day, member: m, memberIndex: mi })}
                  >
                    {cellEvents.map(ev => {
                      const isStart = eventStartsOnDay(ev, day);
                      const isMultiDay = !isSameDay(new Date(ev.start_time), new Date(ev.end_time));
                      return (
                        <div
                          key={ev.id}
                          className="event-chip"
                          style={{background:pal.bg, color:pal.text, borderColor:pal.border}}
                          onClick={e => { e.stopPropagation(); onEventClick(ev); }}
                        >
                          <span className="event-chip-title">{ev.title}</span>
                          {isStart && !ev.all_day && <span className="event-chip-time">{displayTime(ev.start_time)}</span>}
                          {!isStart && isMultiDay && <span className="event-chip-cont">cont'd</span>}
                        </div>
                      );
                    })}
                  </div>
                );
              })
            ];
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Event Modal ──────────────────────────────────────────────────────────────

function EventModal({ user, circle, members, event, defaultDay, defaultMemberIds, onClose, onSaved, onDeleted }) {
  const isNew = !event;

  const defaultStart = defaultDay ? new Date(defaultDay) : new Date();
  defaultStart.setHours(9,0,0,0);
  const defaultEnd = new Date(defaultStart); defaultEnd.setHours(10,0,0,0);

  const [title, setTitle]       = useState(event?.title || "");
  const [desc, setDesc]         = useState(event?.description || "");
  const [allDay, setAllDay]     = useState(event?.all_day ?? false);
  const [startStr, setStartStr] = useState(event ? fmtDateTime(new Date(event.start_time)) : fmtDateTime(defaultStart));
  const [endStr, setEndStr]     = useState(event ? fmtDateTime(new Date(event.end_time))   : fmtDateTime(defaultEnd));
  const [selMembers, setSelMembers] = useState(() => {
    if (event) return (event.event_members||[]).map(em=>em.profile_id);
    return defaultMemberIds || [];
  });
  const [saving, setSaving]     = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [msg, setMsg]           = useState(null);

  const toggleMember = (id) => setSelMembers(prev => prev.includes(id) ? prev.filter(x=>x!==id) : [...prev,id]);

  const save = async () => {
    if (!title.trim()) { setMsg({ type:"error", text:"Please enter a title." }); return; }
    const startDt = parseLocal(startStr);
    const endDt   = parseLocal(endStr);
    if (!startDt||!endDt) { setMsg({ type:"error", text:"Please set valid start and end times." }); return; }
    if (endDt<=startDt && !allDay) { setMsg({ type:"error", text:"End time must be after start time." }); return; }
    setSaving(true); setMsg(null);

    const payload = {
      circle_id: circle.id,
      created_by: user.profile.id,
      title: title.trim(),
      description: desc.trim() || null,
      all_day: allDay,
      start_time: allDay ? new Date(fmtDate(startDt)+"T00:00:00").toISOString() : startDt.toISOString(),
      end_time:   allDay ? new Date(fmtDate(endDt  )+"T23:59:59").toISOString() : endDt.toISOString(),
    };

    let savedEvent;
    if (isNew) {
      const { data, error } = await db.createEvent(payload, user.token);
      if (error||!data?.length) { setMsg({ type:"error", text:"Could not save event." }); setSaving(false); return; }
      savedEvent = data[0];
    } else {
      const { data, error } = await db.updateEvent(event.id, payload, user.token);
      if (error) { setMsg({ type:"error", text:"Could not update event." }); setSaving(false); return; }
      savedEvent = data?.[0] || { ...event, ...payload };
    }

    await db.setEventMembers(savedEvent.id, selMembers, user.token);
    onSaved();
  };

  const del = async () => {
    if (!confirm("Delete this event?")) return;
    setDeleting(true);
    await db.deleteEvent(event.id, user.token);
    onDeleted();
  };

  return (
    <div className="modal-backdrop" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal">
        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:16}}>
          <div>
            <div className="modal-title">{isNew?"New event":"Edit event"}</div>
            <div style={{fontSize:13,color:T.muted,marginTop:2}}>{circle.name}</div>
          </div>
          <button className="btn-ghost" style={{padding:6,marginTop:-4,marginRight:-8}} onClick={onClose}>{Ic.x}</button>
        </div>

        <div className="field"><label className="field-label">Title</label><input className="field-input" type="text" placeholder="What's happening?" value={title} onChange={e=>setTitle(e.target.value)} autoFocus/></div>
        <div className="field"><label className="field-label">Description <span style={{textTransform:"none",fontWeight:400,color:T.muted}}>(optional)</span></label><textarea className="field-input" placeholder="Add details…" value={desc} onChange={e=>setDesc(e.target.value)}/></div>

        <div className="field">
          <label className="field-label" style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer"}}>
            <input type="checkbox" checked={allDay} onChange={e=>setAllDay(e.target.checked)} style={{accentColor:T.teal,width:15,height:15}}/>
            All day
          </label>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <div className="field">
            <label className="field-label">{allDay?"Start date":"Start"}</label>
            <input className="field-input" type={allDay?"date":"datetime-local"} value={allDay?startStr.slice(0,10):startStr} onChange={e=>setStartStr(allDay?e.target.value+"T00:00":e.target.value)}/>
          </div>
          <div className="field">
            <label className="field-label">{allDay?"End date":"End"}</label>
            <input className="field-input" type={allDay?"date":"datetime-local"} value={allDay?endStr.slice(0,10):endStr} onChange={e=>setEndStr(allDay?e.target.value+"T23:59":e.target.value)}/>
          </div>
        </div>

        <div className="field">
          <label className="field-label">Members</label>
          <div className="member-checks">
            {members.map((m, mi) => {
              const pal = memberColor(mi);
              const pid = m.profile?.id;
              const checked = selMembers.includes(pid);
              return (
                <div key={m.id} className={`member-check-row ${checked?"checked":""}`} onClick={()=>toggleMember(pid)}>
                  <input type="checkbox" checked={checked} onChange={()=>toggleMember(pid)} onClick={e=>e.stopPropagation()}/>
                  <div className="member-check-avatar" style={{background:pal.border,color:pal.text}}>{initials(m.profile?.full_name||"?")}</div>
                  <span className="member-check-name">{m.profile?.full_name||"Unknown"}</span>
                </div>
              );
            })}
          </div>
        </div>

        <Msg msg={msg}/>

        <div className="modal-footer">
          {!isNew && (
            <button className="btn-danger" style={{marginRight:"auto"}} onClick={del} disabled={deleting}>
              {deleting?"Deleting…":<span style={{display:"flex",alignItems:"center",gap:6}}>{Ic.trash} Delete</span>}
            </button>
          )}
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={save} disabled={saving}>{saving?"Saving…":"Save event"}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Circle Home ──────────────────────────────────────────────────────────────

function CircleHome({ user, circle, membership, onBack }) {
  const isAdmin = membership?.role === "admin";
  const [tab, setTab]         = useState("week");
  const [members, setMembers] = useState([]);
  const [events, setEvents]   = useState([]);
  const [loadingMembers, setLM] = useState(true);
  const [loadingEvents, setLE]  = useState(true);
  const [weekOffset, setWeekOffset] = useState(0); // shared so event modal can reload correct week
  const [eventModal, setEventModal] = useState(null); // { event?, defaultDay?, defaultMemberIds? }
  const [showAdd, setShowAdd]   = useState(false);
  const [inviteProfile, setInviteProfile] = useState(null);
  const [actioning, setActioning] = useState(null);

  const loadMembers = useCallback(async () => {
    setLM(true);
    const { data } = await db.getCircleMembers(circle.id, user.token);
    setMembers(Array.isArray(data)?data:[]);
    setLM(false);
  }, [circle.id, user.token]);

  const loadEvents = useCallback(async () => {
    setLE(true);
    const monday = getMonday(addDays(new Date(), weekOffset*7));
    const { start, end } = weekRange(monday);
    const { data } = await db.getCircleEvents(circle.id, start, end, user.token);
    setEvents(Array.isArray(data)?data:[]);
    setLE(false);
  }, [circle.id, user.token, weekOffset]);

  useEffect(() => { loadMembers(); }, [loadMembers]);
  useEffect(() => { if (tab==="week") loadEvents(); }, [loadEvents, tab]);

  const approved = members.filter(m=>m.status==="approved");
  const pending  = members.filter(m=>m.status==="pending");
  const rejected = members.filter(m=>m.status==="rejected");

  const action = async (id, type, value) => {
    setActioning(id);
    if (type==="status") await db.updateMemberStatus(id, value, user.token);
    if (type==="role")   await db.updateMemberRole(id, value, user.token);
    await loadMembers();
    setActioning(null);
  };

  const tabs = [
    { id:"week",   label:"Weekly view" },
    { id:"members",label:"Members" },
    ...(isAdmin ? [{ id:"manage", label:"Manage" }] : []),
  ];

  const onEventClick = (ev) => setEventModal({ event: ev });
  const onCellClick  = ({ day, member, memberIndex }) => {
    setEventModal({ defaultDay: day, defaultMemberIds: [member.profile?.id] });
  };
  const onEventSaved = () => { setEventModal(null); loadEvents(); };
  const onEventDeleted = () => { setEventModal(null); loadEvents(); };

  return (
    <>
      <div className="app">
        <header className="header">
          <div className="header-top">
            <button className="btn-ghost" style={{color:T.tealText,display:"flex",alignItems:"center",gap:6,padding:"4px 0"}} onClick={onBack}>
              <span style={{display:"flex",width:16,height:16}}>{Ic.arrowLeft}</span>
              <span style={{fontSize:13}}>All circles</span>
            </button>
            <div className="header-right">
              <div className="header-avatar">{initials(user?.profile?.full_name||"?")}</div>
            </div>
          </div>
          <div className="circle-hero">
            <div className="circle-hero-name">{circle.name}</div>
            {circle.description&&<div className="circle-hero-desc">{circle.description}</div>}
            <div className="circle-hero-meta">{approved.length} member{approved.length!==1?"s":""}</div>
          </div>
          <div className="tab-bar">
            {tabs.map(t=>(
              <button key={t.id} className={`tab ${tab===t.id?"active":""}`} onClick={()=>setTab(t.id)}>{t.label}</button>
            ))}
          </div>
        </header>

        {/* Weekly view — full width, no content wrapper */}
        {tab==="week" && (
          loadingMembers ? <div className="content"><Spinner/></div> :
          approved.length === 0 ? <div className="content"><EmptyState icon={Ic.users} text="No approved members yet."/></div> : (
            <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
              {loadingEvents && <div style={{position:"absolute",top:"50%",left:"50%"}}><Spinner/></div>}
              <WeeklyView
                user={user}
                circle={circle}
                approvedMembers={approved}
                events={events}
                onEventClick={onEventClick}
                onCellClick={onCellClick}
              />
            </div>
          )
        )}

        {/* Members tab */}
        {tab==="members" && (
          <div className="content">
            {loadingMembers?<Spinner/>:approved.length===0?<EmptyState icon={Ic.users} text="No members yet."/>:(
              <div className="fade-up">
                {approved.map((m,mi)=>{
                  const isManaged=m.profile?.profile_type==="managed";
                  const pal=memberColor(mi);
                  return (
                    <div key={m.id} className="list-item">
                      <div style={{width:40,height:40,borderRadius:"50%",background:pal.border,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,color:pal.text,flexShrink:0}}>{initials(m.profile?.full_name||"?")}</div>
                      <div className="list-body"><div className="list-name">{m.profile?.full_name||"Unknown"}</div><div className="list-sub">{isManaged?"Managed profile":m.profile?.email}</div></div>
                      <div className="list-right">
                        {isManaged&&<span className="badge badge-managed">Managed</span>}
                        <span className={`badge ${m.role==="admin"?"badge-admin":"badge-member"}`}>{m.role}</span>
                        <span className={`badge ${m.member_type==="family"?"badge-family":"badge-friend"}`}>{m.member_type}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Manage tab (admin only) */}
        {tab==="manage"&&isAdmin&&(
          <div className="content">
            <div className="page-header">
              <div className="page-title">Manage members</div>
              <button className="btn-secondary" onClick={()=>setShowAdd(true)}>Add managed member</button>
            </div>
            {loadingMembers?<Spinner/>:(
              <>
                {pending.length>0&&(
                  <>
                    <div className="section-title">Pending — {pending.length}</div>
                    {pending.map(m=>(
                      <div key={m.id} className="list-item" style={{borderLeft:`3px solid ${T.coral}`}}>
                        <div className="list-icon light">{Ic.user}</div>
                        <div className="list-body"><div className="list-name">{m.profile?.full_name||"Unknown"}</div><div className="list-sub">{m.profile?.email}</div></div>
                        <div className="list-right">
                          <span className={`badge ${m.member_type==="family"?"badge-family":"badge-friend"}`}>{m.member_type}</span>
                          <button className="btn-approve" disabled={actioning===m.id} onClick={()=>action(m.id,"status","approved")}>{actioning===m.id?"…":"Approve"}</button>
                          <button className="btn-reject"  disabled={actioning===m.id} onClick={()=>action(m.id,"status","rejected")}>Reject</button>
                        </div>
                      </div>
                    ))}
                  </>
                )}
                {approved.length>0&&(
                  <>
                    <div className="section-title">Members — {approved.length}</div>
                    {approved.map(m=>{
                      const isManaged=m.profile?.profile_type==="managed";
                      return (
                        <div key={m.id} className="list-item" style={isManaged?{borderLeft:"3px solid #7C3AED"}:{}}>
                          <div className={`list-icon ${isManaged?"managed":"light"}`}>{Ic.user}</div>
                          <div className="list-body"><div className="list-name">{m.profile?.full_name||"Unknown"}</div><div className="list-sub">{isManaged?(m.profile?.invite_email||"No invite email"):m.profile?.email}</div></div>
                          <div className="list-right">
                            {isManaged
                              ?<><span className="badge badge-managed">Managed</span><button className="btn-invite" onClick={()=>setInviteProfile(m.profile)}>{Ic.link} Invite link</button></>
                              :<><span className={`badge ${m.role==="admin"?"badge-admin":"badge-member"}`}>{m.role}</span><button className="btn-ghost" disabled={actioning===m.id} onClick={()=>action(m.id,"role",m.role==="admin"?"member":"admin")}>{actioning===m.id?"…":m.role==="admin"?"Remove admin":"Make admin"}</button></>
                            }
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
                {rejected.length>0&&(
                  <>
                    <div className="section-title">Rejected — {rejected.length}</div>
                    {rejected.map(m=>(
                      <div key={m.id} className="list-item" style={{opacity:0.6}}>
                        <div className="list-icon light">{Ic.user}</div>
                        <div className="list-body"><div className="list-name">{m.profile?.full_name||"Unknown"}</div><div className="list-sub">{m.profile?.email}</div></div>
                        <div className="list-right"><span className="badge badge-rejected">Rejected</span></div>
                      </div>
                    ))}
                  </>
                )}
                {pending.length===0&&approved.length===0&&rejected.length===0&&<EmptyState icon={Ic.users} text="No members yet."/>}
              </>
            )}
          </div>
        )}
      </div>

      {/* Event modal */}
      {eventModal && (
        <EventModal
          user={user}
          circle={circle}
          members={approved}
          event={eventModal.event}
          defaultDay={eventModal.defaultDay}
          defaultMemberIds={eventModal.defaultMemberIds}
          onClose={()=>setEventModal(null)}
          onSaved={onEventSaved}
          onDeleted={onEventDeleted}
        />
      )}

      {/* Add managed member modal */}
      {showAdd && <AddManagedModal user={user} circle={circle} onClose={()=>setShowAdd(false)} onAdded={p=>{setShowAdd(false);loadMembers();setInviteProfile(p);}}/>}

      {/* Invite link modal */}
      {inviteProfile && <InviteLinkModal profile={inviteProfile} onClose={()=>setInviteProfile(null)}/>}
    </>
  );
}

// ─── Add Managed Modal ────────────────────────────────────────────────────────

function AddManagedModal({ user, circle, onClose, onAdded }) {
  const [name, setName]   = useState("");
  const [type, setType]   = useState("family");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg]     = useState(null);

  const handle = async () => {
    if (!name.trim()) { setMsg({ type:"error", text:"Please enter a name." }); return; }
    setLoading(true); setMsg(null);
    const { data:profiles, error:pErr } = await db.createManagedProfile(name.trim(), type, user.profile.id, email.trim()||null, user.token);
    if (pErr||!profiles?.length) { setMsg({ type:"error", text:"Could not create profile." }); setLoading(false); return; }
    const profile = profiles[0];
    const { error:mErr } = await db.addMember(circle.id, profile.id, "member", "approved", type, user.token);
    if (mErr) { setMsg({ type:"error", text:"Profile created but could not add to circle." }); setLoading(false); return; }
    onAdded(profile);
  };

  return (
    <div className="modal-backdrop" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal">
        <div className="modal-title">Add a managed member</div>
        <div className="modal-sub">Add someone without their own account, such as a child. They appear in the circle and the weekly view like any other member.</div>
        <div className="field"><label className="field-label">Name</label><input className="field-input" type="text" placeholder="e.g. Ellie Brewis" value={name} onChange={e=>setName(e.target.value)} autoFocus/></div>
        <div className="field"><label className="field-label">Member type</label><div className="type-row"><button className={`type-btn ${type==="family"?"selected":""}`} onClick={()=>setType("family")}>Family</button><button className={`type-btn ${type==="friend"?"selected":""}`} onClick={()=>setType("friend")}>Friend</button></div></div>
        <div className="field"><label className="field-label">Invite email <span style={{textTransform:"none",fontWeight:400,color:T.muted}}>(optional)</span></label><input className="field-input" type="email" placeholder="For when they're ready to join" value={email} onChange={e=>setEmail(e.target.value)}/><div className="field-hint">Stored so you can send an invite link later.</div></div>
        <Msg msg={msg}/>
        <div className="modal-footer"><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" onClick={handle} disabled={loading}>{loading?"Adding…":"Add to circle"}</button></div>
      </div>
    </div>
  );
}

// ─── Invite Link Modal ────────────────────────────────────────────────────────

function InviteLinkModal({ profile, onClose }) {
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}?invite=${profile.invite_token}`;
  const copy = async () => { try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(()=>setCopied(false),2500); } catch {} };
  return (
    <div className="modal-backdrop" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal">
        <div className="modal-title">Invite link — {profile.full_name}</div>
        <div className="modal-sub">Share this link so they can create an account and claim their profile.</div>
        <div className="invite-box">{link}</div>
        <button className={`btn-invite ${copied?"copied":""}`} style={{width:"100%",padding:"9px",fontSize:13,display:"flex",alignItems:"center",justifyContent:"center",gap:8}} onClick={copy}>
          <span style={{display:"flex",width:15,height:15}}>{copied?Ic.check:Ic.copy}</span>{copied?"Copied to clipboard":"Copy invite link"}
        </button>
        {profile.invite_email&&<div className="msg info" style={{marginTop:12}}>Stored email: {profile.invite_email}</div>}
        <div className="modal-footer"><button className="btn-secondary" style={{width:"100%"}} onClick={onClose}>Done</button></div>
      </div>
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function App() {
  const [session, setSession]           = useState(null);
  const [screen, setScreen]             = useState("dashboard");
  const [activeCircle, setActiveCircle] = useState(null);
  const [activeMembership, setActiveMembership] = useState(null);
  const [inviteToken, setInviteToken]   = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tok = params.get("invite");
    if (tok) setInviteToken(tok);
  }, []);

  const signOut = () => { setSession(null); setScreen("dashboard"); };
  const go = (s, circle=null, membership=null) => { setScreen(s); if(circle) setActiveCircle(circle); if(membership) setActiveMembership(membership); };

  if (inviteToken&&!session) return <><style>{styles}</style><ClaimProfileScreen inviteToken={inviteToken} onClaimed={sess=>{ window.history.replaceState({},"",window.location.pathname); setInviteToken(null); setSession(sess); }}/></>;
  if (!session) return <><style>{styles}</style><AuthPage onLogin={setSession}/></>;

  const render = () => {
    switch(screen) {
      case "create": return <CreateCircle user={session} onBack={()=>go("dashboard")} onCreated={c=>go("circle",c,{role:"admin",status:"approved"})}/>;
      case "circle": return <CircleHome  user={session} circle={activeCircle} membership={activeMembership} onBack={()=>go("dashboard")}/>;
      default:       return <Dashboard   user={session} onSignOut={signOut} onEnterCircle={(c,m)=>go("circle",c,m)} onCreateCircle={()=>go("create")}/>;
    }
  };

  return <><style>{styles}</style>{render()}</>;
}
