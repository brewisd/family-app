import { useState, useEffect, useCallback } from "react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// ─── Supabase helpers ─────────────────────────────────────────────────────────

async function sbFetch(endpoint, options = {}, token = null) {
  const res = await fetch(`${SUPABASE_URL}${endpoint}`, {
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token || SUPABASE_ANON_KEY}`,
      ...(options.headers || {}),
    },
    ...options,
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { data, error: res.ok ? null : data };
}

const auth = {
  signIn: (email, password) =>
    sbFetch("/auth/v1/token?grant_type=password", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  signUp: (email, password, fullName) =>
    sbFetch("/auth/v1/signup", {
      method: "POST",
      body: JSON.stringify({ email, password, data: { full_name: fullName } }),
    }),
};

const db = {
  // Profiles
  getProfile: (userId, token) =>
    sbFetch(`/rest/v1/profiles?id=eq.${userId}&select=*`, { method: "GET" }, token),

  getProfileByAuthId: (authId, token) =>
    sbFetch(`/rest/v1/profiles?auth_id=eq.${authId}&select=*`, { method: "GET" }, token),

  getProfileByInviteToken: (inviteToken, token) =>
    sbFetch(`/rest/v1/profiles?invite_token=eq.${inviteToken}&select=*`, { method: "GET" }, token),

  // Create a managed (non-user) profile
  createManagedProfile: (fullName, memberType, createdBy, inviteEmail, token) =>
    sbFetch("/rest/v1/profiles", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        id: crypto.randomUUID(),
        full_name: fullName,
        profile_type: "managed",
        created_by: createdBy,
        invite_email: inviteEmail || null,
        invite_token: crypto.randomUUID(),
      }),
    }, token),

  // Claim a managed profile — link it to a real auth user
  claimProfile: (profileId, authId, email, token) =>
    sbFetch(`/rest/v1/profiles?id=eq.${profileId}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ auth_id: authId, email, profile_type: "user" }),
    }, token),

  // Circles
  getMyCircles: (profileId, token) =>
    sbFetch(
      `/rest/v1/circle_members?user_id=eq.${profileId}&select=*,circle:circles(*)&order=joined_at.desc`,
      { method: "GET" }, token
    ),

  getAllCircles: (token) =>
    sbFetch(`/rest/v1/circles?select=*&order=created_at.desc`, { method: "GET" }, token),

  createCircle: (name, description, userId, token) =>
    sbFetch("/rest/v1/circles", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ name, description, created_by: userId }),
    }, token),

  // Members
  addMember: (circleId, profileId, role, status, memberType, token) =>
    sbFetch("/rest/v1/circle_members", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ circle_id: circleId, user_id: profileId, role, status, member_type: memberType }),
    }, token),

  getCircleMembers: (circleId, token) =>
    sbFetch(
      `/rest/v1/circle_members?circle_id=eq.${circleId}&select=*,profile:profiles(*)&order=joined_at.asc`,
      { method: "GET" }, token
    ),

  updateMemberStatus: (id, status, token) =>
    sbFetch(`/rest/v1/circle_members?id=eq.${id}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ status }),
    }, token),

  updateMemberRole: (id, role, token) =>
    sbFetch(`/rest/v1/circle_members?id=eq.${id}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ role }),
    }, token),
};

// ─── Design tokens ────────────────────────────────────────────────────────────

const P = {
  coral: "#FF6B6B", yellow: "#FFD93D", green: "#6BCB77",
  blue: "#4D96FF", purple: "#C77DFF", orange: "#FF9F43",
};

const CIRCLE_GRADIENTS = [
  `linear-gradient(135deg, ${P.coral}, ${P.orange})`,
  `linear-gradient(135deg, ${P.blue}, ${P.purple})`,
  `linear-gradient(135deg, ${P.green}, ${P.blue})`,
  `linear-gradient(135deg, ${P.yellow}, ${P.green})`,
  `linear-gradient(135deg, ${P.purple}, ${P.coral})`,
  `linear-gradient(135deg, ${P.orange}, ${P.yellow})`,
];

const circleGradient = (id) => CIRCLE_GRADIENTS[(id?.charCodeAt(0) || 0) % CIRCLE_GRADIENTS.length];

const FLOAT_ICONS = [
  { icon: "⛺", x: 8,  y: 12, size: 2.2, delay: 0,   dur: 7   },
  { icon: "✝️", x: 85, y: 8,  size: 1.8, delay: 1.5, dur: 8   },
  { icon: "🏔️", x: 72, y: 75, size: 2.4, delay: 0.8, dur: 9   },
  { icon: "🌻", x: 15, y: 78, size: 2.0, delay: 2.2, dur: 7.5 },
  { icon: "🚵", x: 90, y: 45, size: 1.9, delay: 0.3, dur: 8.5 },
  { icon: "🏄", x: 5,  y: 48, size: 1.7, delay: 1.8, dur: 6.5 },
  { icon: "🎉", x: 50, y: 5,  size: 1.6, delay: 0.6, dur: 7.8 },
  { icon: "🌈", x: 60, y: 88, size: 2.1, delay: 2.8, dur: 9.2 },
  { icon: "🙏", x: 38, y: 90, size: 1.8, delay: 1.2, dur: 8   },
  { icon: "🫶", x: 28, y: 18, size: 1.6, delay: 3.0, dur: 7.2 },
  { icon: "🌊", x: 78, y: 22, size: 1.9, delay: 0.4, dur: 8.8 },
  { icon: "🎸", x: 45, y: 82, size: 1.7, delay: 2.0, dur: 7.4 },
];

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Fredoka+One&family=Nunito:wght@400;600;700;800&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Nunito', sans-serif; background: #fff9f0; min-height: 100vh; }

  .page { min-height: 100vh; background: linear-gradient(135deg, #fff9f0 0%, #fff0f6 40%, #f0f8ff 100%); }
  .page-centered {
    min-height: 100vh; display: flex; align-items: center; justify-content: center;
    padding: 1.5rem; position: relative; overflow: hidden;
    background: linear-gradient(135deg, #fff9f0 0%, #fff0f6 40%, #f0f8ff 100%);
  }
  .container { max-width: 720px; margin: 0 auto; padding: 2rem 1.5rem; }

  .floating-icon {
    position: absolute; pointer-events: none; user-select: none;
    animation: floatBob var(--dur) ease-in-out infinite var(--delay); opacity: 0.5;
  }
  @keyframes floatBob {
    0%,100% { transform: translateY(0) rotate(-3deg); }
    50%      { transform: translateY(-18px) rotate(3deg); }
  }
  .blob { position: absolute; border-radius: 50%; filter: blur(60px); opacity: 0.18; pointer-events: none; }

  .card {
    background: #fff; border-radius: 24px;
    box-shadow: 0 8px 48px rgba(0,0,0,0.09), 0 2px 8px rgba(0,0,0,0.05);
    animation: slideUp .5s cubic-bezier(.16,1,.3,1) both;
  }
  .card-pad { padding: 2.5rem 2.25rem; }
  @keyframes slideUp {
    from { opacity:0; transform:translateY(28px); }
    to   { opacity:1; transform:translateY(0); }
  }

  /* ── Navbar ── */
  .navbar {
    background: #fff; box-shadow: 0 2px 16px rgba(0,0,0,0.07);
    padding: 0 1.5rem; display: flex; align-items: center; justify-content: space-between;
    height: 64px; position: sticky; top: 0; z-index: 100;
  }
  .navbar-brand {
    font-family: 'Fredoka One', cursive; font-size: 1.5rem;
    background: linear-gradient(90deg, #FF6B6B, #FF9F43, #C77DFF);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
  }
  .navbar-right { display: flex; align-items: center; gap: 1rem; }
  .nav-user { font-size: 0.85rem; font-weight: 700; color: #999; }

  /* ── Logo / brand ── */
  .logo-ring {
    width: 80px; height: 80px; border-radius: 50%; margin: 0 auto 1rem;
    display: flex; align-items: center; justify-content: center; font-size: 2.4rem;
    background: linear-gradient(135deg, #FFD93D, #FF6B6B, #C77DFF);
    box-shadow: 0 4px 20px rgba(255,107,107,.35); animation: pulse 3s ease-in-out infinite;
  }
  @keyframes pulse {
    0%,100% { transform:scale(1);    box-shadow: 0 4px 20px rgba(255,107,107,.35); }
    50%      { transform:scale(1.05); box-shadow: 0 6px 28px rgba(199,125,255,.5);  }
  }
  .brand-title {
    font-family:'Fredoka One',cursive; font-size:2.4rem; text-align:center;
    background:linear-gradient(90deg,#FF6B6B,#FF9F43,#FFD93D,#6BCB77,#4D96FF,#C77DFF);
    -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text;
    line-height:1.1; margin-bottom:.25rem;
  }
  .brand-sub {
    text-align:center; font-size:.9rem; color:#999; font-weight:600;
    letter-spacing:.08em; text-transform:uppercase; margin-bottom:1.75rem;
  }

  /* ── Tabs ── */
  .tab-row { display:flex; gap:6px; background:#f5f3ff; border-radius:14px; padding:5px; margin-bottom:1.4rem; }
  .tab-btn {
    flex:1; border:none; border-radius:10px; padding:.55rem;
    font-family:'Nunito',sans-serif; font-size:.9rem; font-weight:700;
    cursor:pointer; transition:all .2s; background:transparent; color:#aaa;
  }
  .tab-btn.active { background:#fff; color:#7c3aed; box-shadow:0 2px 10px rgba(124,58,237,.15); }

  /* ── Form ── */
  .field-wrap { margin-bottom:1rem; }
  .field-label { display:block; font-size:.8rem; font-weight:700; color:#666; text-transform:uppercase; letter-spacing:.06em; margin-bottom:.4rem; }
  .field-input {
    width:100%; border:2px solid #ede9fe; border-radius:12px; padding:.7rem 1rem;
    font-family:'Nunito',sans-serif; font-size:1rem; font-weight:600; color:#333;
    background:#faf9ff; transition:border-color .2s,box-shadow .2s; outline:none;
  }
  .field-input:focus { border-color:#a78bfa; box-shadow:0 0 0 4px rgba(167,139,250,.15); background:#fff; }
  textarea.field-input { resize:vertical; min-height:80px; }

  /* ── Buttons ── */
  .btn-primary {
    width:100%; border:none; border-radius:14px; padding:.85rem;
    font-family:'Fredoka One',cursive; font-size:1.15rem; color:#fff; cursor:pointer;
    background:linear-gradient(90deg,#FF6B6B,#FF9F43);
    box-shadow:0 4px 20px rgba(255,107,107,.35); transition:transform .15s,box-shadow .15s;
  }
  .btn-primary:hover:not(:disabled) { transform:translateY(-2px); box-shadow:0 6px 26px rgba(255,107,107,.45); }
  .btn-primary:active:not(:disabled) { transform:scale(.98); }
  .btn-primary:disabled { opacity:.6; cursor:not-allowed; }

  .btn-secondary {
    border:2px solid #ede9fe; border-radius:12px; padding:.55rem 1.25rem;
    font-family:'Nunito',sans-serif; font-size:.9rem; font-weight:700;
    color:#a78bfa; background:transparent; cursor:pointer; transition:all .2s;
  }
  .btn-secondary:hover { background:#f5f3ff; border-color:#a78bfa; }

  .btn-ghost {
    border:none; background:transparent; cursor:pointer;
    font-family:'Nunito',sans-serif; font-size:.85rem; font-weight:700;
    color:#bbb; padding:.35rem .65rem; border-radius:8px; transition:all .2s;
  }
  .btn-ghost:hover { color:#888; background:#f5f5f5; }
  .btn-ghost:disabled { opacity:.4; cursor:not-allowed; }

  .btn-approve {
    border:none; border-radius:10px; padding:.45rem 1rem;
    font-family:'Nunito',sans-serif; font-size:.82rem; font-weight:800; color:#fff; cursor:pointer;
    background:linear-gradient(90deg,#6BCB77,#4D96FF); box-shadow:0 2px 10px rgba(107,203,119,.3);
    transition:transform .15s;
  }
  .btn-approve:hover:not(:disabled) { transform:translateY(-1px); }

  .btn-reject {
    border:1px solid #ffd0d0; border-radius:10px; padding:.45rem 1rem;
    font-family:'Nunito',sans-serif; font-size:.82rem; font-weight:800;
    color:#e53e3e; background:#fff0f0; cursor:pointer; transition:background .2s;
  }
  .btn-reject:hover:not(:disabled) { background:#ffe0e0; }
  .btn-approve:disabled,.btn-reject:disabled { opacity:.5; cursor:not-allowed; }

  .btn-invite {
    border:1.5px solid #c77dff; border-radius:10px; padding:.4rem .85rem;
    font-family:'Nunito',sans-serif; font-size:.8rem; font-weight:800;
    color:#c77dff; background:#fdf4ff; cursor:pointer; transition:all .2s;
    white-space:nowrap;
  }
  .btn-invite:hover { background:#f5e6ff; }
  .btn-invite.copied { border-color:#6BCB77; color:#276749; background:#f0fff4; }

  /* ── Messages ── */
  .msg { margin-top:1rem; padding:.75rem 1rem; border-radius:10px; font-size:.88rem; font-weight:700; text-align:center; line-height:1.5; }
  .msg.error   { background:#fff0f0; color:#e53e3e; }
  .msg.success { background:#f0fff4; color:#276749; }
  .msg.info    { background:#f0f4ff; color:#3b5bdb; }

  /* ── Pills / badges ── */
  .tag-pill { font-size:.78rem; font-weight:700; padding:.25rem .7rem; border-radius:999px; color:#fff; }
  .tagline-strip { display:flex; justify-content:center; gap:.75rem; flex-wrap:wrap; margin-top:1.5rem; }
  .role-badge { font-size:.72rem; font-weight:800; padding:.2rem .65rem; border-radius:999px; text-transform:uppercase; letter-spacing:.05em; }
  .role-admin  { background:#f5f3ff; color:#7c3aed; }
  .role-member { background:#f0fff4; color:#276749; }
  .status-badge { font-size:.72rem; font-weight:800; padding:.2rem .65rem; border-radius:999px; text-transform:uppercase; letter-spacing:.05em; }
  .status-approved { background:#f0fff4; color:#276749; }
  .status-pending  { background:#fff7ed; color:#c2410c; }
  .status-rejected { background:#fff0f0; color:#e53e3e; }
  .managed-badge { font-size:.7rem; font-weight:800; padding:.2rem .6rem; border-radius:999px; background:#fdf4ff; color:#9333ea; border:1px solid #e9d5ff; text-transform:uppercase; letter-spacing:.04em; }

  /* ── Dashboard ── */
  .dashboard-greeting {
    font-family:'Fredoka One',cursive; font-size:1.8rem;
    background:linear-gradient(90deg,#FF6B6B,#FF9F43,#C77DFF);
    -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; margin-bottom:.25rem;
  }
  .dashboard-sub { font-size:.95rem; color:#aaa; font-weight:600; margin-bottom:2rem; }
  .circles-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(280px,1fr)); gap:1.25rem; margin-bottom:2rem; }
  .circle-card {
    border-radius:20px; overflow:hidden; cursor:pointer;
    box-shadow:0 4px 20px rgba(0,0,0,0.08); transition:transform .2s,box-shadow .2s;
    background:#fff; animation: slideUp .4s cubic-bezier(.16,1,.3,1) both;
  }
  .circle-card:hover { transform:translateY(-4px); box-shadow:0 8px 32px rgba(0,0,0,0.13); }
  .circle-card-header { height:90px; display:flex; align-items:center; justify-content:center; font-size:2.5rem; }
  .circle-card-body { padding:1.1rem 1.25rem 1.25rem; }
  .circle-card-name { font-family:'Fredoka One',cursive; font-size:1.25rem; color:#333; margin-bottom:.25rem; }
  .circle-card-desc { font-size:.85rem; color:#aaa; font-weight:600; margin-bottom:.75rem; line-height:1.4; }
  .circle-card-footer { display:flex; align-items:center; justify-content:space-between; }

  /* ── Action cards ── */
  .action-row-cards { display:grid; grid-template-columns:1fr 1fr; gap:1rem; margin-bottom:2rem; }
  .action-card {
    border-radius:16px; padding:1.25rem; cursor:pointer; border:2px dashed #ede9fe;
    background:#faf9ff; text-align:center; transition:all .2s;
  }
  .action-card:hover { border-color:#a78bfa; background:#f5f3ff; }
  .action-card-icon { font-size:2rem; margin-bottom:.5rem; }
  .action-card-label { font-family:'Fredoka One',cursive; font-size:1rem; color:#7c3aed; }
  .action-card-sub { font-size:.8rem; color:#bbb; font-weight:600; margin-top:.2rem; }

  /* ── Circle home ── */
  .circle-home-hero {
    height:160px; border-radius:0 0 32px 32px;
    display:flex; flex-direction:column; align-items:center; justify-content:center;
    color:#fff; text-align:center; padding:1.5rem; margin-bottom:2rem;
  }
  .circle-home-hero-name { font-family:'Fredoka One',cursive; font-size:2.2rem; margin-bottom:.25rem; }
  .circle-home-hero-desc { font-size:.9rem; opacity:.85; font-weight:600; }

  .members-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(140px,1fr)); gap:1rem; margin-bottom:2rem; }
  .member-tile {
    background:#fff; border-radius:16px; padding:1.25rem .75rem;
    text-align:center; box-shadow:0 2px 12px rgba(0,0,0,.07);
    animation: slideUp .35s cubic-bezier(.16,1,.3,1) both;
    position:relative;
  }
  .member-tile.is-managed { border:2px dashed #e9d5ff; }
  .member-avatar-lg {
    width:52px; height:52px; border-radius:50%; margin:0 auto .75rem;
    display:flex; align-items:center; justify-content:center; font-size:1.5rem;
  }
  .member-tile-name { font-size:.88rem; font-weight:800; color:#333; margin-bottom:.3rem; }
  .member-tile-sub  { font-size:.75rem; color:#bbb; font-weight:600; margin-top:.25rem; }

  /* ── Admin panel ── */
  .admin-section-label { font-size:.75rem; font-weight:800; text-transform:uppercase; letter-spacing:.1em; color:#ccc; margin:1.5rem 0 .75rem; }
  .member-row {
    background:#fff; border-radius:14px; padding:1rem 1.25rem;
    display:flex; align-items:center; justify-content:space-between; gap:1rem;
    box-shadow:0 2px 12px rgba(0,0,0,.06); flex-wrap:wrap;
    animation: slideUp .35s cubic-bezier(.16,1,.3,1) both; margin-bottom:.75rem;
  }
  .member-row.is-managed { border-left:4px solid #c77dff; }
  .member-row-info { display:flex; align-items:center; gap:.85rem; }
  .member-avatar-sm {
    width:42px; height:42px; border-radius:50%; flex-shrink:0;
    display:flex; align-items:center; justify-content:center; font-size:1.2rem;
  }
  .member-row-name  { font-size:.95rem; font-weight:800; color:#333; display:flex; align-items:center; gap:.4rem; flex-wrap:wrap; }
  .member-row-email { font-size:.8rem; color:#bbb; font-weight:600; margin-top:1px; }
  .member-row-actions { display:flex; gap:.5rem; flex-shrink:0; align-items:center; flex-wrap:wrap; }

  /* ── Browse circles ── */
  .browse-circle-row {
    background:#fff; border-radius:16px; padding:1.1rem 1.25rem;
    display:flex; align-items:center; gap:1rem;
    box-shadow:0 2px 12px rgba(0,0,0,.06); margin-bottom:.75rem;
    animation: slideUp .35s cubic-bezier(.16,1,.3,1) both;
  }
  .browse-circle-icon { width:48px; height:48px; border-radius:14px; flex-shrink:0; display:flex; align-items:center; justify-content:center; font-size:1.4rem; }
  .browse-circle-name { font-family:'Fredoka One',cursive; font-size:1.1rem; color:#333; }
  .browse-circle-desc { font-size:.82rem; color:#bbb; font-weight:600; margin-top:2px; }
  .browse-circle-actions { margin-left:auto; flex-shrink:0; }

  /* ── Type selector ── */
  .type-row { display:flex; gap:8px; margin-bottom:1rem; }
  .type-btn {
    flex:1; border:2px solid #ede9fe; border-radius:12px; padding:.6rem .5rem;
    font-family:'Nunito',sans-serif; font-size:.85rem; font-weight:700;
    cursor:pointer; background:#faf9ff; color:#aaa; transition:all .2s; text-align:center;
  }
  .type-btn.selected { border-color:#a78bfa; background:#f5f3ff; color:#7c3aed; }

  /* ── Search ── */
  .search-wrap { position:relative; margin-bottom:1.25rem; }
  .search-icon { position:absolute; left:1rem; top:50%; transform:translateY(-50%); font-size:1rem; pointer-events:none; }
  .search-input {
    width:100%; border:2px solid #ede9fe; border-radius:12px; padding:.7rem 1rem .7rem 2.75rem;
    font-family:'Nunito',sans-serif; font-size:.95rem; font-weight:600; color:#333;
    background:#faf9ff; outline:none; transition:border-color .2s,box-shadow .2s;
  }
  .search-input:focus { border-color:#a78bfa; box-shadow:0 0 0 4px rgba(167,139,250,.15); background:#fff; }

  /* ── Back btn ── */
  .back-btn {
    display:inline-flex; align-items:center; gap:.4rem;
    font-family:'Nunito',sans-serif; font-size:.9rem; font-weight:700;
    color:#a78bfa; background:none; border:none; cursor:pointer; padding:.4rem 0;
    margin-bottom:1.25rem; transition:color .2s;
  }
  .back-btn:hover { color:#7c3aed; }

  /* ── Invite / claim ── */
  .invite-link-box {
    background:#faf9ff; border:2px solid #ede9fe; border-radius:12px;
    padding:.75rem 1rem; font-size:.8rem; font-weight:700; color:#888;
    word-break:break-all; margin-bottom:.75rem; line-height:1.5;
  }
  .claim-hero { text-align:center; padding:1rem 0 1.5rem; }
  .claim-emoji { font-size:3.5rem; display:block; margin-bottom:.75rem; animation:pendingBob 2s ease-in-out infinite; }
  @keyframes pendingBob { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
  .claim-title { font-family:'Fredoka One',cursive; font-size:1.9rem; margin-bottom:.4rem; background:linear-gradient(90deg,#C77DFF,#4D96FF); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
  .claim-sub { color:#aaa; font-weight:700; font-size:.92rem; line-height:1.5; }

  /* ── Pending/rejected screens ── */
  .pending-emoji { font-size:4rem; display:block; margin-bottom:1rem; animation:pendingBob 2s ease-in-out infinite; }
  .pending-title { font-family:'Fredoka One',cursive; font-size:2rem; background:linear-gradient(90deg,#FF9F43,#C77DFF); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; margin-bottom:.75rem; }
  .pending-text { color:#888; font-size:1rem; font-weight:600; line-height:1.6; margin-bottom:1.5rem; }
  .pending-dots { display:flex; justify-content:center; gap:8px; margin-bottom:1.5rem; }
  .pending-dot { width:10px; height:10px; border-radius:50%; animation:dotPulse 1.4s ease-in-out infinite; }
  .pending-dot:nth-child(1){background:#FF6B6B;animation-delay:0s}
  .pending-dot:nth-child(2){background:#FFD93D;animation-delay:.2s}
  .pending-dot:nth-child(3){background:#6BCB77;animation-delay:.4s}
  @keyframes dotPulse{0%,80%,100%{transform:scale(.7);opacity:.5}40%{transform:scale(1.2);opacity:1}}

  /* ── Modal ── */
  .modal-backdrop {
    position:fixed; inset:0; background:rgba(0,0,0,0.4); z-index:200;
    display:flex; align-items:center; justify-content:center; padding:1.5rem;
    animation:fadeIn .2s ease;
  }
  @keyframes fadeIn { from{opacity:0} to{opacity:1} }
  .modal {
    background:#fff; border-radius:24px; padding:2rem;
    width:100%; max-width:420px;
    box-shadow:0 20px 60px rgba(0,0,0,0.2);
    animation: slideUp .3s cubic-bezier(.16,1,.3,1) both;
  }
  .modal-title { font-family:'Fredoka One',cursive; font-size:1.5rem; color:#333; margin-bottom:.25rem; }
  .modal-sub { font-size:.85rem; color:#bbb; font-weight:600; margin-bottom:1.5rem; line-height:1.4; }
  .modal-footer { display:flex; gap:.75rem; margin-top:1.25rem; }
  .modal-footer .btn-primary { font-size:1rem; padding:.7rem; }

  /* ── Empty state ── */
  .empty-state { text-align:center; padding:2.5rem 1.5rem; }
  .empty-state-emoji { font-size:2.5rem; margin-bottom:.75rem; }
  .empty-state-text { color:#bbb; font-weight:700; font-size:.95rem; }

  @media(max-width:500px) {
    .action-row-cards { grid-template-columns:1fr; }
    .circles-grid { grid-template-columns:1fr; }
    .member-row-actions { width:100%; justify-content:flex-end; }
  }
`;

// ─── Shared UI ────────────────────────────────────────────────────────────────

function FloatingBg() {
  return (
    <>
      {FLOAT_ICONS.map((ic, i) => (
        <div key={i} className="floating-icon" style={{ left:`${ic.x}%`, top:`${ic.y}%`, fontSize:`${ic.size}rem`, "--dur":`${ic.dur}s`, "--delay":`${ic.delay}s` }}>
          {ic.icon}
        </div>
      ))}
      <div className="blob" style={{ width:320, height:320, background:"#FFD93D", top:"-80px",   left:"-60px"  }} />
      <div className="blob" style={{ width:260, height:260, background:"#C77DFF", bottom:"60px", right:"-40px" }} />
      <div className="blob" style={{ width:200, height:200, background:"#6BCB77", bottom:"20px", left:"10%"    }} />
    </>
  );
}

function Navbar({ user, onSignOut, onBack, backLabel }) {
  const name = user?.profile?.full_name || user?.email?.split("@")[0] || "there";
  return (
    <nav className="navbar">
      <div className="navbar-brand">
        {onBack
          ? <button className="back-btn" style={{ marginBottom:0 }} onClick={onBack}>← {backLabel || "Back"}</button>
          : "Circles ◦"}
      </div>
      <div className="navbar-right">
        <span className="nav-user">Hey, {name} 👋</span>
        {onSignOut && <button className="btn-secondary" onClick={onSignOut}>Sign out</button>}
      </div>
    </nav>
  );
}

function EmptyState({ emoji, text }) {
  return (
    <div className="empty-state">
      <div className="empty-state-emoji">{emoji}</div>
      <div className="empty-state-text">{text}</div>
    </div>
  );
}

// member_type avatar helpers
const avatarEmoji = (type) => type === "family" ? "👨‍👩‍👧‍👦" : "🫶";
const avatarBg    = (type) => type === "family"
  ? `linear-gradient(135deg,${P.blue},${P.purple})`
  : `linear-gradient(135deg,${P.orange},${P.coral})`;

// ─── Add Managed Member Modal ─────────────────────────────────────────────────

function AddManagedMemberModal({ user, circle, onClose, onAdded }) {
  const [name, setName]         = useState("");
  const [memberType, setType]   = useState("family");
  const [inviteEmail, setEmail] = useState("");
  const [loading, setLoading]   = useState(false);
  const [message, setMessage]   = useState(null);

  const handle = async () => {
    if (!name.trim()) { setMessage({ type:"error", text:"Please enter a name." }); return; }
    setLoading(true); setMessage(null);
    // Create the managed profile
    const { data: profiles, error: pErr } = await db.createManagedProfile(
      name.trim(), memberType, user.profile.id, inviteEmail.trim() || null, user.token
    );
    if (pErr || !profiles?.length) {
      setMessage({ type:"error", text:"Could not create member. Please try again." });
      setLoading(false); return;
    }
    const profile = profiles[0];
    // Add them to the circle as approved member immediately (admin is adding them directly)
    const { error: mErr } = await db.addMember(circle.id, profile.id, "member", "approved", memberType, user.token);
    if (mErr) {
      setMessage({ type:"error", text:"Profile created but could not add to circle. Please try again." });
      setLoading(false); return;
    }
    onAdded(profile);
  };

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-title">➕ Add a Member</div>
        <div className="modal-sub">
          Add someone who doesn't have their own account — like a child.
          They'll appear in the circle just like anyone else.
        </div>

        <div className="field-wrap">
          <label className="field-label">Their Name</label>
          <input className="field-input" type="text" placeholder="e.g. Ellie Brewis" value={name} onChange={e => setName(e.target.value)} autoFocus />
        </div>

        <div className="field-wrap">
          <label className="field-label">They are a…</label>
          <div className="type-row">
            <button className={`type-btn ${memberType==="family"?"selected":""}`} onClick={() => setType("family")}>👨‍👩‍👧‍👦 Family</button>
            <button className={`type-btn ${memberType==="friend"?"selected":""}`} onClick={() => setType("friend")}>🫶 Friend</button>
          </div>
        </div>

        <div className="field-wrap">
          <label className="field-label">Invite Email (optional)</label>
          <input
            className="field-input" type="email"
            placeholder="For when they're ready to join"
            value={inviteEmail} onChange={e => setEmail(e.target.value)}
          />
          <div style={{ fontSize:".78rem", color:"#bbb", fontWeight:600, marginTop:".35rem" }}>
            This is stored so you can send them an invite link later
          </div>
        </div>

        {message && <div className={`msg ${message.type}`}>{message.text}</div>}

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose} style={{ flex:1 }}>Cancel</button>
          <button className="btn-primary" onClick={handle} disabled={loading} style={{ flex:2 }}>
            {loading ? "Adding…" : "Add to circle 🎉"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Invite Link Modal ────────────────────────────────────────────────────────

function InviteLinkModal({ profile, onClose }) {
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}?invite=${profile.invite_token}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // fallback: select the text
    }
  };

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-title">🔗 Invite Link</div>
        <div className="modal-sub">
          Share this link with <strong>{profile.full_name}</strong> so they can create an account
          and claim their profile. Their circle memberships will carry over automatically.
        </div>

        <div className="invite-link-box">{link}</div>

        <button className={`btn-invite ${copied?"copied":""}`} style={{ width:"100%", padding:".7rem", fontSize:".95rem" }} onClick={copy}>
          {copied ? "✓ Copied to clipboard!" : "📋 Copy invite link"}
        </button>

        {profile.invite_email && (
          <div style={{ marginTop:"1rem", padding:".75rem 1rem", background:"#f0f4ff", borderRadius:10, fontSize:".82rem", fontWeight:700, color:"#3b5bdb" }}>
            📧 Stored invite email: {profile.invite_email}
          </div>
        )}

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose} style={{ width:"100%" }}>Done</button>
        </div>
      </div>
    </div>
  );
}

// ─── Claim Profile Screen ─────────────────────────────────────────────────────
// Shown when someone visits /?invite=TOKEN

function ClaimProfileScreen({ inviteToken, onClaimed }) {
  const [profile, setProfile]   = useState(null);
  const [loading, setLoading]   = useState(true);
  const [mode, setMode]         = useState("signup"); // signup | signin
  const [fullName, setFullName] = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage]   = useState(null);

  useEffect(() => {
    (async () => {
      const { data } = await db.getProfileByInviteToken(inviteToken, null);
      if (data?.length) {
        setProfile(data[0]);
        setFullName(data[0].full_name || "");
        setEmail(data[0].invite_email || "");
      } else {
        setMessage({ type:"error", text:"This invite link is invalid or has already been used." });
      }
      setLoading(false);
    })();
  }, [inviteToken]);

  const handle = async () => {
    if (!email || !password) { setMessage({ type:"error", text:"Please fill in all fields." }); return; }
    setSubmitting(true); setMessage(null);

    if (mode === "signup") {
      // Create the auth account
      const { data: signUpData, error: signUpErr } = await auth.signUp(email, password, fullName || profile.full_name);
      if (signUpErr) { setMessage({ type:"error", text: signUpErr.error_description || "Sign up failed." }); setSubmitting(false); return; }

      // Sign in immediately to get a token
      const { data: signInData, error: signInErr } = await auth.signIn(email, password);
      if (signInErr) {
        setMessage({ type:"success", text:"Account created! Please check your email to confirm, then sign in to claim your profile." });
        setSubmitting(false); return;
      }

      // Claim the managed profile
      const token = signInData.access_token;
      await db.claimProfile(profile.id, signInData.user.id, email, token);

      // Fetch the now-updated profile
      const { data: profiles } = await db.getProfileByAuthId(signInData.user.id, token);
      onClaimed({ ...signInData.user, profile: profiles?.[0] || {}, token });

    } else {
      // Sign in to existing account
      const { data: signInData, error: signInErr } = await auth.signIn(email, password);
      if (signInErr) { setMessage({ type:"error", text: signInErr.error_description || "Sign in failed." }); setSubmitting(false); return; }
      const token = signInData.access_token;
      // Link the managed profile to this auth account
      await db.claimProfile(profile.id, signInData.user.id, email, token);
      const { data: profiles } = await db.getProfileByAuthId(signInData.user.id, token);
      onClaimed({ ...signInData.user, profile: profiles?.[0] || {}, token });
    }
  };

  if (loading) return (
    <div className="page-centered"><FloatingBg />
      <div className="card card-pad" style={{ width:"100%", maxWidth:420, zIndex:10, textAlign:"center" }}>
        <span className="pending-emoji">⏳</span>
        <div className="pending-title">Loading…</div>
      </div>
    </div>
  );

  if (!profile && message) return (
    <div className="page-centered"><FloatingBg />
      <div className="card card-pad" style={{ width:"100%", maxWidth:420, zIndex:10, textAlign:"center" }}>
        <span className="pending-emoji">😕</span>
        <div className="pending-title">Hmm…</div>
        <div className={`msg ${message.type}`}>{message.text}</div>
      </div>
    </div>
  );

  return (
    <div className="page-centered"><FloatingBg />
      <div className="card card-pad" style={{ width:"100%", maxWidth:440, zIndex:10 }}>
        <div className="claim-hero">
          <span className="claim-emoji">🎉</span>
          <div className="claim-title">You're invited!</div>
          <div className="claim-sub">
            A profile has been created for <strong>{profile.full_name}</strong>.<br />
            Create an account (or sign in) to claim it and access your circles.
          </div>
        </div>

        <div className="tab-row">
          <button className={`tab-btn ${mode==="signup"?"active":""}`} onClick={() => { setMode("signup"); setMessage(null); }}>Create Account</button>
          <button className={`tab-btn ${mode==="signin"?"active":""}`} onClick={() => { setMode("signin"); setMessage(null); }}>I have an account</button>
        </div>

        {mode === "signup" && (
          <div className="field-wrap">
            <label className="field-label">Your Name</label>
            <input className="field-input" type="text" value={fullName} onChange={e => setFullName(e.target.value)} />
          </div>
        )}
        <div className="field-wrap">
          <label className="field-label">Email</label>
          <input className="field-input" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} />
        </div>
        <div className="field-wrap">
          <label className="field-label">Password</label>
          <input className="field-input" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key==="Enter" && handle()} />
        </div>

        <button className="btn-primary" onClick={handle} disabled={submitting}>
          {submitting ? "Just a moment…" : mode==="signup" ? "Claim my profile 🙌" : "Sign in & claim 🙌"}
        </button>
        {message && <div className={`msg ${message.type}`}>{message.text}</div>}
      </div>
    </div>
  );
}

// ─── Auth page ────────────────────────────────────────────────────────────────

function AuthPage({ onLogin }) {
  const [mode, setMode]         = useState("signin");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading]   = useState(false);
  const [message, setMessage]   = useState(null);

  const handle = async () => {
    if (!email || !password) { setMessage({ type:"error", text:"Please fill in all fields." }); return; }
    setLoading(true); setMessage(null);
    if (mode === "signin") {
      const { data, error } = await auth.signIn(email, password);
      if (error) {
        setMessage({ type:"error", text: error.error_description || error.message || "Sign in failed." });
      } else {
        const token = data.access_token;
        // Look up by auth_id (the new column), fallback to id for existing users
        const { data: byAuthId } = await db.getProfileByAuthId(data.user.id, token);
        const profile = byAuthId?.[0] || null;
        onLogin({ ...data.user, profile: profile || {}, token });
      }
    } else {
      if (!fullName) { setMessage({ type:"error", text:"Please enter your name." }); setLoading(false); return; }
      const { error } = await auth.signUp(email, password, fullName);
      if (error) {
        setMessage({ type:"error", text: error.error_description || error.message || "Sign up failed." });
      } else {
        setMessage({ type:"success", text:"🎉 Account created! Check your email to confirm, then sign in." });
        setMode("signin");
      }
    }
    setLoading(false);
  };

  return (
    <div className="page-centered">
      <FloatingBg />
      <div className="card card-pad" style={{ width:"100%", maxWidth:420, zIndex:10 }}>
        <div className="logo-ring">◦</div>
        <div className="brand-title">Circles</div>
        <div className="brand-sub">Your people, your places</div>

        <div className="tab-row">
          <button className={`tab-btn ${mode==="signin"?"active":""}`} onClick={() => { setMode("signin"); setMessage(null); }}>Sign In</button>
          <button className={`tab-btn ${mode==="signup"?"active":""}`} onClick={() => { setMode("signup"); setMessage(null); }}>Create Account</button>
        </div>

        {mode === "signup" && (
          <div className="field-wrap">
            <label className="field-label">Your Name</label>
            <input className="field-input" type="text" placeholder="e.g. Sarah Brewis" value={fullName} onChange={e => setFullName(e.target.value)} />
          </div>
        )}
        <div className="field-wrap">
          <label className="field-label">Email</label>
          <input className="field-input" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} />
        </div>
        <div className="field-wrap">
          <label className="field-label">Password</label>
          <input className="field-input" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key==="Enter" && handle()} />
        </div>

        <button className="btn-primary" onClick={handle} disabled={loading}>
          {loading ? "Loading…" : mode==="signin" ? "Sign in 🚪" : "Create account 🎉"}
        </button>
        {message && <div className={`msg ${message.type}`}>{message.text}</div>}

        <div className="tagline-strip">
          {[{l:"Family",c:P.coral},{l:"Friends",c:P.blue},{l:"Community",c:P.green},{l:"Faith",c:P.purple}].map(t => (
            <div key={t.l} className="tag-pill" style={{background:t.c}}>{t.l}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

function Dashboard({ user, onSignOut, onEnterCircle, onCreateCircle, onBrowseCircles }) {
  const [memberships, setMemberships] = useState([]);
  const [loading, setLoading]         = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await db.getMyCircles(user.profile.id, user.token);
    setMemberships(Array.isArray(data) ? data : []);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const name = user?.profile?.full_name || user?.email?.split("@")[0] || "there";

  const statusLabel = (m) => {
    if (m.status === "pending")  return <span className="status-badge status-pending">Pending</span>;
    if (m.status === "rejected") return <span className="status-badge status-rejected">Rejected</span>;
    if (m.role === "admin")      return <span className="role-badge role-admin">Admin</span>;
    return                              <span className="role-badge role-member">Member</span>;
  };

  return (
    <div className="page">
      <Navbar user={user} onSignOut={onSignOut} />
      <div className="container">
        <div className="dashboard-greeting">Hey {name}! 🏠</div>
        <div className="dashboard-sub">Your circles</div>

        <div className="action-row-cards">
          <div className="action-card" onClick={onCreateCircle}>
            <div className="action-card-icon">✨</div>
            <div className="action-card-label">Create a Circle</div>
            <div className="action-card-sub">Start a new group</div>
          </div>
          <div className="action-card" onClick={onBrowseCircles}>
            <div className="action-card-icon">🔍</div>
            <div className="action-card-label">Find a Circle</div>
            <div className="action-card-sub">Request to join</div>
          </div>
        </div>

        {loading ? (
          <EmptyState emoji="⏳" text="Loading your circles…" />
        ) : memberships.length === 0 ? (
          <EmptyState emoji="🌱" text="You're not in any circles yet — create one or find one to join!" />
        ) : (
          <div className="circles-grid">
            {memberships.map(m => (
              <div
                key={m.id} className="circle-card"
                onClick={() => m.status === "approved" && onEnterCircle(m.circle, m)}
                style={{ opacity: m.status !== "approved" ? 0.75 : 1, cursor: m.status !== "approved" ? "default" : "pointer" }}
              >
                <div className="circle-card-header" style={{ background: circleGradient(m.circle_id) }}>🏠</div>
                <div className="circle-card-body">
                  <div className="circle-card-name">{m.circle?.name || "Unnamed Circle"}</div>
                  <div className="circle-card-desc">{m.circle?.description || "No description yet"}</div>
                  <div className="circle-card-footer">
                    {statusLabel(m)}
                    {m.status === "pending" && <span style={{fontSize:".78rem",color:"#bbb",fontWeight:700}}>Awaiting approval</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Create Circle ────────────────────────────────────────────────────────────

function CreateCircle({ user, onBack, onCreated }) {
  const [name, setName]       = useState("");
  const [desc, setDesc]       = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  const handle = async () => {
    if (!name.trim()) { setMessage({ type:"error", text:"Please give your circle a name." }); return; }
    setLoading(true); setMessage(null);
    const { data: circles, error } = await db.createCircle(name.trim(), desc.trim(), user.profile.id, user.token);
    if (error || !circles?.length) {
      setMessage({ type:"error", text:"Could not create circle. Please try again." });
      setLoading(false); return;
    }
    const circle = circles[0];
    await db.addMember(circle.id, user.profile.id, "admin", "approved", "family", user.token);
    onCreated(circle);
  };

  return (
    <div className="page">
      <Navbar user={user} onSignOut={() => {}} onBack={onBack} backLabel="My Circles" />
      <div className="container" style={{ maxWidth:520 }}>
        <div className="card card-pad">
          <div style={{ fontSize:"2.5rem", textAlign:"center", marginBottom:"1rem" }}>✨</div>
          <div style={{ fontFamily:"'Fredoka One',cursive", fontSize:"1.8rem", textAlign:"center", marginBottom:".25rem", background:"linear-gradient(90deg,#FF6B6B,#C77DFF)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>
            Create a Circle
          </div>
          <div style={{ textAlign:"center", color:"#bbb", fontWeight:700, fontSize:".88rem", marginBottom:"1.75rem" }}>
            You'll be the admin — add whoever you like
          </div>

          <div className="field-wrap">
            <label className="field-label">Circle Name</label>
            <input className="field-input" type="text" placeholder="e.g. The Brewis Family" value={name} onChange={e => setName(e.target.value)} autoFocus />
          </div>
          <div className="field-wrap">
            <label className="field-label">Description (optional)</label>
            <textarea className="field-input" placeholder="What's this circle all about?" value={desc} onChange={e => setDesc(e.target.value)} />
          </div>

          <button className="btn-primary" onClick={handle} disabled={loading}>
            {loading ? "Creating…" : "Create my circle 🎉"}
          </button>
          {message && <div className={`msg ${message.type}`}>{message.text}</div>}
        </div>
      </div>
    </div>
  );
}

// ─── Browse & Join Circles ────────────────────────────────────────────────────

function BrowseCircles({ user, onBack }) {
  const [circles, setCircles]         = useState([]);
  const [memberships, setMemberships] = useState([]);
  const [search, setSearch]           = useState("");
  const [memberType, setMemberType]   = useState("friend");
  const [joining, setJoining]         = useState(null);
  const [message, setMessage]         = useState(null);
  const [loading, setLoading]         = useState(true);

  useEffect(() => {
    (async () => {
      const [{ data: c }, { data: m }] = await Promise.all([
        db.getAllCircles(user.token),
        db.getMyCircles(user.profile.id, user.token),
      ]);
      setCircles(Array.isArray(c) ? c : []);
      setMemberships(Array.isArray(m) ? m : []);
      setLoading(false);
    })();
  }, [user]);

  const myCircleIds = memberships.map(m => m.circle_id);
  const filtered = circles.filter(c =>
    !myCircleIds.includes(c.id) && c.name.toLowerCase().includes(search.toLowerCase())
  );

  const requestJoin = async (circle) => {
    setJoining(circle.id); setMessage(null);
    const { error } = await db.addMember(circle.id, user.profile.id, "member", "pending", memberType, user.token);
    if (error) {
      setMessage({ type:"error", text:"Could not send request. You may have already requested to join." });
    } else {
      setMessage({ type:"success", text:`🙌 Request sent to join "${circle.name}"! The admin will review it soon.` });
      setMemberships(prev => [...prev, { circle_id: circle.id }]);
    }
    setJoining(null);
  };

  return (
    <div className="page">
      <Navbar user={user} onSignOut={() => {}} onBack={onBack} backLabel="My Circles" />
      <div className="container" style={{ maxWidth:620 }}>
        <div style={{ fontFamily:"'Fredoka One',cursive", fontSize:"1.8rem", marginBottom:".25rem", background:"linear-gradient(90deg,#4D96FF,#6BCB77)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>
          Find a Circle 🔍
        </div>
        <div style={{ color:"#bbb", fontWeight:700, fontSize:".88rem", marginBottom:"1.5rem" }}>
          Request to join an existing circle
        </div>

        <div className="field-wrap">
          <label className="field-label">I'd like to join as…</label>
          <div className="type-row">
            <button className={`type-btn ${memberType==="family"?"selected":""}`} onClick={() => setMemberType("family")}>👨‍👩‍👧‍👦 Family</button>
            <button className={`type-btn ${memberType==="friend"?"selected":""}`} onClick={() => setMemberType("friend")}>🫶 Friend</button>
          </div>
        </div>

        <div className="search-wrap">
          <span className="search-icon">🔍</span>
          <input className="search-input" placeholder="Search circles…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        {message && <div className={`msg ${message.type}`}>{message.text}</div>}

        {loading ? (
          <EmptyState emoji="⏳" text="Loading circles…" />
        ) : filtered.length === 0 ? (
          <EmptyState emoji="🌵" text="No circles found — try a different search, or create your own!" />
        ) : (
          filtered.map(c => (
            <div key={c.id} className="browse-circle-row">
              <div className="browse-circle-icon" style={{ background: circleGradient(c.id) }}>🏠</div>
              <div>
                <div className="browse-circle-name">{c.name}</div>
                <div className="browse-circle-desc">{c.description || "No description"}</div>
              </div>
              <div className="browse-circle-actions">
                <button
                  className="btn-primary"
                  style={{ width:"auto", fontSize:".85rem", padding:".5rem 1.1rem" }}
                  disabled={joining === c.id}
                  onClick={() => requestJoin(c)}
                >
                  {joining === c.id ? "…" : "Request"}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Circle Home ──────────────────────────────────────────────────────────────

function CircleHome({ user, circle, membership, onBack, onOpenAdmin }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const isAdmin = membership?.role === "admin";

  useEffect(() => {
    (async () => {
      const { data } = await db.getCircleMembers(circle.id, user.token);
      setMembers(Array.isArray(data) ? data.filter(m => m.status === "approved") : []);
      setLoading(false);
    })();
  }, [circle.id, user.token]);

  return (
    <div className="page">
      <Navbar user={user} onSignOut={() => {}} onBack={onBack} backLabel="My Circles" />

      <div className="circle-home-hero" style={{ background: circleGradient(circle.id) }}>
        <div style={{ fontSize:"2.5rem", marginBottom:".5rem" }}>🏠</div>
        <div className="circle-home-hero-name">{circle.name}</div>
        {circle.description && <div className="circle-home-hero-desc">{circle.description}</div>}
      </div>

      <div className="container">
        {isAdmin && (
          <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:"1.5rem" }}>
            <button className="btn-secondary" onClick={onOpenAdmin}>👑 Manage Members</button>
          </div>
        )}

        <div style={{ fontFamily:"'Fredoka One',cursive", fontSize:"1.3rem", color:"#555", marginBottom:"1rem" }}>
          Members ({members.length})
        </div>

        {loading ? (
          <EmptyState emoji="⏳" text="Loading members…" />
        ) : members.length === 0 ? (
          <EmptyState emoji="👋" text="No approved members yet!" />
        ) : (
          <div className="members-grid">
            {members.map(m => {
              const isManaged = m.profile?.profile_type === "managed";
              return (
                <div key={m.id} className={`member-tile ${isManaged?"is-managed":""}`}>
                  <div className="member-avatar-lg" style={{ background: avatarBg(m.member_type) }}>
                    {isManaged ? "🧒" : avatarEmoji(m.member_type)}
                  </div>
                  <div className="member-tile-name">{m.profile?.full_name || "Unknown"}</div>
                  <span className={`role-badge ${m.role==="admin"?"role-admin":"role-member"}`}>{m.role}</span>
                  {isManaged && <div className="member-tile-sub"><span className="managed-badge">managed</span></div>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Admin Panel ──────────────────────────────────────────────────────────────

function AdminPanel({ user, circle, onBack }) {
  const [members, setMembers]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [actioning, setActioning]   = useState(null);
  const [showAddModal, setShowAdd]  = useState(false);
  const [inviteProfile, setInviteProfile] = useState(null); // profile to show invite link for

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await db.getCircleMembers(circle.id, user.token);
    setMembers(Array.isArray(data) ? data : []);
    setLoading(false);
  }, [circle.id, user.token]);

  useEffect(() => { load(); }, [load]);

  const action = async (id, type, value) => {
    setActioning(id);
    if (type === "status") await db.updateMemberStatus(id, value, user.token);
    if (type === "role")   await db.updateMemberRole(id, value, user.token);
    await load();
    setActioning(null);
  };

  const pending  = members.filter(m => m.status === "pending"  && m.profile?.profile_type !== "managed");
  const approved = members.filter(m => m.status === "approved");
  const rejected = members.filter(m => m.status === "rejected" && m.profile?.profile_type !== "managed");

  const MemberRow = ({ m, showActions }) => {
    const isManaged = m.profile?.profile_type === "managed";
    return (
      <div className={`member-row ${isManaged?"is-managed":""}`}>
        <div className="member-row-info">
          <div className="member-avatar-sm" style={{ background: avatarBg(m.member_type) }}>
            {isManaged ? "🧒" : avatarEmoji(m.member_type)}
          </div>
          <div>
            <div className="member-row-name">
              {m.profile?.full_name || "Unknown"}
              <span className="tag-pill" style={{ background: m.member_type==="family"?P.blue:P.orange, fontSize:".68rem" }}>
                {m.member_type}
              </span>
              {isManaged && <span className="managed-badge">managed</span>}
            </div>
            <div className="member-row-email">
              {isManaged ? (m.profile?.invite_email || "No invite email set") : m.profile?.email}
            </div>
          </div>
        </div>

        <div className="member-row-actions">
          {showActions && !isManaged && (
            <>
              <button className="btn-approve" disabled={actioning===m.id} onClick={() => action(m.id,"status","approved")}>
                {actioning===m.id?"…":"✓ Approve"}
              </button>
              <button className="btn-reject" disabled={actioning===m.id} onClick={() => action(m.id,"status","rejected")}>
                Reject
              </button>
            </>
          )}

          {!showActions && m.status === "approved" && !isManaged && (
            <>
              <span className={`role-badge ${m.role==="admin"?"role-admin":"role-member"}`}>{m.role}</span>
              <button className="btn-ghost" disabled={actioning===m.id} onClick={() => action(m.id,"role", m.role==="admin"?"member":"admin")}>
                {actioning===m.id?"…": m.role==="admin"?"Remove admin":"Make admin"}
              </button>
            </>
          )}

          {m.status === "approved" && isManaged && (
            <button
              className="btn-invite"
              onClick={() => setInviteProfile(m.profile)}
            >
              🔗 Invite to join
            </button>
          )}

          {m.status === "rejected" && !isManaged && (
            <span className="status-badge status-rejected">Rejected</span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="page">
      <Navbar user={user} onSignOut={() => {}} onBack={onBack} backLabel={circle.name} />
      <div className="container" style={{ maxWidth:700 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:"1rem", marginBottom:"1.5rem" }}>
          <div>
            <div style={{ fontFamily:"'Fredoka One',cursive", fontSize:"1.8rem", background:"linear-gradient(90deg,#FF6B6B,#C77DFF)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>
              👑 Manage Members
            </div>
            <div style={{ color:"#bbb", fontWeight:700, fontSize:".88rem" }}>{circle.name}</div>
          </div>
          <button className="btn-secondary" onClick={() => setShowAdd(true)}>
            ➕ Add managed member
          </button>
        </div>

        {loading ? <EmptyState emoji="⏳" text="Loading…" /> : (
          <>
            {pending.length > 0 && (
              <>
                <div className="admin-section-label">⏳ Pending approval ({pending.length})</div>
                {pending.map(m => <MemberRow key={m.id} m={m} showActions />)}
              </>
            )}
            {pending.length === 0 && approved.length === 0 && rejected.length === 0 && (
              <EmptyState emoji="🌱" text="No members yet — approve requests or add managed members above." />
            )}

            {approved.length > 0 && (
              <>
                <div className="admin-section-label">✅ Members ({approved.length})</div>
                {approved.map(m => <MemberRow key={m.id} m={m} showActions={false} />)}
              </>
            )}

            {rejected.length > 0 && (
              <>
                <div className="admin-section-label">✗ Rejected ({rejected.length})</div>
                {rejected.map(m => <MemberRow key={m.id} m={m} showActions={false} />)}
              </>
            )}
          </>
        )}
      </div>

      {showAddModal && (
        <AddManagedMemberModal
          user={user}
          circle={circle}
          onClose={() => setShowAdd(false)}
          onAdded={(profile) => {
            setShowAdd(false);
            load();
            setInviteProfile(profile); // immediately offer invite link
          }}
        />
      )}

      {inviteProfile && (
        <InviteLinkModal
          profile={inviteProfile}
          onClose={() => setInviteProfile(null)}
        />
      )}
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function App() {
  const [session, setSession]               = useState(null);
  const [screen, setScreen]                 = useState("dashboard");
  const [activeCircle, setActiveCircle]     = useState(null);
  const [activeMembership, setActiveMembership] = useState(null);

  // Check for invite token in URL on mount
  const [inviteToken, setInviteToken] = useState(null);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("invite");
    if (token) setInviteToken(token);
  }, []);

  const signOut = () => { setSession(null); setScreen("dashboard"); };

  const go = (s, circle = null, membership = null) => {
    setScreen(s);
    if (circle)     setActiveCircle(circle);
    if (membership) setActiveMembership(membership);
  };

  // Invite / claim flow — shown before auth
  if (inviteToken && !session) {
    return (
      <>
        <style>{styles}</style>
        <ClaimProfileScreen
          inviteToken={inviteToken}
          onClaimed={(sess) => {
            // Clear the invite token from URL
            window.history.replaceState({}, "", window.location.pathname);
            setInviteToken(null);
            setSession(sess);
          }}
        />
      </>
    );
  }

  if (!session) return <><style>{styles}</style><AuthPage onLogin={setSession} /></>;

  const render = () => {
    switch (screen) {
      case "create":
        return <CreateCircle user={session} onBack={() => go("dashboard")} onCreated={(c) => go("circle", c, { role:"admin", status:"approved" })} />;
      case "browse":
        return <BrowseCircles user={session} onBack={() => go("dashboard")} />;
      case "circle":
        return <CircleHome user={session} circle={activeCircle} membership={activeMembership} onBack={() => go("dashboard")} onOpenAdmin={() => go("admin", activeCircle)} />;
      case "admin":
        return <AdminPanel user={session} circle={activeCircle} onBack={() => go("circle", activeCircle, activeMembership)} />;
      default:
        return <Dashboard user={session} onSignOut={signOut} onEnterCircle={(c, m) => go("circle", c, m)} onCreateCircle={() => go("create")} onBrowseCircles={() => go("browse")} />;
    }
  };

  return <><style>{styles}</style>{render()}</>;
}
