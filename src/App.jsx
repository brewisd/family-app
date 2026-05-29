import { useState, useEffect, useCallback } from "react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// ─── Supabase helpers ─────────────────────────────────────────────────────────

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
  getProfile: (userId, token) =>
    sbFetch(`/rest/v1/profiles?id=eq.${userId}&select=*`, { method: "GET" }, token),

  getProfileByAuthId: (authId, token) =>
    sbFetch(`/rest/v1/profiles?auth_id=eq.${authId}&select=*`, { method: "GET" }, token),

  getProfileByInviteToken: (tok, token) =>
    sbFetch(`/rest/v1/profiles?invite_token=eq.${tok}&select=*`, { method: "GET" }, token),

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

  claimProfile: (profileId, authId, email, token) =>
    sbFetch(`/rest/v1/profiles?id=eq.${profileId}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ auth_id: authId, email, profile_type: "user" }),
    }, token),

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

// ─── Theme ────────────────────────────────────────────────────────────────────

const T = {
  teal:       "#0D4F4F",
  tealDark:   "#0A3D3D",
  tealMid:    "#1A7070",
  tealLight:  "#E8F4F4",
  tealFaint:  "#F0F5F5",
  tealText:   "#7DDDD0",
  tealMuted:  "#5BBFB5",
  coral:      "#FF6B4A",
  coralLight: "#FFF0EC",
  coralDark:  "#CC4422",
  white:      "#FFFFFF",
  ink:        "#0A2E2E",
  inkMid:     "#2E5555",
  border:     "#D8EAEA",
  borderMid:  "#B8D8D8",
  muted:      "#7AAAA8",
  surface:    "#FFFFFF",
};

// ─── Global styles ────────────────────────────────────────────────────────────

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: 'Inter', system-ui, sans-serif;
    background: ${T.tealFaint};
    min-height: 100vh;
    color: ${T.ink};
    -webkit-font-smoothing: antialiased;
  }

  /* ── Page shell ── */
  .app { min-height: 100vh; display: flex; flex-direction: column; }

  /* ── Header ── */
  .header {
    background: ${T.teal};
    position: sticky; top: 0; z-index: 100;
  }

  .header-top {
    display: flex; align-items: center; justify-content: space-between;
    padding: 0 28px; height: 56px;
  }

  .header-brand {
    font-size: 17px; font-weight: 600;
    letter-spacing: 0.06em; color: ${T.white};
    text-transform: uppercase;
  }

  .header-right { display: flex; align-items: center; gap: 16px; }

  .header-avatar {
    width: 32px; height: 32px; border-radius: 50%;
    background: ${T.tealMid}; display: flex; align-items: center;
    justify-content: center; font-size: 12px; font-weight: 600;
    color: ${T.tealText}; letter-spacing: 0.04em; flex-shrink: 0;
  }

  .header-signout {
    font-size: 13px; color: ${T.tealMuted}; background: none;
    border: none; cursor: pointer; padding: 4px 0;
    transition: color 0.15s;
  }
  .header-signout:hover { color: ${T.white}; }

  /* ── Tab bar ── */
  .tab-bar {
    background: ${T.tealDark};
    display: flex; gap: 0; padding: 0 28px;
    border-top: 1px solid rgba(255,255,255,0.06);
  }

  .tab {
    font-size: 13px; font-weight: 500; color: ${T.tealMuted};
    padding: 10px 16px; border: none; background: none;
    cursor: pointer; border-bottom: 2px solid transparent;
    transition: color 0.15s, border-color 0.15s;
    white-space: nowrap;
  }

  .tab:hover { color: ${T.white}; }
  .tab.active { color: ${T.white}; border-bottom-color: ${T.coral}; }

  /* ── Content ── */
  .content { flex: 1; max-width: 720px; margin: 0 auto; padding: 28px 24px; width: 100%; }

  /* ── Section headings ── */
  .section-title {
    font-size: 13px; font-weight: 600; color: ${T.muted};
    text-transform: uppercase; letter-spacing: 0.08em;
    margin-bottom: 12px; margin-top: 24px;
  }
  .section-title:first-child { margin-top: 0; }

  /* ── List items ── */
  .list-item {
    background: ${T.surface}; border: 1px solid ${T.border};
    border-radius: 10px; padding: 14px 18px;
    display: flex; align-items: center; gap: 14px;
    margin-bottom: 8px; transition: border-color 0.15s;
  }
  .list-item:hover { border-color: ${T.borderMid}; }
  .list-item.clickable { cursor: pointer; }
  .list-item.clickable:hover { border-color: ${T.tealMid}; }
  .list-item.dashed { border-style: dashed; background: transparent; }
  .list-item.dashed:hover { border-color: ${T.tealMid}; background: ${T.tealLight}; }

  .list-icon {
    width: 40px; height: 40px; border-radius: 9px;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }
  .list-icon svg { width: 18px; height: 18px; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; fill: none; }

  .list-icon.teal { background: ${T.teal}; }
  .list-icon.teal svg { stroke: ${T.tealText}; }
  .list-icon.light { background: ${T.tealLight}; }
  .list-icon.light svg { stroke: ${T.teal}; }
  .list-icon.coral { background: ${T.coralLight}; }
  .list-icon.coral svg { stroke: ${T.coral}; }
  .list-icon.managed { background: #F5F0FF; }
  .list-icon.managed svg { stroke: #7C3AED; }

  .list-body { flex: 1; min-width: 0; }
  .list-name { font-size: 14px; font-weight: 500; color: ${T.ink}; margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .list-sub  { font-size: 12px; color: ${T.muted}; }
  .list-right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; flex-wrap: wrap; justify-content: flex-end; }

  /* ── Badges ── */
  .badge {
    font-size: 11px; font-weight: 600; padding: 3px 9px;
    border-radius: 999px; letter-spacing: 0.03em; white-space: nowrap;
  }
  .badge-admin    { background: ${T.teal};       color: ${T.tealText}; }
  .badge-member   { background: ${T.tealLight};  color: ${T.teal}; }
  .badge-pending  { background: ${T.coralLight}; color: ${T.coralDark}; }
  .badge-rejected { background: #FEF2F2;          color: #991B1B; }
  .badge-managed  { background: #F5F0FF;          color: #6D28D9; border: 1px solid #DDD6FE; }
  .badge-family   { background: ${T.tealLight};  color: ${T.teal}; }
  .badge-friend   { background: #FFF7ED;          color: #92400E; }

  /* ── Buttons ── */
  .btn-primary {
    background: ${T.coral}; color: ${T.white};
    border: none; border-radius: 8px; padding: 9px 20px;
    font-family: inherit; font-size: 13px; font-weight: 600;
    cursor: pointer; transition: background 0.15s, transform 0.1s;
    white-space: nowrap;
  }
  .btn-primary:hover:not(:disabled) { background: ${T.coralDark}; }
  .btn-primary:active:not(:disabled) { transform: scale(0.98); }
  .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

  .btn-secondary {
    background: transparent; color: ${T.teal};
    border: 1px solid ${T.border}; border-radius: 8px; padding: 8px 16px;
    font-family: inherit; font-size: 13px; font-weight: 500;
    cursor: pointer; transition: all 0.15s;
  }
  .btn-secondary:hover { border-color: ${T.teal}; background: ${T.tealLight}; }
  .btn-secondary:disabled { opacity: 0.5; cursor: not-allowed; }

  .btn-ghost {
    background: transparent; border: none;
    color: ${T.muted}; font-family: inherit; font-size: 12px;
    font-weight: 500; cursor: pointer; padding: 6px 10px;
    border-radius: 6px; transition: all 0.15s;
  }
  .btn-ghost:hover:not(:disabled) { background: ${T.tealLight}; color: ${T.teal}; }
  .btn-ghost:disabled { opacity: 0.4; cursor: not-allowed; }

  .btn-approve {
    background: ${T.teal}; color: ${T.white};
    border: none; border-radius: 7px; padding: 6px 14px;
    font-family: inherit; font-size: 12px; font-weight: 600;
    cursor: pointer; transition: background 0.15s;
  }
  .btn-approve:hover:not(:disabled) { background: ${T.tealMid}; }
  .btn-approve:disabled { opacity: 0.5; cursor: not-allowed; }

  .btn-reject {
    background: transparent; color: ${T.coralDark};
    border: 1px solid #FECACA; border-radius: 7px; padding: 6px 14px;
    font-family: inherit; font-size: 12px; font-weight: 600;
    cursor: pointer; transition: all 0.15s;
  }
  .btn-reject:hover:not(:disabled) { background: ${T.coralLight}; }
  .btn-reject:disabled { opacity: 0.5; cursor: not-allowed; }

  .btn-invite {
    background: transparent; color: #7C3AED;
    border: 1px solid #DDD6FE; border-radius: 7px; padding: 6px 12px;
    font-family: inherit; font-size: 12px; font-weight: 600;
    cursor: pointer; transition: all 0.15s; white-space: nowrap;
  }
  .btn-invite:hover { background: #F5F0FF; }
  .btn-invite.copied { border-color: #6BCB77; color: #276749; background: #f0fff4; }

  /* ── Forms ── */
  .field { margin-bottom: 16px; }
  .field-label {
    display: block; font-size: 12px; font-weight: 600;
    color: ${T.inkMid}; text-transform: uppercase;
    letter-spacing: 0.06em; margin-bottom: 6px;
  }
  .field-input {
    width: 100%; border: 1px solid ${T.border};
    border-radius: 8px; padding: 9px 12px;
    font-family: inherit; font-size: 14px; font-weight: 400;
    color: ${T.ink}; background: ${T.white};
    outline: none; transition: border-color 0.15s, box-shadow 0.15s;
  }
  .field-input:focus {
    border-color: ${T.teal};
    box-shadow: 0 0 0 3px rgba(13,79,79,0.12);
  }
  textarea.field-input { resize: vertical; min-height: 80px; }

  .field-hint { font-size: 12px; color: ${T.muted}; margin-top: 5px; }

  /* ── Type selector ── */
  .type-row { display: flex; gap: 8px; }
  .type-btn {
    flex: 1; border: 1px solid ${T.border}; border-radius: 8px;
    padding: 8px 12px; font-family: inherit; font-size: 13px;
    font-weight: 500; cursor: pointer; background: ${T.white};
    color: ${T.muted}; transition: all 0.15s; text-align: center;
  }
  .type-btn:hover { border-color: ${T.tealMid}; color: ${T.teal}; }
  .type-btn.selected { border-color: ${T.teal}; background: ${T.tealLight}; color: ${T.teal}; }

  /* ── Messages ── */
  .msg {
    padding: 10px 14px; border-radius: 8px;
    font-size: 13px; font-weight: 500; margin-top: 12px; line-height: 1.5;
  }
  .msg.error   { background: ${T.coralLight}; color: ${T.coralDark}; }
  .msg.success { background: ${T.tealLight};  color: ${T.teal}; }
  .msg.info    { background: #EFF6FF; color: #1E40AF; }

  /* ── Auth page ── */
  .auth-wrap {
    min-height: 100vh; display: flex; align-items: center;
    justify-content: center; background: ${T.tealFaint}; padding: 24px;
  }
  .auth-card {
    background: ${T.white}; border: 1px solid ${T.border};
    border-radius: 14px; padding: 36px 32px;
    width: 100%; max-width: 400px;
  }
  .auth-logo-wrap { margin-bottom: 28px; }
  .auth-logo {
    font-size: 20px; font-weight: 700; color: ${T.teal};
    letter-spacing: 0.08em; text-transform: uppercase;
    display: block; margin-bottom: 6px;
  }
  .auth-tagline { font-size: 13px; color: ${T.muted}; }

  .auth-tabs {
    display: flex; gap: 0; margin-bottom: 24px;
    border-bottom: 1px solid ${T.border};
  }
  .auth-tab {
    flex: 1; padding: 10px; font-family: inherit; font-size: 13px;
    font-weight: 500; color: ${T.muted}; background: none; border: none;
    border-bottom: 2px solid transparent; margin-bottom: -1px;
    cursor: pointer; transition: color 0.15s, border-color 0.15s;
  }
  .auth-tab.active { color: ${T.teal}; border-bottom-color: ${T.coral}; }

  /* ── Empty state ── */
  .empty {
    text-align: center; padding: 48px 24px;
    color: ${T.muted}; font-size: 14px; font-weight: 500;
  }
  .empty-icon {
    width: 48px; height: 48px; border-radius: 12px;
    background: ${T.tealLight}; margin: 0 auto 14px;
    display: flex; align-items: center; justify-content: center;
  }
  .empty-icon svg { width: 22px; height: 22px; stroke: ${T.teal}; stroke-width: 1.8; fill: none; }

  /* ── Circle hero ── */
  .circle-hero {
    background: ${T.teal}; padding: 24px 28px;
    border-bottom: 1px solid ${T.tealDark};
  }
  .circle-hero-name { font-size: 20px; font-weight: 600; color: ${T.white}; margin-bottom: 4px; }
  .circle-hero-desc { font-size: 13px; color: ${T.tealMuted}; }
  .circle-hero-meta { font-size: 12px; color: ${T.tealMuted}; margin-top: 10px; }

  /* ── Modal ── */
  .modal-backdrop {
    position: fixed; inset: 0; background: rgba(10,46,46,0.45);
    z-index: 200; display: flex; align-items: center;
    justify-content: center; padding: 24px;
  }
  .modal {
    background: ${T.white}; border-radius: 14px; padding: 28px;
    width: 100%; max-width: 420px;
    box-shadow: 0 20px 48px rgba(10,46,46,0.2);
    animation: modalIn 0.2s ease;
  }
  @keyframes modalIn { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
  .modal-title { font-size: 16px; font-weight: 600; color: ${T.ink}; margin-bottom: 4px; }
  .modal-sub   { font-size: 13px; color: ${T.muted}; margin-bottom: 20px; line-height: 1.5; }
  .modal-footer { display: flex; gap: 10px; margin-top: 20px; }
  .modal-footer .btn-primary { flex: 2; }
  .modal-footer .btn-secondary { flex: 1; }

  /* ── Invite box ── */
  .invite-box {
    background: ${T.tealFaint}; border: 1px solid ${T.border};
    border-radius: 8px; padding: 10px 12px;
    font-size: 12px; color: ${T.inkMid}; word-break: break-all;
    line-height: 1.5; margin-bottom: 10px; font-family: monospace;
  }

  /* ── Claim screen ── */
  .claim-header {
    background: ${T.teal}; padding: 32px 28px 28px;
    border-radius: 14px 14px 0 0;
  }
  .claim-title { font-size: 20px; font-weight: 600; color: ${T.white}; margin-bottom: 6px; }
  .claim-sub   { font-size: 13px; color: ${T.tealMuted}; line-height: 1.5; }
  .claim-body  { padding: 24px 28px; }

  /* ── Loading ── */
  @keyframes spin { to { transform: rotate(360deg); } }
  .spinner {
    width: 18px; height: 18px; border: 2px solid ${T.border};
    border-top-color: ${T.teal}; border-radius: 50%;
    animation: spin 0.7s linear infinite; margin: 40px auto;
  }

  /* ── Divider ── */
  .divider {
    border: none; border-top: 1px solid ${T.border};
    margin: 20px 0;
  }

  /* ── Search ── */
  .search-wrap { position: relative; margin-bottom: 16px; }
  .search-icon {
    position: absolute; left: 11px; top: 50%; transform: translateY(-50%);
    pointer-events: none;
  }
  .search-icon svg { width: 15px; height: 15px; stroke: ${T.muted}; stroke-width: 2; fill: none; }
  .search-input {
    width: 100%; border: 1px solid ${T.border}; border-radius: 8px;
    padding: 9px 12px 9px 34px; font-family: inherit; font-size: 14px;
    color: ${T.ink}; background: ${T.white}; outline: none;
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  .search-input:focus { border-color: ${T.teal}; box-shadow: 0 0 0 3px rgba(13,79,79,0.12); }

  /* ── Page header row ── */
  .page-header {
    display: flex; align-items: center; justify-content: space-between;
    flex-wrap: wrap; gap: 12px; margin-bottom: 20px;
  }
  .page-title { font-size: 16px; font-weight: 600; color: ${T.ink}; }

  /* ── Animations ── */
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .fade-up { animation: fadeUp 0.3s ease both; }

  @media (max-width: 520px) {
    .header-top { padding: 0 16px; }
    .tab-bar { padding: 0 16px; }
    .content { padding: 20px 16px; }
    .circle-hero { padding: 20px 16px; }
    .auth-card { padding: 28px 20px; }
    .modal { padding: 24px 20px; }
  }
`;

// ─── SVG icons (no emoji) ─────────────────────────────────────────────────────

const Icon = {
  users: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  user: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>,
  plus: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  search: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  link: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>,
  chevronRight: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>,
  key: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m21 2-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>,
  settings: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  copy: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>,
  check: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  circle: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/></svg>,
  arrowLeft: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const initials = (name) => {
  if (!name) return "?";
  const parts = name.trim().split(" ");
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
};

// ─── Shared UI ────────────────────────────────────────────────────────────────

function Spinner() { return <div className="spinner" />; }

function EmptyState({ icon, text }) {
  return (
    <div className="empty fade-up">
      <div className="empty-icon">{icon}</div>
      {text}
    </div>
  );
}

function Msg({ msg }) {
  if (!msg) return null;
  return <div className={`msg ${msg.type}`}>{msg.text}</div>;
}

// ─── App shell ────────────────────────────────────────────────────────────────

function AppShell({ user, onSignOut, tabs, activeTab, onTabChange, children }) {
  const name = user?.profile?.full_name || user?.email?.split("@")[0] || "?";
  return (
    <div className="app">
      <header className="header">
        <div className="header-top">
          <span className="header-brand">Circles</span>
          <div className="header-right">
            <div className="header-avatar">{initials(name)}</div>
            {onSignOut && (
              <button className="header-signout" onClick={onSignOut}>Sign out</button>
            )}
          </div>
        </div>
        {tabs && (
          <div className="tab-bar">
            {tabs.map(t => (
              <button
                key={t.id}
                className={`tab ${activeTab === t.id ? "active" : ""}`}
                onClick={() => onTabChange(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}
      </header>
      <div className="content">{children}</div>
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
  const [msg, setMsg]           = useState(null);

  const handle = async () => {
    if (!email || !password) { setMsg({ type:"error", text:"Please fill in all fields." }); return; }
    setLoading(true); setMsg(null);

    if (mode === "signin") {
      const { data, error } = await auth.signIn(email, password);
      if (error) {
        setMsg({ type:"error", text: error.error_description || error.message || "Sign in failed." });
      } else {
        const token = data.access_token;
        let profile = null;
        const { data: byAuthId } = await db.getProfileByAuthId(data.user.id, token);
        if (byAuthId?.[0]) {
          profile = byAuthId[0];
        } else {
          const { data: byId } = await db.getProfile(data.user.id, token);
          profile = byId?.[0] || null;
          if (profile) {
            await sbFetch(`/rest/v1/profiles?id=eq.${profile.id}`, {
              method: "PATCH",
              headers: { Prefer: "return=representation" },
              body: JSON.stringify({ auth_id: data.user.id }),
            }, token);
          }
        }
        if (!profile) { setMsg({ type:"error", text:"Could not load profile. Please try again." }); setLoading(false); return; }
        onLogin({ ...data.user, profile, token });
      }
    } else {
      if (!fullName) { setMsg({ type:"error", text:"Please enter your name." }); setLoading(false); return; }
      const { error } = await auth.signUp(email, password, fullName);
      if (error) {
        setMsg({ type:"error", text: error.error_description || error.message || "Sign up failed." });
      } else {
        setMsg({ type:"success", text:"Account created. Check your email to confirm, then sign in." });
        setMode("signin");
      }
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

        {mode === "signup" && (
          <div className="field">
            <label className="field-label">Full name</label>
            <input className="field-input" type="text" placeholder="Your name" value={fullName} onChange={e => setFullName(e.target.value)} />
          </div>
        )}
        <div className="field">
          <label className="field-label">Email</label>
          <input className="field-input" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} />
        </div>
        <div className="field">
          <label className="field-label">Password</label>
          <input className="field-input" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && handle()} />
        </div>

        <button className="btn-primary" style={{ width:"100%", marginTop:4 }} onClick={handle} disabled={loading}>
          {loading ? "Just a moment…" : mode === "signin" ? "Sign in" : "Create account"}
        </button>
        <Msg msg={msg} />
      </div>
    </div>
  );
}

// ─── Claim profile screen (invite flow) ───────────────────────────────────────

function ClaimProfileScreen({ inviteToken, onClaimed }) {
  const [profile, setProfile]     = useState(null);
  const [loading, setLoading]     = useState(true);
  const [mode, setMode]           = useState("signup");
  const [fullName, setFullName]   = useState("");
  const [email, setEmail]         = useState("");
  const [password, setPassword]   = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg]             = useState(null);

  useEffect(() => {
    (async () => {
      const { data } = await db.getProfileByInviteToken(inviteToken, null);
      if (data?.length) {
        setProfile(data[0]);
        setFullName(data[0].full_name || "");
        setEmail(data[0].invite_email || "");
      } else {
        setMsg({ type:"error", text:"This invite link is invalid or has already been used." });
      }
      setLoading(false);
    })();
  }, [inviteToken]);

  const handle = async () => {
    if (!email || !password) { setMsg({ type:"error", text:"Please fill in all fields." }); return; }
    setSubmitting(true); setMsg(null);

    if (mode === "signup") {
      const { error: signUpErr } = await auth.signUp(email, password, fullName || profile.full_name);
      if (signUpErr) { setMsg({ type:"error", text: signUpErr.error_description || "Sign up failed." }); setSubmitting(false); return; }
      const { data: signInData, error: signInErr } = await auth.signIn(email, password);
      if (signInErr) {
        setMsg({ type:"success", text:"Account created. Check your email to confirm, then sign in to claim your profile." });
        setSubmitting(false); return;
      }
      const token = signInData.access_token;
      await db.claimProfile(profile.id, signInData.user.id, email, token);
      const { data: profiles } = await db.getProfileByAuthId(signInData.user.id, token);
      onClaimed({ ...signInData.user, profile: profiles?.[0] || {}, token });
    } else {
      const { data: signInData, error: signInErr } = await auth.signIn(email, password);
      if (signInErr) { setMsg({ type:"error", text: signInErr.error_description || "Sign in failed." }); setSubmitting(false); return; }
      const token = signInData.access_token;
      await db.claimProfile(profile.id, signInData.user.id, email, token);
      const { data: profiles } = await db.getProfileByAuthId(signInData.user.id, token);
      onClaimed({ ...signInData.user, profile: profiles?.[0] || {}, token });
    }
  };

  if (loading) return <div className="auth-wrap"><Spinner /></div>;

  if (!profile) return (
    <div className="auth-wrap">
      <div className="auth-card fade-up">
        <span className="auth-logo">Circles</span>
        <Msg msg={msg} />
      </div>
    </div>
  );

  return (
    <div className="auth-wrap">
      <div className="auth-card fade-up" style={{ padding:0, overflow:"hidden" }}>
        <div className="claim-header">
          <div className="claim-title">You've been invited</div>
          <div className="claim-sub">A profile exists for <strong style={{color:T.white}}>{profile.full_name}</strong>. Create an account or sign in to claim it.</div>
        </div>
        <div className="claim-body">
          <div className="auth-tabs">
            <button className={`auth-tab ${mode==="signup"?"active":""}`} onClick={() => { setMode("signup"); setMsg(null); }}>Create account</button>
            <button className={`auth-tab ${mode==="signin"?"active":""}`} onClick={() => { setMode("signin"); setMsg(null); }}>I have an account</button>
          </div>
          {mode === "signup" && (
            <div className="field">
              <label className="field-label">Full name</label>
              <input className="field-input" type="text" value={fullName} onChange={e => setFullName(e.target.value)} />
            </div>
          )}
          <div className="field">
            <label className="field-label">Email</label>
            <input className="field-input" type="email" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div className="field">
            <label className="field-label">Password</label>
            <input className="field-input" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && handle()} />
          </div>
          <button className="btn-primary" style={{ width:"100%" }} onClick={handle} disabled={submitting}>
            {submitting ? "Just a moment…" : mode === "signup" ? "Claim my profile" : "Sign in and claim"}
          </button>
          <Msg msg={msg} />
        </div>
      </div>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

const DASH_TABS = [
  { id: "circles",  label: "My circles" },
  { id: "discover", label: "Discover" },
];

function Dashboard({ user, onSignOut, onEnterCircle, onCreateCircle }) {
  const [tab, setTab]               = useState("circles");
  const [memberships, setMemberships] = useState([]);
  const [allCircles, setAllCircles] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState("");
  const [memberType, setMemberType] = useState("friend");
  const [joining, setJoining]       = useState(null);
  const [joinMsg, setJoinMsg]       = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: m }, { data: c }] = await Promise.all([
      db.getMyCircles(user.profile.id, user.token),
      db.getAllCircles(user.token),
    ]);
    setMemberships(Array.isArray(m) ? m : []);
    setAllCircles(Array.isArray(c) ? c : []);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const myCircleIds = memberships.map(m => m.circle_id);

  const filteredDiscover = allCircles.filter(c =>
    !myCircleIds.includes(c.id) &&
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const requestJoin = async (circle) => {
    setJoining(circle.id); setJoinMsg(null);
    const { error } = await db.addMember(circle.id, user.profile.id, "member", "pending", memberType, user.token);
    if (error) {
      setJoinMsg({ type:"error", text:"Could not send request. You may have already requested to join this circle." });
    } else {
      setJoinMsg({ type:"success", text:`Request sent to join "${circle.name}". An admin will review it soon.` });
      setMemberships(prev => [...prev, { circle_id: circle.id, status:"pending" }]);
    }
    setJoining(null);
  };

  const statusBadge = (m) => {
    if (m.status === "pending")  return <span className="badge badge-pending">Pending</span>;
    if (m.status === "rejected") return <span className="badge badge-rejected">Rejected</span>;
    if (m.role === "admin")      return <span className="badge badge-admin">Admin</span>;
    return                              <span className="badge badge-member">Member</span>;
  };

  return (
    <AppShell user={user} onSignOut={onSignOut} tabs={DASH_TABS} activeTab={tab} onTabChange={t => { setTab(t); setJoinMsg(null); }}>
      {tab === "circles" && (
        <>
          <div className="page-header">
            <div className="page-title">Your circles</div>
            <button className="btn-primary" onClick={onCreateCircle}>New circle</button>
          </div>

          {loading ? <Spinner /> : memberships.length === 0 ? (
            <EmptyState icon={Icon.circle} text="You're not in any circles yet. Create one or discover existing circles." />
          ) : (
            <div className="fade-up">
              {memberships.map(m => (
                <div
                  key={m.id}
                  className={`list-item ${m.status === "approved" ? "clickable" : ""}`}
                  onClick={() => m.status === "approved" && onEnterCircle(m.circle, m)}
                >
                  <div className={`list-icon ${m.role === "admin" ? "teal" : "light"}`}>
                    {Icon.users}
                  </div>
                  <div className="list-body">
                    <div className="list-name">{m.circle?.name || "Unnamed circle"}</div>
                    <div className="list-sub">{m.circle?.description || "No description"}</div>
                  </div>
                  <div className="list-right">
                    {statusBadge(m)}
                    {m.status === "approved" && <span style={{color:T.muted,display:"flex",alignItems:"center"}}>{Icon.chevronRight}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === "discover" && (
        <>
          <div className="page-header">
            <div className="page-title">Find a circle</div>
          </div>

          <div className="field" style={{marginBottom:12}}>
            <label className="field-label">Joining as</label>
            <div className="type-row">
              <button className={`type-btn ${memberType==="family"?"selected":""}`} onClick={() => setMemberType("family")}>Family</button>
              <button className={`type-btn ${memberType==="friend"?"selected":""}`} onClick={() => setMemberType("friend")}>Friend</button>
            </div>
          </div>

          <div className="search-wrap">
            <div className="search-icon">{Icon.search}</div>
            <input className="search-input" placeholder="Search circles…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>

          <Msg msg={joinMsg} />

          {loading ? <Spinner /> : filteredDiscover.length === 0 ? (
            <EmptyState icon={Icon.search} text="No circles found. Try a different search or create your own." />
          ) : (
            <div className="fade-up">
              {filteredDiscover.map(c => (
                <div key={c.id} className="list-item">
                  <div className="list-icon light">{Icon.users}</div>
                  <div className="list-body">
                    <div className="list-name">{c.name}</div>
                    <div className="list-sub">{c.description || "No description"}</div>
                  </div>
                  <div className="list-right">
                    <button
                      className="btn-primary"
                      style={{padding:"6px 14px",fontSize:12}}
                      disabled={joining === c.id}
                      onClick={() => requestJoin(c)}
                    >
                      {joining === c.id ? "Sending…" : "Request"}
                    </button>
                  </div>
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
  const [name, setName]   = useState("");
  const [desc, setDesc]   = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg]     = useState(null);

  const handle = async () => {
    if (!name.trim()) { setMsg({ type:"error", text:"Please give your circle a name." }); return; }
    if (!user?.profile?.id) { setMsg({ type:"error", text:"Session error — please sign out and back in." }); return; }
    setLoading(true); setMsg(null);
    const { data: circles, error } = await db.createCircle(name.trim(), desc.trim(), user.profile.id, user.token);
    if (error || !circles?.length) {
      const detail = error?.message || error?.details || JSON.stringify(error);
      setMsg({ type:"error", text:`Could not create circle: ${detail}` });
      setLoading(false); return;
    }
    const circle = circles[0];
    const { error: memberErr } = await db.addMember(circle.id, user.profile.id, "admin", "approved", "family", user.token);
    if (memberErr) {
      setMsg({ type:"error", text:`Circle created but could not add you as admin: ${memberErr?.message || JSON.stringify(memberErr)}` });
      setLoading(false); return;
    }
    onCreated(circle);
  };

  return (
    <AppShell user={user} onSignOut={null}>
      <button className="btn-ghost" style={{marginBottom:16,display:"flex",alignItems:"center",gap:6}} onClick={onBack}>
        <span style={{display:"flex"}}>{Icon.arrowLeft}</span> My circles
      </button>
      <div className="page-header">
        <div className="page-title">Create a circle</div>
      </div>
      <div style={{maxWidth:480}}>
        <div className="field">
          <label className="field-label">Circle name</label>
          <input className="field-input" type="text" placeholder="e.g. The Brewis Family" value={name} onChange={e => setName(e.target.value)} autoFocus />
        </div>
        <div className="field">
          <label className="field-label">Description <span style={{textTransform:"none",fontWeight:400,color:T.muted}}>(optional)</span></label>
          <textarea className="field-input" placeholder="What is this circle about?" value={desc} onChange={e => setDesc(e.target.value)} />
        </div>
        <div style={{fontSize:12,color:T.muted,marginBottom:20,lineHeight:1.5}}>
          You will be set as admin. You can add members and approve requests from the circle page.
        </div>
        <button className="btn-primary" onClick={handle} disabled={loading}>
          {loading ? "Creating…" : "Create circle"}
        </button>
        <Msg msg={msg} />
      </div>
    </AppShell>
  );
}

// ─── Circle Home ──────────────────────────────────────────────────────────────

const CIRCLE_TABS = [
  { id: "members", label: "Members" },
  { id: "manage",  label: "Manage" },
];

function CircleHome({ user, circle, membership, onBack }) {
  const isAdmin = membership?.role === "admin";
  const [tab, setTab]       = useState("members");
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [inviteProfile, setInviteProfile] = useState(null);

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

  const approved = members.filter(m => m.status === "approved");
  const pending  = members.filter(m => m.status === "pending");
  const rejected = members.filter(m => m.status === "rejected");

  const tabs = isAdmin ? CIRCLE_TABS : [CIRCLE_TABS[0]];

  return (
    <>
      <div className="app">
        <header className="header">
          <div className="header-top">
            <button className="btn-ghost" style={{color:T.tealText,display:"flex",alignItems:"center",gap:6,padding:"4px 0"}} onClick={onBack}>
              <span style={{display:"flex",width:16,height:16}}>{Icon.arrowLeft}</span>
              <span style={{fontSize:13}}>All circles</span>
            </button>
            <div className="header-right">
              <div className="header-avatar">{initials(user?.profile?.full_name || user?.email || "?")}</div>
            </div>
          </div>
          <div className="circle-hero">
            <div className="circle-hero-name">{circle.name}</div>
            {circle.description && <div className="circle-hero-desc">{circle.description}</div>}
            <div className="circle-hero-meta">{approved.length} member{approved.length !== 1 ? "s" : ""}</div>
          </div>
          <div className="tab-bar">
            {tabs.map(t => (
              <button key={t.id} className={`tab ${tab===t.id?"active":""}`} onClick={() => setTab(t.id)}>{t.label}</button>
            ))}
          </div>
        </header>

        <div className="content">
          {tab === "members" && (
            loading ? <Spinner /> : approved.length === 0 ? (
              <EmptyState icon={Icon.users} text="No members yet." />
            ) : (
              <div className="fade-up">
                {approved.map(m => {
                  const isManaged = m.profile?.profile_type === "managed";
                  return (
                    <div key={m.id} className="list-item">
                      <div className={`list-icon ${isManaged ? "managed" : "light"}`}>
                        {Icon.user}
                      </div>
                      <div className="list-body">
                        <div className="list-name">{m.profile?.full_name || "Unknown"}</div>
                        <div className="list-sub">{isManaged ? "Managed profile" : m.profile?.email}</div>
                      </div>
                      <div className="list-right">
                        {isManaged && <span className="badge badge-managed">Managed</span>}
                        <span className={`badge ${m.role==="admin"?"badge-admin":"badge-member"}`}>{m.role}</span>
                        <span className={`badge ${m.member_type==="family"?"badge-family":"badge-friend"}`}>{m.member_type}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}

          {tab === "manage" && isAdmin && (
            <div className="fade-up">
              <div className="page-header">
                <div className="page-title">Manage members</div>
                <button className="btn-secondary" onClick={() => setShowAdd(true)}>Add managed member</button>
              </div>

              {loading ? <Spinner /> : (
                <>
                  {pending.length > 0 && (
                    <>
                      <div className="section-title">Pending approval — {pending.length}</div>
                      {pending.map(m => (
                        <div key={m.id} className="list-item" style={{borderLeft:`3px solid ${T.coral}`}}>
                          <div className="list-icon light">{Icon.user}</div>
                          <div className="list-body">
                            <div className="list-name">{m.profile?.full_name || "Unknown"}</div>
                            <div className="list-sub">{m.profile?.email}</div>
                          </div>
                          <div className="list-right">
                            <span className={`badge ${m.member_type==="family"?"badge-family":"badge-friend"}`}>{m.member_type}</span>
                            <button className="btn-approve" disabled={actioning===m.id} onClick={() => action(m.id,"status","approved")}>
                              {actioning===m.id?"…":"Approve"}
                            </button>
                            <button className="btn-reject" disabled={actioning===m.id} onClick={() => action(m.id,"status","rejected")}>
                              Reject
                            </button>
                          </div>
                        </div>
                      ))}
                    </>
                  )}

                  {approved.length > 0 && (
                    <>
                      <div className="section-title">Members — {approved.length}</div>
                      {approved.map(m => {
                        const isManaged = m.profile?.profile_type === "managed";
                        return (
                          <div key={m.id} className="list-item" style={isManaged?{borderLeft:"3px solid #7C3AED"}:{}}>
                            <div className={`list-icon ${isManaged?"managed":"light"}`}>{Icon.user}</div>
                            <div className="list-body">
                              <div className="list-name">{m.profile?.full_name || "Unknown"}</div>
                              <div className="list-sub">{isManaged ? (m.profile?.invite_email || "No invite email set") : m.profile?.email}</div>
                            </div>
                            <div className="list-right">
                              {isManaged
                                ? <>
                                    <span className="badge badge-managed">Managed</span>
                                    <button className="btn-invite" onClick={() => setInviteProfile(m.profile)}>
                                      {Icon.link} Invite link
                                    </button>
                                  </>
                                : <>
                                    <span className={`badge ${m.role==="admin"?"badge-admin":"badge-member"}`}>{m.role}</span>
                                    <button className="btn-ghost" disabled={actioning===m.id} onClick={() => action(m.id,"role",m.role==="admin"?"member":"admin")}>
                                      {actioning===m.id?"…":m.role==="admin"?"Remove admin":"Make admin"}
                                    </button>
                                  </>
                              }
                            </div>
                          </div>
                        );
                      })}
                    </>
                  )}

                  {rejected.length > 0 && (
                    <>
                      <div className="section-title">Rejected — {rejected.length}</div>
                      {rejected.map(m => (
                        <div key={m.id} className="list-item" style={{opacity:0.6}}>
                          <div className="list-icon light">{Icon.user}</div>
                          <div className="list-body">
                            <div className="list-name">{m.profile?.full_name || "Unknown"}</div>
                            <div className="list-sub">{m.profile?.email}</div>
                          </div>
                          <div className="list-right">
                            <span className="badge badge-rejected">Rejected</span>
                          </div>
                        </div>
                      ))}
                    </>
                  )}

                  {pending.length === 0 && approved.length === 0 && rejected.length === 0 && (
                    <EmptyState icon={Icon.users} text="No members yet. Approve requests or add managed members." />
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {showAdd && (
        <AddManagedModal
          user={user}
          circle={circle}
          onClose={() => setShowAdd(false)}
          onAdded={(profile) => { setShowAdd(false); load(); setInviteProfile(profile); }}
        />
      )}

      {inviteProfile && (
        <InviteLinkModal profile={inviteProfile} onClose={() => setInviteProfile(null)} />
      )}
    </>
  );
}

// ─── Add Managed Member Modal ─────────────────────────────────────────────────

function AddManagedModal({ user, circle, onClose, onAdded }) {
  const [name, setName]         = useState("");
  const [memberType, setType]   = useState("family");
  const [inviteEmail, setEmail] = useState("");
  const [loading, setLoading]   = useState(false);
  const [msg, setMsg]           = useState(null);

  const handle = async () => {
    if (!name.trim()) { setMsg({ type:"error", text:"Please enter a name." }); return; }
    setLoading(true); setMsg(null);
    const { data: profiles, error: pErr } = await db.createManagedProfile(name.trim(), memberType, user.profile.id, inviteEmail.trim() || null, user.token);
    if (pErr || !profiles?.length) {
      setMsg({ type:"error", text:"Could not create member profile. Please try again." });
      setLoading(false); return;
    }
    const profile = profiles[0];
    const { error: mErr } = await db.addMember(circle.id, profile.id, "member", "approved", memberType, user.token);
    if (mErr) {
      setMsg({ type:"error", text:"Profile created but could not add to circle." });
      setLoading(false); return;
    }
    onAdded(profile);
  };

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-title">Add a managed member</div>
        <div className="modal-sub">Add someone without their own account — such as a child. They appear in the circle like any other member.</div>
        <div className="field">
          <label className="field-label">Name</label>
          <input className="field-input" type="text" placeholder="e.g. Ellie Brewis" value={name} onChange={e => setName(e.target.value)} autoFocus />
        </div>
        <div className="field">
          <label className="field-label">Member type</label>
          <div className="type-row">
            <button className={`type-btn ${memberType==="family"?"selected":""}`} onClick={() => setType("family")}>Family</button>
            <button className={`type-btn ${memberType==="friend"?"selected":""}`} onClick={() => setType("friend")}>Friend</button>
          </div>
        </div>
        <div className="field">
          <label className="field-label">Invite email <span style={{textTransform:"none",fontWeight:400,color:T.muted}}>(optional)</span></label>
          <input className="field-input" type="email" placeholder="For when they're ready to join" value={inviteEmail} onChange={e => setEmail(e.target.value)} />
          <div className="field-hint">Stored so you can send an invite link later.</div>
        </div>
        <Msg msg={msg} />
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handle} disabled={loading}>
            {loading ? "Adding…" : "Add to circle"}
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
    } catch { /* fallback */ }
  };

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-title">Invite link for {profile.full_name}</div>
        <div className="modal-sub">Share this link so they can create an account and claim this profile. Their circle memberships carry over automatically.</div>
        <div className="invite-box">{link}</div>
        <button className={`btn-invite ${copied?"copied":""}`} style={{width:"100%",padding:"9px",fontSize:13,display:"flex",alignItems:"center",justifyContent:"center",gap:8}} onClick={copy}>
          <span style={{display:"flex",width:15,height:15}}>{copied ? Icon.check : Icon.copy}</span>
          {copied ? "Copied to clipboard" : "Copy invite link"}
        </button>
        {profile.invite_email && (
          <div className="msg info" style={{marginTop:12}}>Stored invite email: {profile.invite_email}</div>
        )}
        <div className="modal-footer">
          <button className="btn-secondary" style={{width:"100%"}} onClick={onClose}>Done</button>
        </div>
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

  const go = (s, circle = null, membership = null) => {
    setScreen(s);
    if (circle)     setActiveCircle(circle);
    if (membership) setActiveMembership(membership);
  };

  if (inviteToken && !session) {
    return (
      <>
        <style>{styles}</style>
        <ClaimProfileScreen
          inviteToken={inviteToken}
          onClaimed={sess => {
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
        return <CreateCircle user={session} onBack={() => go("dashboard")} onCreated={c => go("circle", c, { role:"admin", status:"approved" })} />;
      case "circle":
        return <CircleHome user={session} circle={activeCircle} membership={activeMembership} onBack={() => go("dashboard")} />;
      default:
        return <Dashboard user={session} onSignOut={signOut} onEnterCircle={(c, m) => go("circle", c, m)} onCreateCircle={() => go("create")} />;
    }
  };

  return <><style>{styles}</style>{render()}</>;
}
