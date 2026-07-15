const extensionApi = globalThis.chrome || globalThis.browser;

const LOCAL_NATIVE_RELAY = "ws://127.0.0.1:27822/ws";
const HOSTED_NATIVE_RELAY = "wss://v22-relay.116.203.155.30.sslip.io/ws";
const HOSTED_LICENSE_API = "https://vweb.irongiant.vip";

const SITE_THEME_DARK = `/* Vortex Web dark site theme */
:root {
  --bgcol1: #10171d;
  --bgcol2: #18222b;
  --bgcol3: #202c36;
  --bgcoltopbar: #111920;
  --linecol1: rgba(220, 236, 246, 0.16);
  --linecol2: rgba(220, 236, 246, 0.28);
  --textcol1: rgba(245, 250, 252, 0.96);
  --textcol2: rgba(210, 224, 232, 0.70);
  --vortex-main: rgba(245, 250, 252, 0.96);
  --vortex-secondary: rgba(210, 224, 232, 0.68);
  --accentcol1: #35d39a;
}
html[theme='light'] {
  --bgcol1: #10171d;
  --bgcol2: #18222b;
  --bgcol3: #202c36;
  --bgcoltopbar: #111920;
  --linecol1: rgba(220, 236, 246, 0.16);
  --linecol2: rgba(220, 236, 246, 0.28);
  --textcol1: rgba(245, 250, 252, 0.96);
  --textcol2: rgba(210, 224, 232, 0.70);
  --vortex-main: rgba(245, 250, 252, 0.96);
  --vortex-secondary: rgba(210, 224, 232, 0.68);
}
.navbar a,
.navbar button,
.navbar .btn,
.navbar .nav-link,
.navbar .btn-signout-sm {
  background: transparent !important;
  color: var(--textcol1) !important;
  border-color: transparent !important;
  box-shadow: none !important;
}
.navbar a:hover,
.navbar button:hover,
.navbar .btn:hover,
.navbar .nav-link:hover,
.navbar .btn-signout-sm:hover {
  background: rgba(255, 255, 255, 0.08) !important;
  color: var(--textcol1) !important;
}
body[data-vweb-ugc-route="1"] {
  --vweb-ugc-bg: #10171d;
  --vweb-ugc-panel: rgba(20, 31, 42, 0.94);
  --vweb-ugc-panel-strong: rgba(24, 36, 48, 0.96);
  --vweb-ugc-panel-soft: rgba(26, 38, 50, 0.70);
  --vweb-ugc-input: rgba(10, 17, 24, 0.58);
  --vweb-ugc-border: rgba(220, 236, 246, 0.20);
  --vweb-ugc-border-soft: rgba(220, 236, 246, 0.14);
  --vweb-ugc-text: rgba(245, 250, 252, 0.96);
  --vweb-ugc-heading: rgba(248, 250, 252, 0.98);
  --vweb-ugc-muted: rgba(210, 224, 232, 0.72);
  --vweb-ugc-faint: rgba(210, 224, 232, 0.62);
  --vweb-ugc-accent: #35d39a;
  --vweb-ugc-accent-soft: rgba(53, 211, 154, 0.22);
  --vweb-ugc-button: rgba(245, 250, 252, 0.08);
  --vweb-ugc-button-hover: rgba(245, 250, 252, 0.14);
  --vweb-ugc-canvas-bg: #07111d;
  --vweb-ugc-nav-menu: rgba(17, 25, 32, 0.95);
}
.vweb-ugc-nav-menu {
  background: rgba(17, 25, 32, 0.95) !important;
  border-color: rgba(220, 236, 246, 0.18) !important;
}
.vweb-ugc-nav-menu a {
  color: rgba(245, 250, 252, 0.96) !important;
}`;

const SITE_THEME_LIGHT = `/* Vortex Web light site theme */
:root,
html[theme='light'] {
  --bgcol1: #f8fafc;
  --bgcol2: #ffffff;
  --bgcol3: #e8eef4;
  --bgcoltopbar: #ffffff;
  --linecol1: rgba(15, 23, 42, 0.12);
  --linecol2: rgba(15, 23, 42, 0.18);
  --textcol1: #111827;
  --textcol2: rgba(17, 24, 39, 0.70);
  --vortex-main: #111827;
  --vortex-secondary: rgba(17, 24, 39, 0.66);
  --accentcol1: #0ea5e9;
}
.navbar,
.tab-bar {
  background: #ffffff !important;
  color: var(--textcol1) !important;
  border-bottom-color: var(--linecol1) !important;
}
.navbar a,
.navbar button,
.navbar .btn,
.navbar .nav-link,
.navbar .btn-signout-sm {
  background: transparent !important;
  color: var(--textcol1) !important;
  border-color: transparent !important;
  box-shadow: none !important;
}
.navbar a:hover,
.navbar button:hover,
.navbar .btn:hover,
.navbar .nav-link:hover,
.navbar .btn-signout-sm:hover {
  background: rgba(14, 165, 233, 0.11) !important;
  color: #0f172a !important;
}
.navbar .active,
.navbar [aria-current='page'] {
  background: rgba(14, 165, 233, 0.22) !important;
  color: #0f172a !important;
}
body[data-vweb-ugc-route="1"] {
  --vweb-ugc-bg: #f8fafc;
  --vweb-ugc-panel: rgba(255, 255, 255, 0.92);
  --vweb-ugc-panel-strong: rgba(255, 255, 255, 0.98);
  --vweb-ugc-panel-soft: rgba(241, 245, 249, 0.82);
  --vweb-ugc-input: rgba(255, 255, 255, 0.86);
  --vweb-ugc-border: rgba(15, 23, 42, 0.16);
  --vweb-ugc-border-soft: rgba(15, 23, 42, 0.10);
  --vweb-ugc-text: #111827;
  --vweb-ugc-heading: #0f172a;
  --vweb-ugc-muted: rgba(17, 24, 39, 0.66);
  --vweb-ugc-faint: rgba(17, 24, 39, 0.52);
  --vweb-ugc-accent: #0ea5e9;
  --vweb-ugc-accent-soft: rgba(14, 165, 233, 0.16);
  --vweb-ugc-button: rgba(15, 23, 42, 0.06);
  --vweb-ugc-button-hover: rgba(14, 165, 233, 0.13);
  --vweb-ugc-canvas-bg: #eef6ff;
  --vweb-ugc-nav-menu: rgba(255, 255, 255, 0.97);
  --vweb-ugc-nav-menu-text: #0f172a;
}
.vweb-ugc-nav-menu {
  background: rgba(255, 255, 255, 0.97) !important;
  border-color: rgba(15, 23, 42, 0.12) !important;
}
.vweb-ugc-nav-menu a {
  color: #0f172a !important;
}`;

const SITE_THEME_GLASS = `/* Vortex Web glass site theme */
:root {
  --bgcol1: #0f1720;
  --bgcol2: rgba(20, 31, 40, 0.78);
  --bgcol3: rgba(34, 48, 60, 0.72);
  --bgcoltopbar: rgba(10, 16, 23, 0.78);
  --linecol1: rgba(255, 255, 255, 0.14);
  --linecol2: rgba(255, 255, 255, 0.22);
  --textcol1: rgba(248, 250, 252, 0.96);
  --textcol2: rgba(226, 232, 240, 0.72);
  --accentcol1: #7dd3fc;
}
.navbar,
.tab-bar,
.profile-header,
.game-card,
.card,
.panel,
.modal-content,
.dropdown-menu,
.vw-profile-style,
.vw-badge-card {
  backdrop-filter: blur(16px) saturate(1.12) !important;
  background-color: color-mix(in srgb, var(--bgcol2) 82%, transparent) !important;
}
.navbar a,
.navbar button,
.navbar .btn,
.navbar .nav-link,
.navbar .btn-signout-sm {
  background: transparent !important;
  color: var(--textcol1) !important;
  border-color: transparent !important;
  box-shadow: none !important;
}
.navbar a:hover,
.navbar button:hover,
.navbar .btn:hover,
.navbar .nav-link:hover,
.navbar .btn-signout-sm:hover {
  background: rgba(255, 255, 255, 0.10) !important;
}
body[data-vweb-ugc-route="1"] {
  --vweb-ugc-bg: #0f1720;
  --vweb-ugc-panel: color-mix(in srgb, rgba(20, 31, 40, 0.78) 88%, transparent);
  --vweb-ugc-panel-strong: color-mix(in srgb, rgba(34, 48, 60, 0.76) 88%, transparent);
  --vweb-ugc-panel-soft: rgba(255, 255, 255, 0.07);
  --vweb-ugc-input: rgba(8, 13, 20, 0.38);
  --vweb-ugc-border: rgba(255, 255, 255, 0.18);
  --vweb-ugc-border-soft: rgba(255, 255, 255, 0.12);
  --vweb-ugc-text: rgba(248, 250, 252, 0.96);
  --vweb-ugc-heading: rgba(248, 250, 252, 0.98);
  --vweb-ugc-muted: rgba(226, 232, 240, 0.72);
  --vweb-ugc-faint: rgba(226, 232, 240, 0.58);
  --vweb-ugc-accent: #7dd3fc;
  --vweb-ugc-accent-soft: rgba(125, 211, 252, 0.20);
  --vweb-ugc-button: rgba(255, 255, 255, 0.08);
  --vweb-ugc-button-hover: rgba(255, 255, 255, 0.14);
  --vweb-ugc-canvas-bg: #07111d;
  --vweb-ugc-nav-menu: rgba(10, 16, 23, 0.92);
}
.vweb-ugc-nav-menu {
  background: rgba(10, 16, 23, 0.92) !important;
  border-color: rgba(255, 255, 255, 0.16) !important;
  backdrop-filter: blur(16px) saturate(1.12) !important;
}
.vweb-ugc-nav-menu a {
  color: rgba(248, 250, 252, 0.96) !important;
}`;

const SITE_THEME_LIGHT_CLEAR = `/* Light clear site theme */
${SITE_THEME_LIGHT}
html[data-vweb-site-layout='modern'] {
  --bgcol1: #eef3f8;
  --bgcol2: rgba(255,255,255,.80);
  --bgcol3: rgba(226,232,240,.74);
  --bgcoltopbar: rgba(255,255,255,.84);
  --linecol1: rgba(15,23,42,.12);
  --linecol2: rgba(15,23,42,.20);
  --textcol1: #111827;
  --textcol2: rgba(17,24,39,.68);
  --vortex-main: #111827;
  --vortex-secondary: rgba(17,24,39,.66);
  --accentcol1: #0b78d0;
  color-scheme: light;
  background: #eef3f8 !important;
}
html[data-vweb-site-layout='modern'] body { background: #eef3f8 !important; color: #111827 !important; }
html[data-vweb-site-layout='modern'] .navbar,
html[data-vweb-site-layout='modern'] .tab-bar,
html[data-vweb-site-layout='modern'] [data-vweb-home-friends-header],
html[data-vweb-site-layout='modern'] .profile-header:not(.vw-profile-header-nameplate),
html[data-vweb-site-layout='modern'] .game-card,
html[data-vweb-site-layout='modern'] .card,
html[data-vweb-site-layout='modern'] .panel,
html[data-vweb-site-layout='modern'] .modal-content,
html[data-vweb-site-layout='modern'] .dropdown-menu,
html[data-vweb-site-layout='modern'] .vweb-user-menu-popup,
html[data-vweb-site-layout='modern'] .vweb-ugc-nav-menu,
html[data-vweb-site-layout='modern'] .vw-profile-style,
html[data-vweb-site-layout='modern'] .vw-badge-card,
html[data-vweb-site-layout='modern'] .vweb-home-game-card,
html[data-vweb-site-layout='modern'] [data-vweb-home-friends],
html[data-vweb-site-layout='modern'][data-vweb-site-page='social'] .user-card,
html[data-vweb-site-layout='modern'][data-vweb-site-page='profile'] .bio-box,
html[data-vweb-site-layout='modern'][data-vweb-site-page='profile'] .profile-info-panel,
html[data-vweb-site-layout='modern'][data-vweb-site-page='game'] .game-description-box,
html[data-vweb-site-layout='modern'][data-vweb-site-page='settings'] .settings-section {
  backdrop-filter: blur(16px) saturate(1.08) !important;
  background-color: rgba(255, 255, 255, 0.78) !important;
  color: #111827 !important;
}
html[data-vweb-site-layout='modern'] .navbar-actions [data-vweb-nav-item],
html[data-vweb-site-layout='modern'] .vweb-ugc-nav-main,
html[data-vweb-site-layout='modern'] .navbar-actions .vweb-user-menu-popup > .vweb-user-menu-item,
html[data-vweb-site-layout='modern'] [data-vweb-home-friends] .friend-name,
html[data-vweb-site-layout='modern'] [data-vweb-home-friends] .vweb-friend-request-row > a,
html[data-vweb-site-layout='modern'] .vweb-home-section-head h2,
html[data-vweb-site-layout='modern'] .vweb-home-game-copy strong,
html[data-vweb-site-layout='modern'] .vweb-home-game-copy small,
html[data-vweb-site-layout='modern'][data-vweb-site-page='social'] .user-card,
html[data-vweb-site-layout='modern'][data-vweb-site-page='profile'] .page,
html[data-vweb-site-layout='modern'][data-vweb-site-page='game'] .page {
  color: #111827 !important;
}
html[data-vweb-site-layout='modern'] [data-vweb-home-friends-header] .section-title,
html[data-vweb-site-layout='modern'] .vweb-friend-request-panel,
html[data-vweb-site-layout='modern'] .section-title,
html[data-vweb-site-layout='modern'] .section-link { color: #334155 !important; }
html[data-vweb-site-layout='modern'] .navbar-actions [data-vweb-nav-item],
html[data-vweb-site-layout='modern'] .vweb-ugc-nav-main { background: rgba(15,23,42,.055) !important; }
html[data-vweb-site-layout='modern'] .navbar-actions [data-vweb-nav-item]:hover,
html[data-vweb-site-layout='modern'] .vweb-ugc-nav-main:hover,
html[data-vweb-site-layout='modern'] .navbar-actions .vweb-user-menu-popup > .vweb-user-menu-item:hover,
html[data-vweb-site-layout='modern'] [data-vweb-home-friends] .friend-card:hover {
  background: rgba(15,23,42,.10) !important;
  color: #020617 !important;
}
html[data-vweb-site-layout='modern'] .vweb-user-menu-trigger {
  border-color: rgba(15,23,42,.18) !important;
  background: rgba(15,23,42,.06) !important;
}
html[data-vweb-site-layout='modern'] .vweb-user-menu-chevron { border-color: #334155 !important; }
html[data-vweb-site-layout='modern'] .vweb-friend-rail-tabs button { color: #475569 !important; }
html[data-vweb-site-layout='modern'] .vweb-friend-rail-tabs button.active {
  background: rgba(15,23,42,.10) !important;
  color: #0f172a !important;
}
html[data-vweb-site-layout='modern'] .vweb-home-sort select,
html[data-vweb-site-layout='modern'] .vweb-home-sort button,
html[data-vweb-site-layout='modern'] .tab-btn {
  border-color: rgba(15,23,42,.18) !important;
  background: rgba(255,255,255,.72) !important;
  color: #111827 !important;
}
html[data-vweb-site-layout='modern'] .site-footer { background: rgba(255,255,255,.70) !important; }
html[data-vweb-site-layout='modern'] .site-footer a { color: #475569 !important; }
html[data-vweb-site-layout='modern'][data-vweb-site-page='profile'] body.vw-profile-bg-tone-dark .bio-box,
html[data-vweb-site-layout='modern'][data-vweb-site-page='profile'] body.vw-profile-bg-tone-dark .vw-profile-style,
html[data-vweb-site-layout='modern'][data-vweb-site-page='profile'] body.vw-profile-bg-tone-dark .vw-badge-card {
  --textcol1: #111827;
  --textcol2: rgba(17,24,39,.68);
}
body[data-vweb-ugc-route="1"] {
  --vweb-ugc-panel: rgba(255, 255, 255, 0.78);
  --vweb-ugc-panel-strong: rgba(255, 255, 255, 0.88);
  --vweb-ugc-panel-soft: rgba(241, 245, 249, 0.66);
}`;

const SITE_THEME_ROBLOX_2007 = `/* Roblox 2007-inspired site theme */
html[data-vweb-site-layout='modern'],
html[data-vweb-site-layout='modern'][theme='light'] {
  --bgcol1: #e8e8e8;
  --bgcol2: #ffffff;
  --bgcol3: #d7d7d7;
  --bgcoltopbar: #f4f4f4;
  --linecol1: #a7a7a7;
  --linecol2: #777777;
  --textcol1: #222222;
  --textcol2: #555555;
  --vortex-main: #222222;
  --vortex-secondary: #555555;
  --accentcol1: #0055aa;
  color-scheme: light;
  background: #dedede !important;
}
html[data-vweb-site-layout='modern'] body,
button,
input,
select,
textarea { font-family: Arial, Helvetica, sans-serif !important; }
html[data-vweb-site-layout='modern'] body { background: #dedede !important; color: #222222 !important; }
html[data-vweb-site-layout='modern'] .navbar,
html[data-vweb-site-layout='modern'] .tab-bar {
  border-bottom: 1px solid #888888 !important;
  background: linear-gradient(#ffffff, #d8d8d8) !important;
  box-shadow: 0 2px 3px rgba(0,0,0,.22) !important;
}
html[data-vweb-site-layout='modern'] .navbar-actions [data-vweb-nav-item],
html[data-vweb-site-layout='modern'] .vweb-ugc-nav-main,
html[data-vweb-site-layout='modern'] .navbar-actions .vweb-user-menu-popup > .vweb-user-menu-item {
  border: 1px solid transparent !important;
  border-radius: 2px !important;
  background: transparent !important;
  color: #222222 !important;
  font-family: Arial, Helvetica, sans-serif !important;
}
html[data-vweb-site-layout='modern'] .navbar-actions [data-vweb-nav-item]:hover,
html[data-vweb-site-layout='modern'] .vweb-ugc-nav-main:hover,
html[data-vweb-site-layout='modern'] .navbar-actions .vweb-user-menu-popup > .vweb-user-menu-item:hover {
  border-color: #8b8b8b !important;
  background: linear-gradient(#ffffff, #cfcfcf) !important;
  color: #003f80 !important;
}
html[data-vweb-site-layout='modern'] .game-card,
html[data-vweb-site-layout='modern'] .card,
html[data-vweb-site-layout='modern'] .panel,
html[data-vweb-site-layout='modern'] .profile-header:not(.vw-profile-header-nameplate),
html[data-vweb-site-layout='modern'] .modal-content,
html[data-vweb-site-layout='modern'] .dropdown-menu,
html[data-vweb-site-layout='modern'] .vweb-home-game-card,
html[data-vweb-site-layout='modern'] [data-vweb-home-friends-header],
html[data-vweb-site-layout='modern'] [data-vweb-home-friends],
html[data-vweb-site-layout='modern'] .user-card,
html[data-vweb-site-layout='modern'] .vweb-user-menu-popup,
html[data-vweb-site-layout='modern'] .vweb-ugc-nav-menu,
html[data-vweb-site-layout='modern'][data-vweb-site-page='profile'] .bio-box,
html[data-vweb-site-layout='modern'][data-vweb-site-page='profile'] .profile-info-panel,
html[data-vweb-site-layout='modern'][data-vweb-site-page='profile'] .vw-profile-style,
html[data-vweb-site-layout='modern'][data-vweb-site-page='profile'] .vw-badge-card,
html[data-vweb-site-layout='modern'][data-vweb-site-page='game'] .game-description-box,
html[data-vweb-site-layout='modern'][data-vweb-site-page='settings'] .settings-section {
  border: 1px solid #999999 !important;
  border-radius: 2px !important;
  background: #ffffff !important;
  color: #222222 !important;
  box-shadow: 0 1px 2px rgba(0,0,0,.18) !important;
}
html[data-vweb-site-layout='modern'] [data-vweb-home-friends] .friend-name,
html[data-vweb-site-layout='modern'] [data-vweb-home-friends] .vweb-friend-request-row > a,
html[data-vweb-site-layout='modern'] .vweb-friend-rail-tabs button,
html[data-vweb-site-layout='modern'] .vweb-home-section-head h2,
html[data-vweb-site-layout='modern'][data-vweb-site-page='profile'] .page,
html[data-vweb-site-layout='modern'][data-vweb-site-page='social'] .page,
html[data-vweb-site-layout='modern'][data-vweb-site-page='game'] .page { color: #222222 !important; }
html[data-vweb-site-layout='modern'] [data-vweb-home-friends-header] .section-title,
html[data-vweb-site-layout='modern'] .vweb-friend-request-panel,
html[data-vweb-site-layout='modern'] .section-title,
html[data-vweb-site-layout='modern'] .section-link { color: #444 !important; }
html[data-vweb-site-layout='modern'] .vweb-friend-rail-tabs button.active,
html[data-vweb-site-layout='modern'] [data-vweb-home-friends] .friend-card:hover,
html[data-vweb-site-layout='modern'] .vweb-friend-request-row:hover {
  background: #e5e5e5 !important;
  color: #003f80 !important;
}
html[data-vweb-site-layout='modern'] .vweb-friend-rail-tabs button,
html[data-vweb-site-layout='modern'][data-vweb-site-page='social'] .tab-btn {
  border-radius: 2px !important;
}
html[data-vweb-site-layout='modern'][data-vweb-site-page='social'] .user-card {
  border: 1px solid #999 !important;
  border-radius: 2px !important;
  background: #fff !important;
  color: #222 !important;
}
html[data-vweb-site-layout='modern'] .vweb-user-menu-trigger {
  border: 1px solid #888 !important;
  border-radius: 2px !important;
  background: linear-gradient(#fff,#d5d5d5) !important;
}
html[data-vweb-site-layout='modern'] .vweb-user-menu-chevron { border-color: #333 !important; }
html[data-vweb-site-layout='modern'] .vweb-home-game-copy { background: #eeeeee !important; }
html[data-vweb-site-layout='modern'] .vweb-home-game-copy strong,
html[data-vweb-site-layout='modern'] .vweb-home-game-copy small { color: #222222 !important; }
html[data-vweb-site-layout='modern'] #search-input {
  border-color: #888888 !important;
  border-radius: 2px !important;
  background: #ffffff !important;
  color: #222222 !important;
}
html[data-vweb-site-layout='modern'] button,
html[data-vweb-site-layout='modern'] .btn {
  border: 1px solid #888888 !important;
  border-radius: 2px !important;
  background: linear-gradient(#ffffff, #d5d5d5) !important;
  color: #222222 !important;
}
html[data-vweb-site-layout='modern'] .btn-play,
html[data-vweb-site-layout='modern'] .vweb-play-browser-btn,
html[data-vweb-site-layout='modern'] .vweb-home-game-play {
  border-color: #777 !important;
  border-radius: 2px !important;
  background: linear-gradient(#fff,#cfcfcf) !important;
  color: #111 !important;
}
html[data-vweb-site-layout='modern'] .site-footer { border-top: 1px solid #999 !important; background: #e2e2e2 !important; }
html[data-vweb-site-layout='modern'] .site-footer a { color: #0645ad !important; }`;

const SITE_THEME_METRO = `/* Metro-inspired site theme */
html[data-vweb-site-layout='modern'] {
  --bgcol1: #111111;
  --bgcol2: #1b1b1b;
  --bgcol3: #242424;
  --bgcoltopbar: #161616;
  --linecol1: rgba(255,255,255,.14);
  --linecol2: rgba(255,255,255,.24);
  --textcol1: #f4f4f4;
  --textcol2: #b8b8b8;
  --accentcol1: #00a4ef;
  color-scheme: dark;
  background: #111111 !important;
}
html[data-vweb-site-layout='modern'] body,
button,
input,
select,
textarea { font-family: "Segoe UI", Arial, sans-serif !important; }
html[data-vweb-site-layout='modern'] body { background: #111111 !important; }
html[data-vweb-site-layout='modern'] .navbar {
  border-bottom: 3px solid #00a4ef !important;
  background: #161616 !important;
  box-shadow: none !important;
}
html[data-vweb-site-layout='modern'] .navbar-actions [data-vweb-nav-item],
html[data-vweb-site-layout='modern'] .vweb-ugc-nav-main,
html[data-vweb-site-layout='modern'] .navbar-actions .vweb-user-menu-popup > .vweb-user-menu-item {
  border: 0 !important;
  border-bottom: 2px solid transparent !important;
  border-radius: 0 !important;
  background: transparent !important;
  color: #f4f4f4 !important;
  font-weight: 500 !important;
}
html[data-vweb-site-layout='modern'] .navbar-actions [data-vweb-nav-item]:hover,
html[data-vweb-site-layout='modern'] .vweb-ugc-nav-main:hover,
html[data-vweb-site-layout='modern'] .navbar-actions .vweb-user-menu-popup > .vweb-user-menu-item:hover {
  border-bottom-color: #00a4ef !important;
  background: #242424 !important;
  color: #fff !important;
}
html[data-vweb-site-layout='modern'] .game-card,
html[data-vweb-site-layout='modern'] .card,
html[data-vweb-site-layout='modern'] .panel,
html[data-vweb-site-layout='modern'] .profile-header,
html[data-vweb-site-layout='modern'] .modal-content,
html[data-vweb-site-layout='modern'] .dropdown-menu,
html[data-vweb-site-layout='modern'] .vweb-home-game-card,
html[data-vweb-site-layout='modern'] [data-vweb-home-friends-header],
html[data-vweb-site-layout='modern'] [data-vweb-home-friends],
html[data-vweb-site-layout='modern'] .user-card,
html[data-vweb-site-layout='modern'] .vweb-user-menu-popup,
html[data-vweb-site-layout='modern'] .vweb-ugc-nav-menu,
html[data-vweb-site-layout='modern'][data-vweb-site-page='profile'] .bio-box,
html[data-vweb-site-layout='modern'][data-vweb-site-page='profile'] .profile-info-panel,
html[data-vweb-site-layout='modern'][data-vweb-site-page='profile'] .vw-profile-style,
html[data-vweb-site-layout='modern'][data-vweb-site-page='profile'] .vw-badge-card,
html[data-vweb-site-layout='modern'][data-vweb-site-page='game'] .game-description-box,
html[data-vweb-site-layout='modern'][data-vweb-site-page='settings'] .settings-section,
html[data-vweb-site-layout='modern'] button,
html[data-vweb-site-layout='modern'] .btn,
html[data-vweb-site-layout='modern'] input,
html[data-vweb-site-layout='modern'] select,
html[data-vweb-site-layout='modern'] textarea {
  border-radius: 0 !important;
  box-shadow: none !important;
}
html[data-vweb-site-layout='modern'] [data-vweb-home-friends-header],
html[data-vweb-site-layout='modern'] [data-vweb-home-friends],
html[data-vweb-site-layout='modern'] .vweb-user-menu-popup,
html[data-vweb-site-layout='modern'] .vweb-ugc-nav-menu,
html[data-vweb-site-layout='modern'][data-vweb-site-page='social'] .user-card,
html[data-vweb-site-layout='modern'][data-vweb-site-page='profile'] .bio-box,
html[data-vweb-site-layout='modern'][data-vweb-site-page='profile'] .profile-info-panel,
html[data-vweb-site-layout='modern'][data-vweb-site-page='game'] .game-description-box {
  border-color: #333 !important;
  background: #1b1b1b !important;
  color: #f4f4f4 !important;
}
html[data-vweb-site-layout='modern'] .profile-header:not(.vw-profile-header-nameplate),
html[data-vweb-site-layout='modern'][data-vweb-site-page='profile'] .vw-profile-style,
html[data-vweb-site-layout='modern'][data-vweb-site-page='profile'] .vw-badge-card {
  border-color: #333 !important;
  background: #1b1b1b !important;
  color: #f4f4f4 !important;
}
html[data-vweb-site-layout='modern'] [data-vweb-home-friends-header] .section-title,
html[data-vweb-site-layout='modern'] .vweb-friend-request-panel,
html[data-vweb-site-layout='modern'] .section-title,
html[data-vweb-site-layout='modern'] .section-link { color: #b8b8b8 !important; }
html[data-vweb-site-layout='modern'] .vweb-friend-rail-tabs button,
html[data-vweb-site-layout='modern'] [data-vweb-home-friends] .friend-name,
html[data-vweb-site-layout='modern'] [data-vweb-home-friends] .vweb-friend-request-row > a { color: #d7d7d7 !important; }
html[data-vweb-site-layout='modern'] .vweb-friend-rail-tabs button.active {
  background: #0078d4 !important;
  color: #fff !important;
}
html[data-vweb-site-layout='modern'] .vweb-friend-rail-tabs button,
html[data-vweb-site-layout='modern'][data-vweb-site-page='social'] .tab-btn { border-radius: 0 !important; }
html[data-vweb-site-layout='modern'] [data-vweb-home-friends] .friend-card:hover,
html[data-vweb-site-layout='modern'] .vweb-friend-request-row:hover { background: #292929 !important; }
html[data-vweb-site-layout='modern'] .vweb-user-menu-trigger {
  border: 0 !important;
  border-bottom: 2px solid #00a4ef !important;
  border-radius: 0 !important;
  background: #242424 !important;
}
html[data-vweb-site-layout='modern'] .vweb-user-menu-chevron { border-color: #fff !important; }
html[data-vweb-site-layout='modern'] .vweb-home-game-card {
  border: 0 !important;
  border-bottom: 4px solid #00a4ef !important;
  background: #1b1b1b !important;
}
html[data-vweb-site-layout='modern'] .vweb-home-game-copy { background: #1b1b1b !important; }
html[data-vweb-site-layout='modern'] .vweb-home-game-play {
  border: 0 !important;
  border-bottom: 3px solid #00a4ef !important;
  border-radius: 0 !important;
  background: #242424 !important;
  color: #fff !important;
}
html[data-vweb-site-layout='modern'] .vweb-home-game-play:hover,
html[data-vweb-site-layout='modern'] .vweb-home-game-play:focus-visible { background: #0078d4 !important; }
html[data-vweb-site-layout='modern'] #search-input {
  border: 0 !important;
  border-bottom: 2px solid #00a4ef !important;
  border-radius: 0 !important;
  background: #272727 !important;
}
html[data-vweb-site-layout='modern'][data-vweb-site-page='game'] .game-banner,
html[data-vweb-site-layout='modern'][data-vweb-site-page='game'] .game-description-box,
html[data-vweb-site-layout='modern'][data-vweb-site-page='game'] .btn-play,
html[data-vweb-site-layout='modern'][data-vweb-site-page='game'] .vweb-play-browser-btn {
  border-radius: 0 !important;
}
html[data-vweb-site-layout='modern'][data-vweb-site-page='game'] .btn-play,
html[data-vweb-site-layout='modern'][data-vweb-site-page='game'] .vweb-play-browser-btn {
  border: 0 !important;
  border-bottom: 3px solid #00a4ef !important;
  background: #242424 !important;
  color: #fff !important;
}
html[data-vweb-site-layout='modern'][data-vweb-site-page='game'] .btn-play:hover,
html[data-vweb-site-layout='modern'][data-vweb-site-page='game'] .vweb-play-browser-btn:hover {
  background: #0078d4 !important;
}
html[data-vweb-site-layout='modern'] .site-footer { border-top: 3px solid #00a4ef !important; background: #161616 !important; }
html[data-vweb-site-layout='modern'] button:hover,
html[data-vweb-site-layout='modern'] .btn:hover,
html[data-vweb-site-layout='modern'] .navbar a:hover { background: #0078d4 !important; color: #ffffff !important; }`;

const SITE_THEME_COMPACT = `/* Vortex Web compact site theme */
:root {
  --bgcol1: #121212;
  --bgcol2: #202020;
  --bgcol3: #292929;
  --bgcoltopbar: #151515;
}
.container,
.profile-header,
.game-card,
.card,
.panel {
  border-radius: 8px !important;
}
.game-card,
.card,
.panel {
  padding: 10px !important;
}
.navbar,
.tab-bar {
  min-height: 42px !important;
}
.navbar a,
.navbar button,
.navbar .btn,
.navbar .nav-link,
.navbar .btn-signout-sm {
  background: transparent !important;
  color: var(--textcol1) !important;
  border-color: transparent !important;
  box-shadow: none !important;
  padding-top: 6px !important;
  padding-bottom: 6px !important;
}
.navbar a:hover,
.navbar button:hover,
.navbar .btn:hover,
.navbar .nav-link:hover,
.navbar .btn-signout-sm:hover {
  background: rgba(255, 255, 255, 0.08) !important;
}
body[data-vweb-ugc-route="1"] {
  --vweb-ugc-bg: #121212;
  --vweb-ugc-panel: #202020;
  --vweb-ugc-panel-strong: #242424;
  --vweb-ugc-panel-soft: #292929;
  --vweb-ugc-input: #171717;
  --vweb-ugc-border: rgba(255, 255, 255, 0.16);
  --vweb-ugc-border-soft: rgba(255, 255, 255, 0.10);
  --vweb-ugc-text: rgba(245, 245, 245, 0.94);
  --vweb-ugc-heading: #ffffff;
  --vweb-ugc-muted: rgba(245, 245, 245, 0.64);
  --vweb-ugc-faint: rgba(245, 245, 245, 0.52);
  --vweb-ugc-accent: #7dd3fc;
  --vweb-ugc-accent-soft: rgba(125, 211, 252, 0.18);
  --vweb-ugc-button: rgba(255, 255, 255, 0.07);
  --vweb-ugc-button-hover: rgba(255, 255, 255, 0.12);
  --vweb-ugc-canvas-bg: #090909;
  --vweb-ugc-nav-menu: rgba(21, 21, 21, 0.96);
}
.vweb-ugc-nav-menu {
  background: rgba(21, 21, 21, 0.96) !important;
  border-color: rgba(255, 255, 255, 0.14) !important;
}
.vweb-ugc-nav-menu a {
  color: rgba(245, 245, 245, 0.94) !important;
}`;

const RUNTIME_THEME_DEFAULT = "";

const RUNTIME_THEME_DARK = `/* Dark solid in-game theme */
:root {
  --vw-ui-glass: #111827;
  --vw-ui-glass-strong: #0f172a;
  --vw-ui-glass-menu: #111827;
  --vw-ui-border: rgba(226,232,240,0.18);
  --vw-ui-border-soft: rgba(226,232,240,0.12);
  --vw-ui-text: rgba(248,250,252,0.94);
  --vw-ui-muted: rgba(226,232,240,0.62);
  --vw-ui-accent: #60a5fa;
  --vw-ui-accent-hover: #93c5fd;
  --vw-menu-surface: #111827;
  --vw-menu-bar-surface: #0f172a;
  --vw-panel-surface: #1f2937;
  --vw-panel-border: rgba(226,232,240,0.16);
  --vw-dependent-surface: #273244;
  --vw-control-surface: #334155;
  --vw-control-border: rgba(226,232,240,0.18);
  --vw-tab-surface: #293548;
}`;

const RUNTIME_THEME_LIGHT = `/* Light solid in-game theme */
:root {
  --vw-ui-glass: #f8fafc;
  --vw-ui-glass-strong: #ffffff;
  --vw-ui-glass-menu: #f8fafc;
  --vw-ui-border: rgba(15,23,42,0.18);
  --vw-ui-border-soft: rgba(15,23,42,0.12);
  --vw-ui-text: rgba(15,23,42,0.92);
  --vw-ui-muted: rgba(15,23,42,0.58);
  --vw-ui-faint: rgba(15,23,42,0.36);
  --vw-ui-accent: #2563eb;
  --vw-ui-accent-hover: #1d4ed8;
  --vw-ui-shadow: 0 18px 46px rgba(15,23,42,0.14);
  --vw-menu-surface: #f8fafc;
  --vw-menu-bar-surface: #eef2f7;
  --vw-panel-surface: #ffffff;
  --vw-panel-border: rgba(15,23,42,0.16);
  --vw-dependent-surface: #eef2f7;
  --vw-control-surface: #ffffff;
  --vw-control-border: rgba(15,23,42,0.18);
  --vw-tab-surface: #f1f5f9;
  --vw-active-surface: linear-gradient(135deg, rgba(37,99,235,0.28), rgba(96,165,250,0.18));
  --vw-active-border: rgba(37,99,235,0.34);
}
#chat-window,
.lb-panel,
#lb-player-panel,
.notif {
  color: var(--vw-ui-text);
}`;

const RUNTIME_THEME_DARK_GLASS = `/* Dark clear glass in-game theme */
:root {
  --vw-ui-glass: linear-gradient(135deg, rgba(5,10,18,0.54), rgba(5,10,18,0.26));
  --vw-ui-glass-strong: linear-gradient(135deg, rgba(5,10,18,0.64), rgba(5,10,18,0.34));
  --vw-ui-glass-menu: linear-gradient(135deg, rgba(5,10,18,0.50), rgba(5,10,18,0.22));
  --vw-ui-border: rgba(255,255,255,0.22);
  --vw-ui-border-soft: rgba(255,255,255,0.14);
  --vw-ui-text: rgba(248,250,252,0.94);
  --vw-ui-muted: rgba(255,255,255,0.58);
  --vw-ui-accent: #3b82f6;
  --vw-ui-accent-hover: #60a5fa;
  --vw-menu-surface: linear-gradient(135deg, rgba(5,10,18,0.52), rgba(5,10,18,0.22));
  --vw-menu-bar-surface: linear-gradient(135deg, rgba(5,10,18,0.46), rgba(5,10,18,0.18));
  --vw-panel-surface: linear-gradient(135deg, rgba(15,23,42,0.42), rgba(15,23,42,0.18));
  --vw-panel-border: rgba(255,255,255,0.17);
  --vw-dependent-surface: linear-gradient(135deg, rgba(15,23,42,0.34), rgba(15,23,42,0.14));
  --vw-control-surface: linear-gradient(135deg, rgba(30,41,59,0.48), rgba(30,41,59,0.22));
  --vw-control-border: rgba(255,255,255,0.20);
  --vw-tab-surface: linear-gradient(135deg, rgba(15,23,42,0.40), rgba(15,23,42,0.16));
}`;

const RUNTIME_THEME_LIGHT_GLASS = `/* Light clear in-game theme */
:root {
  --vw-ui-glass: linear-gradient(135deg, rgba(255,255,255,.78), rgba(241,245,249,.58));
  --vw-ui-glass-strong: linear-gradient(135deg, rgba(255,255,255,.90), rgba(241,245,249,.72));
  --vw-ui-glass-menu: linear-gradient(135deg, rgba(255,255,255,.82), rgba(241,245,249,.62));
  --vw-ui-border: rgba(15,23,42,.20);
  --vw-ui-border-soft: rgba(15,23,42,.12);
  --vw-ui-text: rgba(15,23,42,.94);
  --vw-ui-muted: rgba(15,23,42,.62);
  --vw-ui-faint: rgba(15,23,42,.42);
  --vw-ui-accent: #2563eb;
  --vw-menu-surface: rgba(255,255,255,.76);
  --vw-menu-bar-surface: rgba(241,245,249,.72);
  --vw-panel-surface: rgba(255,255,255,.62);
  --vw-panel-border: rgba(15,23,42,.16);
  --vw-dependent-surface: rgba(241,245,249,.60);
  --vw-control-surface: rgba(255,255,255,.72);
  --vw-control-border: rgba(15,23,42,.18);
  --vw-tab-surface: rgba(241,245,249,.66);
}`;

const RUNTIME_THEME_ROBLOX_2007 = `/* Roblox 2007-inspired in-game theme */
:root {
  --vw-ui-radius: 2px;
  --vw-ui-radius-sm: 2px;
  --vw-ui-glass: #eeeeee;
  --vw-ui-glass-strong: #ffffff;
  --vw-ui-glass-menu: #eeeeee;
  --vw-ui-border: #888888;
  --vw-ui-border-soft: #b0b0b0;
  --vw-ui-text: #202020;
  --vw-ui-muted: #555555;
  --vw-ui-accent: #0055aa;
  --vw-menu-surface: #eeeeee;
  --vw-menu-bar-surface: #d8d8d8;
  --vw-panel-surface: #ffffff;
  --vw-panel-border: #999999;
  --vw-control-surface: linear-gradient(#ffffff, #d7d7d7);
  --vw-control-border: #888888;
  --vw-tab-surface: #dddddd;
}`;

const RUNTIME_THEME_METRO = `/* Metro-inspired in-game theme */
:root {
  --vw-ui-radius: 0px;
  --vw-ui-radius-sm: 0px;
  --vw-ui-glass: rgba(17,17,17,.92);
  --vw-ui-glass-strong: rgba(12,12,12,.96);
  --vw-ui-glass-menu: rgba(17,17,17,.94);
  --vw-ui-border: rgba(255,255,255,.18);
  --vw-ui-border-soft: rgba(255,255,255,.10);
  --vw-ui-text: #f4f4f4;
  --vw-ui-muted: #b8b8b8;
  --vw-ui-accent: #00a4ef;
  --vw-menu-surface: #171717;
  --vw-menu-bar-surface: #111111;
  --vw-panel-surface: #202020;
  --vw-panel-border: rgba(255,255,255,.16);
  --vw-dependent-surface: #252525;
  --vw-control-surface: #2b2b2b;
  --vw-control-border: rgba(255,255,255,.18);
  --vw-tab-surface: #242424;
}`;

const RUNTIME_THEME_COMPACT_DENSITY = `
:root {
  --vw-ui-radius: 6px;
  --vw-ui-radius-sm: 5px;
}
#chat-window {
  width: 330px;
  max-height: 200px;
}
#leaderboard {
  width: 220px;
}
.vw-menu-content {
  padding: 12px;
}
.sp-row,
.vw-field,
.vw-toggle-row,
.vw-keybind-row {
  min-height: 38px !important;
  padding-top: 7px !important;
  padding-bottom: 7px !important;
}`;

const RUNTIME_THEME_COMPACT = `/* Compact dark in-game theme */
${RUNTIME_THEME_DARK}
${RUNTIME_THEME_COMPACT_DENSITY}`;

const RUNTIME_THEME_COMPACT_GLASS = `/* Compact clear glass in-game theme */
${RUNTIME_THEME_DARK_GLASS}
${RUNTIME_THEME_COMPACT_DENSITY}`;

const SITE_NAV_ITEMS = ["catalog", "ugc", "download", "discord", "profile", "settings", "signout"];
const SITE_NAV_LABELS = {
  catalog: "Catalog",
  ugc: "UGC Labs",
  download: "Download",
  discord: "Discord",
  profile: "Profile",
  settings: "Settings",
  signout: "Sign out"
};
const DEFAULT_SITE_THEME_CONFIG = { layout: "modern", navOrder: [...SITE_NAV_ITEMS], navHidden: [] };
const CLASSIC_SITE_THEME_CONFIG = { layout: "classic", navOrder: [...SITE_NAV_ITEMS], navHidden: [] };
const BUILT_IN_THEME_IDS = new Set(["default", "classic", "light-clear", "roblox-2007", "metro", "full"]);
const LEGACY_THEME_IDS = new Set(["dark", "light", "dark-glass", "light-glass", "compact", "compact-glass", "glass", "solid"]);

const THEME_PRESETS = {
  default: {
    site: "",
    runtime: RUNTIME_THEME_DEFAULT
  },
  classic: {
    site: "",
    runtime: RUNTIME_THEME_DEFAULT
  },
  full: {
    site: null,
    runtime: null
  },
  "light-clear": {
    site: SITE_THEME_LIGHT_CLEAR,
    runtime: RUNTIME_THEME_LIGHT_GLASS
  },
  "roblox-2007": {
    site: SITE_THEME_ROBLOX_2007,
    runtime: RUNTIME_THEME_ROBLOX_2007
  },
  metro: {
    site: SITE_THEME_METRO,
    runtime: RUNTIME_THEME_METRO
  }
};

const THEME_PRESET_OPTIONS = {
  site: [
    { id: "default", label: "Dark clear", description: "The current Vortex Web site style." },
    { id: "light-clear", label: "Light clear", description: "A readable light glass treatment for the full site and UGC tools." },
    { id: "roblox-2007", label: "Roblox 2007", description: "Compact grey panels, classic borders, and period-style controls." },
    { id: "metro", label: "Metro", description: "Flat surfaces, square controls, and a restrained blue accent." },
    { id: "classic", label: "Classic site", description: "Restores the original Vortex page layout without Vortex Web discovery." },
    { id: "full", label: "Full CSS", description: "Loads the complete packaged site stylesheet as an editable starting point." }
  ],
  runtime: [
    { id: "default", label: "Dark clear", description: "The current transparent in-game interface." },
    { id: "light-clear", label: "Light clear", description: "A high-contrast light glass interface." },
    { id: "roblox-2007", label: "Roblox 2007", description: "Classic grey game panels and compact controls." },
    { id: "metro", label: "Metro", description: "Flat, square in-game panels with a blue accent." },
    { id: "full", label: "Full CSS", description: "Loads the complete packaged in-game stylesheet as an editable starting point." }
  ]
};

const DEFAULTS = {
  hubUrl: HOSTED_NATIVE_RELAY,
  licenseApiUrl: HOSTED_LICENSE_API,
  licenseKey: "",
  chatNameGradients: true,
  leaderboardCosmetics: true,
  miniProfileCosmetics: true,
  siteProfileCosmetics: true,
  vwebThemeSite: "default",
  vwebThemeRuntime: "default",
  vwebThemeSiteCss: "",
  vwebThemeSiteConfig: DEFAULT_SITE_THEME_CONFIG,
  vwebThemeRuntimeCss: RUNTIME_THEME_DEFAULT,
  vwebThemeLibrary: null,
  vwebLastLicenseLease: null,
  vortexWebProfileAuth: null,
  vortexWebCosmetics: null
};

const els = {
  versionLabel: byId("versionLabel"),
  hostedRelayBtn: byId("hostedRelayBtn"),
  localRelayBtn: byId("localRelayBtn"),
  connectionDot: byId("connectionDot"),
  localRelayField: byId("localRelayField"),
  hubUrl: byId("hubUrl"),
  licenseKey: byId("licenseKey"),
  leaseStatus: byId("leaseStatus"),
  tierStatus: byId("tierStatus"),
  featureStatus: byId("featureStatus"),
  accountStatus: byId("accountStatus"),
  sessionCapStatus: byId("sessionCapStatus"),
  accountCapStatus: byId("accountCapStatus"),
  ugcUploadStatus: byId("ugcUploadStatus"),
  ugcBandwidthStatus: byId("ugcBandwidthStatus"),
  ugcQueueStatus: byId("ugcQueueStatus"),
  siteProfileCosmetics: byId("siteProfileCosmetics"),
  chatNameGradients: byId("chatNameGradients"),
  leaderboardCosmetics: byId("leaderboardCosmetics"),
  miniProfileCosmetics: byId("miniProfileCosmetics"),
  themeCss: byId("themeCss"),
  themeSelect: byId("themeSelect"),
  themeName: byId("themeName"),
  saveThemeBtn: byId("saveThemeBtn"),
  deleteThemeBtn: byId("deleteThemeBtn"),
  themeEditorLabel: byId("themeEditorLabel"),
  themePresetList: byId("themePresetList"),
  themePresetScope: byId("themePresetScope"),
  themePresetDescription: byId("themePresetDescription"),
  siteThemeTab: byId("siteThemeTab"),
  runtimeThemeTab: byId("runtimeThemeTab"),
  siteThemeControls: byId("siteThemeControls"),
  siteLayoutMode: byId("siteLayoutMode"),
  siteNavEditor: byId("siteNavEditor"),
  exportSettingsBtn: byId("exportSettingsBtn"),
  resetSettingsBtn: byId("resetSettingsBtn"),
  toast: byId("toast")
};

let saveTimer = 0;
let activeThemeTarget = "site";

init().catch(() => showToast("Could not load settings"));

async function init() {
  els.versionLabel.textContent = `Version ${extensionApi.runtime?.getManifest?.().version || "0.0.0"}`;
  const stored = await storageGet(DEFAULTS);
  await ensureConnectionDefaults(stored);
  await ensureThemeDefaults();
  render(await storageGet(DEFAULTS));
  bind();
}

function bind() {
  els.hostedRelayBtn.addEventListener("click", async () => {
    await storageSet({ hubUrl: HOSTED_NATIVE_RELAY, licenseApiUrl: HOSTED_LICENSE_API });
    render(await storageGet(DEFAULTS));
    showToast("Hosted relay selected");
  });

  els.localRelayBtn.addEventListener("click", async () => {
    const current = normalizeHubUrl(els.hubUrl.value || LOCAL_NATIVE_RELAY);
    await storageSet({ hubUrl: isLocalRelayUrl(current) ? current : LOCAL_NATIVE_RELAY, licenseApiUrl: HOSTED_LICENSE_API });
    render(await storageGet(DEFAULTS));
    showToast("Local relay selected");
  });

  els.hubUrl.addEventListener("input", () => scheduleSave());
  els.hubUrl.addEventListener("change", () => scheduleSave());

  for (const input of [
    els.licenseKey,
    els.siteProfileCosmetics,
    els.chatNameGradients,
    els.leaderboardCosmetics,
    els.miniProfileCosmetics
  ]) {
    input.addEventListener("input", () => scheduleSave());
    input.addEventListener("change", () => scheduleSave());
  }

  els.themeCss.addEventListener("input", () => scheduleSave());
  els.themeCss.addEventListener("change", () => scheduleSave());
  els.themeSelect.addEventListener("change", () => selectSavedTheme(els.themeSelect.value));
  els.saveThemeBtn.addEventListener("click", () => saveNamedTheme());
  els.deleteThemeBtn.addEventListener("click", () => deleteNamedTheme());
  els.siteLayoutMode.addEventListener("change", () => scheduleSave());
  els.siteNavEditor.addEventListener("change", () => scheduleSave());
  els.siteNavEditor.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-nav-move]");
    if (!button) return;
    const row = button.closest("[data-nav-id]");
    const sibling = button.dataset.navMove === "up" ? row?.previousElementSibling : row?.nextElementSibling;
    if (!row || !sibling) return;
    if (button.dataset.navMove === "up") row.parentElement.insertBefore(row, sibling);
    else row.parentElement.insertBefore(sibling, row);
    scheduleSave();
  });

  els.siteThemeTab.addEventListener("click", () => void switchThemeTarget("site"));
  els.runtimeThemeTab.addEventListener("click", () => void switchThemeTarget("runtime"));

  els.themePresetList.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-theme-preset]");
    if (button) void applyThemePreset(button.dataset.themePreset || "default");
  });

  for (const button of document.querySelectorAll("[data-token]")) {
    button.addEventListener("click", () => insertThemeToken(button.dataset.token || ""));
  }

  els.exportSettingsBtn.addEventListener("click", async () => {
    const stored = await storageGet(DEFAULTS);
    const exportable = {
      chatNameGradients: stored.chatNameGradients !== false,
      leaderboardCosmetics: stored.leaderboardCosmetics !== false,
      miniProfileCosmetics: stored.miniProfileCosmetics !== false,
      siteProfileCosmetics: stored.siteProfileCosmetics !== false,
      vwebThemeSite: stored.vwebThemeSite || "default",
      vwebThemeRuntime: stored.vwebThemeRuntime || "default",
      vwebThemeSiteCss: stored.vwebThemeSiteCss || "",
      vwebThemeSiteConfig: normalizeSiteThemeConfig(stored.vwebThemeSiteConfig),
      vwebThemeRuntimeCss: stored.vwebThemeRuntimeCss || "",
      vwebThemeLibrary: normalizeThemeLibrary(stored.vwebThemeLibrary)
    };
    await navigator.clipboard?.writeText(JSON.stringify(exportable, null, 2)).catch(() => null);
    showToast("Settings copied without license key");
  });

  els.resetSettingsBtn.addEventListener("click", async () => {
    await storageSet({
      chatNameGradients: true,
      leaderboardCosmetics: true,
      miniProfileCosmetics: true,
      siteProfileCosmetics: true,
      vwebThemeSite: "default",
      vwebThemeRuntime: "default",
      vwebThemeSiteCss: "",
      vwebThemeSiteConfig: DEFAULT_SITE_THEME_CONFIG,
      vwebThemeRuntimeCss: RUNTIME_THEME_DEFAULT,
      vwebThemeLibrary: defaultThemeLibrary()
    });
    render(await storageGet(DEFAULTS));
    showToast("Display settings reset");
  });
}

function render(stored) {
  const local = isLocalRelayUrl(stored.hubUrl || HOSTED_NATIVE_RELAY);
  els.hubUrl.value = local ? stored.hubUrl : LOCAL_NATIVE_RELAY;
  els.localRelayField.hidden = !local;
  els.localRelayBtn.classList.toggle("active", local);
  els.hostedRelayBtn.classList.toggle("active", !local);
  els.connectionDot.classList.toggle("local", local);

  els.licenseKey.value = stored.licenseKey || "";
  els.siteProfileCosmetics.checked = stored.siteProfileCosmetics !== false;
  els.chatNameGradients.checked = stored.chatNameGradients !== false;
  els.leaderboardCosmetics.checked = stored.leaderboardCosmetics !== false;
  els.miniProfileCosmetics.checked = stored.miniProfileCosmetics !== false;

  renderLease(stored);
  renderThemeEditor(stored);
}

function renderLease(stored) {
  const wrapped = stored.vwebLastLicenseLease && typeof stored.vwebLastLicenseLease === "object" ? stored.vwebLastLicenseLease : null;
  const activation = wrapped?.activation && typeof wrapped.activation === "object" ? wrapped.activation : wrapped;
  const lease = activation?.lease && typeof activation.lease === "object" ? activation.lease : wrapped?.lease && typeof wrapped.lease === "object" ? wrapped.lease : wrapped;
  const savedAt = Number(wrapped?.savedAt || 0);
  if (!lease) {
    els.leaseStatus.textContent = "None";
    els.tierStatus.textContent = "Unknown";
    els.featureStatus.textContent = "Unknown";
    els.accountStatus.textContent = linkedAccountsLabel(stored) || "Unknown";
    renderLimitRows(null);
    return;
  }

  els.leaseStatus.textContent = savedAt ? `Saved ${new Date(savedAt).toLocaleString()}` : "Available";
  els.tierStatus.textContent = formatTier(activation?.tier || lease.tier || "unknown");
  const features = readFeatureList(lease);
  els.featureStatus.textContent = features.length ? features.map(formatFeatureName).join(", ") : "None in saved lease";
  els.accountStatus.textContent = linkedAccountsLabel(stored) || "Not included in saved lease";
  renderLimitRows(activation);
}

function renderLimitRows(activation) {
  const limits = activation?.limits && typeof activation.limits === "object" ? activation.limits : {};
  const session = limits.sessions && typeof limits.sessions === "object" ? limits.sessions : {};
  const account = limits.accounts && typeof limits.accounts === "object" ? limits.accounts : {};
  const ugc = limits.ugc && typeof limits.ugc === "object" ? limits.ugc : {};
  els.sessionCapStatus.textContent = session.effectiveMax != null ? formatEffectiveCap(session) : "Unknown";
  els.accountCapStatus.textContent = account.effectiveMax != null ? formatEffectiveCap(account) : activation?.max_accounts != null ? formatCap(activation.max_accounts) : "Unknown";
  els.ugcUploadStatus.textContent = ugc.maxUploadBytes ? formatBytes(ugc.maxUploadBytes) : "Unknown";
  els.ugcBandwidthStatus.textContent = ugc.dailyBytes ? `${formatBytes(ugc.dailyBytes)} / day` : "Unknown";
  els.ugcQueueStatus.textContent = ugc.pendingItems || ugc.dailySubmissions
    ? `${formatNumber(ugc.pendingItems)} pending, ${formatNumber(ugc.dailySubmissions)} submits/day`
    : "Unknown";
}

function formatEffectiveCap(limit) {
  const raw = Number(limit.rawOverride || 0);
  const effective = Number(limit.effectiveMax || 0);
  const tierDefault = Number(limit.tierDefault || 0);
  if (raw > 0) return `Override: ${formatCap(raw)}`;
  return `Tier default: ${formatCap(tierDefault || effective)}`;
}

function formatCap(value) {
  const numeric = Number(value || 0);
  return numeric > 0 ? String(numeric) : "Unlimited";
}

function formatNumber(value) {
  const numeric = Number(value || 0);
  return numeric > 0 ? numeric.toLocaleString() : "0";
}

function formatBytes(value) {
  const bytes = Number(value || 0);
  if (!Number.isFinite(bytes) || bytes <= 0) return "Unknown";
  const units = ["B", "KB", "MB", "GB"];
  let amount = bytes;
  let unit = 0;
  while (amount >= 1024 && unit < units.length - 1) {
    amount /= 1024;
    unit += 1;
  }
  return `${amount >= 10 || unit === 0 ? amount.toFixed(0) : amount.toFixed(1)} ${units[unit]}`;
}

function formatTier(value) {
  return String(value || "unknown")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function readFeatureList(lease) {
  if (Array.isArray(lease.allowed_features)) return lease.allowed_features.filter(Boolean);
  if (Array.isArray(lease.allowedFeatures)) return lease.allowedFeatures.filter(Boolean);
  if (Array.isArray(lease.features)) return lease.features.filter(Boolean);
  if (lease.features && typeof lease.features === "object") {
    return Object.entries(lease.features).filter(([, enabled]) => enabled).map(([name]) => name);
  }
  return [];
}

function linkedAccountsLabel(stored) {
  const authRecords = stored.vortexWebProfileAuth?.records && typeof stored.vortexWebProfileAuth.records === "object"
    ? Object.values(stored.vortexWebProfileAuth.records)
    : [];
  const accounts = authRecords
    .map((record) => {
      const id = Number(record?.userId);
      if (!Number.isFinite(id) || id <= 0) return null;
      const username = String(record?.username || "").trim();
      return username ? `${username} (${id})` : `User ${id}`;
    })
    .filter(Boolean);

  const ownUserId = Number(stored.vortexWebCosmetics?.ownUserId || 0);
  if (!accounts.length && Number.isFinite(ownUserId) && ownUserId > 0) accounts.push(`User ${ownUserId}`);
  return accounts.length ? accounts.slice(0, 3).join(", ") : "";
}

function formatFeatureName(value) {
  return String(value)
    .replace(/^vortex-/, "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function renderThemeEditor(stored) {
  const library = normalizeThemeLibrary(stored.vwebThemeLibrary);
  const activeId = activeThemeTarget === "site" ? stored.vwebThemeSite || "default" : stored.vwebThemeRuntime || "default";
  renderThemeSelect(library, activeId);
  els.siteThemeTab.classList.toggle("active", activeThemeTarget === "site");
  els.runtimeThemeTab.classList.toggle("active", activeThemeTarget === "runtime");
  els.siteThemeControls.hidden = activeThemeTarget !== "site";
  renderThemePresets(activeId);
  els.themeEditorLabel.textContent = activeThemeTarget === "site" ? "Site theme CSS" : "In-game theme CSS";
  const activeTheme = library[activeThemeTarget]?.[activeId] || null;
  els.themeName.value = activeTheme?.name || (activeId === "default" ? "Default" : activeId);
  els.themeCss.value = activeThemeTarget === "site" ? stored.vwebThemeSiteCss || activeTheme?.css || "" : stored.vwebThemeRuntimeCss || activeTheme?.css || "";
  if (activeThemeTarget === "site") {
    renderSiteThemeConfig(activeTheme?.siteConfig || stored.vwebThemeSiteConfig || DEFAULT_SITE_THEME_CONFIG);
  }
}

async function switchThemeTarget(target) {
  if (target !== "site" && target !== "runtime") return;
  await save("Saved");
  activeThemeTarget = target;
  renderThemeEditor(await storageGet(DEFAULTS));
}

async function applyThemePreset(name) {
  const preset = THEME_PRESETS[name] || THEME_PRESETS.default;
  const css = name === "full"
    ? await loadCurrentDefaultCss(activeThemeTarget)
    : activeThemeTarget === "site" ? preset.site : preset.runtime;
  els.themeCss.value = css || "";
  const id = name;
  const label = presetLabel(name);
  const siteConfig = activeThemeTarget === "site"
    ? name === "classic" ? CLASSIC_SITE_THEME_CONFIG : DEFAULT_SITE_THEME_CONFIG
    : undefined;
  await upsertActiveTheme(id, label, els.themeCss.value, siteConfig);
  showToast("Theme preset applied");
}

function renderThemePresets(activeId) {
  const options = THEME_PRESET_OPTIONS[activeThemeTarget] || [];
  els.themePresetScope.textContent = activeThemeTarget === "site" ? "Site" : "In-game";
  els.themePresetList.replaceChildren(...options.map((preset) => {
    const button = document.createElement("button");
    button.className = `preset-btn${preset.id === activeId ? " active" : ""}`;
    button.setAttribute("aria-pressed", String(preset.id === activeId));
    button.type = "button";
    button.dataset.themePreset = preset.id;
    button.textContent = preset.label;
    button.title = preset.description;
    return button;
  }));
  const activePreset = options.find((preset) => preset.id === activeId);
  els.themePresetDescription.textContent = activePreset?.description || (activeThemeTarget === "site"
    ? "Site presets can also change navigation layout and visibility."
    : "In-game presets only style the client interface.");
}

async function selectSavedTheme(id) {
  const stored = await storageGet(DEFAULTS);
  const library = normalizeThemeLibrary(stored.vwebThemeLibrary);
  const theme = library[activeThemeTarget]?.[id] || library[activeThemeTarget]?.default;
  if (!theme) return;
  const patch = activeThemeTarget === "site"
    ? { vwebThemeSite: id, vwebThemeSiteCss: theme.css, vwebThemeSiteConfig: normalizeSiteThemeConfig(theme.siteConfig) }
    : { vwebThemeRuntime: id, vwebThemeRuntimeCss: theme.css };
  await storageSet(patch);
  render(await storageGet(DEFAULTS));
  showToast("Theme selected");
}

async function saveNamedTheme() {
  const rawName = els.themeName.value.trim() || "Custom theme";
  const id = slugThemeName(rawName);
  await upsertActiveTheme(id, rawName, els.themeCss.value, activeThemeTarget === "site" ? readSiteThemeConfig() : undefined);
  showToast("Theme saved");
}

async function deleteNamedTheme() {
  const id = els.themeSelect.value;
  if (!id || BUILT_IN_THEME_IDS.has(id)) {
    showToast("Built-in themes cannot be deleted");
    return;
  }
  const stored = await storageGet(DEFAULTS);
  const library = normalizeThemeLibrary(stored.vwebThemeLibrary);
  delete library[activeThemeTarget][id];
  const patch = activeThemeTarget === "site"
    ? {
        vwebThemeLibrary: library,
        vwebThemeSite: "default",
        vwebThemeSiteCss: library.site.default.css,
        vwebThemeSiteConfig: normalizeSiteThemeConfig(library.site.default.siteConfig)
      }
    : { vwebThemeLibrary: library, vwebThemeRuntime: "default", vwebThemeRuntimeCss: library.runtime.default.css };
  await storageSet(patch);
  render(await storageGet(DEFAULTS));
  showToast("Theme deleted");
}

async function upsertActiveTheme(id, name, css, siteConfig) {
  const stored = await storageGet(DEFAULTS);
  const library = normalizeThemeLibrary(stored.vwebThemeLibrary);
  library[activeThemeTarget][id] = {
    id,
    name,
    css: String(css || ""),
    ...(activeThemeTarget === "site" ? { siteConfig: normalizeSiteThemeConfig(siteConfig) } : {}),
    updatedAt: Date.now()
  };
  const patch = activeThemeTarget === "site"
    ? {
        vwebThemeLibrary: library,
        vwebThemeSite: id,
        vwebThemeSiteCss: css,
        vwebThemeSiteConfig: normalizeSiteThemeConfig(siteConfig)
      }
    : { vwebThemeLibrary: library, vwebThemeRuntime: id, vwebThemeRuntimeCss: css };
  await storageSet(patch);
  render(await storageGet(DEFAULTS));
}

function renderThemeSelect(library, activeId) {
  const themes = Object.values(library[activeThemeTarget] || {});
  els.themeSelect.innerHTML = "";
  for (const theme of themes.sort((left, right) => left.name.localeCompare(right.name))) {
    const option = document.createElement("option");
    option.value = theme.id;
    option.textContent = theme.name;
    els.themeSelect.appendChild(option);
  }
  els.themeSelect.value = themes.some((theme) => theme.id === activeId) ? activeId : "default";
}

function insertThemeToken(token) {
  if (!token) return;
  const input = els.themeCss;
  const start = input.selectionStart ?? input.value.length;
  const end = input.selectionEnd ?? input.value.length;
  input.value = `${input.value.slice(0, start)}${token}${input.value.slice(end)}`;
  input.focus();
  input.setSelectionRange(start + token.length, start + token.length);
  scheduleSave("Token inserted");
}

function scheduleSave(label = "Saved") {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => save(label), 180);
}

async function save(label) {
  const stored = await storageGet(DEFAULTS);
  const local = isLocalRelayUrl(stored.hubUrl || HOSTED_NATIVE_RELAY);
  const library = normalizeThemeLibrary(stored.vwebThemeLibrary);
  const activeId = activeThemeTarget === "site" ? stored.vwebThemeSite || "default" : stored.vwebThemeRuntime || "default";
  const currentTheme = library[activeThemeTarget][activeId] || library[activeThemeTarget].default;
  library[activeThemeTarget][currentTheme.id] = {
    ...currentTheme,
    name: els.themeName.value.trim() || currentTheme.name,
    css: els.themeCss.value,
    ...(activeThemeTarget === "site" ? { siteConfig: readSiteThemeConfig() } : {}),
    updatedAt: Date.now()
  };
  const themePatch = activeThemeTarget === "site"
    ? {
        vwebThemeLibrary: library,
        vwebThemeSite: currentTheme.id,
        vwebThemeSiteCss: els.themeCss.value,
        vwebThemeSiteConfig: readSiteThemeConfig()
      }
    : { vwebThemeLibrary: library, vwebThemeRuntime: currentTheme.id, vwebThemeRuntimeCss: els.themeCss.value };
  const next = {
    hubUrl: local ? normalizeHubUrl(els.hubUrl.value || LOCAL_NATIVE_RELAY) : HOSTED_NATIVE_RELAY,
    licenseApiUrl: HOSTED_LICENSE_API,
    licenseKey: els.licenseKey.value.trim(),
    siteProfileCosmetics: els.siteProfileCosmetics.checked,
    chatNameGradients: els.chatNameGradients.checked,
    leaderboardCosmetics: els.leaderboardCosmetics.checked,
    miniProfileCosmetics: els.miniProfileCosmetics.checked,
    ...themePatch
  };
  await storageSet(next);
  showToast(label);
}

function normalizeHubUrl(value) {
  return String(value || LOCAL_NATIVE_RELAY).trim().replace(/^http:/, "ws:").replace(/^https:/, "wss:");
}

function normalizeSiteThemeConfig(value) {
  const source = value && typeof value === "object" ? value : {};
  const order = Array.isArray(source.navOrder)
    ? source.navOrder.filter((item) => SITE_NAV_ITEMS.includes(item))
    : [];
  for (const item of SITE_NAV_ITEMS) {
    if (!order.includes(item)) order.push(item);
  }
  const hidden = Array.isArray(source.navHidden)
    ? [...new Set(source.navHidden.filter((item) => SITE_NAV_ITEMS.includes(item)))]
    : [];
  return {
    layout: source.layout === "classic" ? "classic" : "modern",
    navOrder: order,
    navHidden: hidden
  };
}

function renderSiteThemeConfig(value) {
  const config = normalizeSiteThemeConfig(value);
  els.siteLayoutMode.value = config.layout;
  els.siteNavEditor.innerHTML = "";
  for (const id of config.navOrder) {
    const row = document.createElement("div");
    row.className = "site-nav-row";
    row.dataset.navId = id;
    const label = document.createElement("label");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = !config.navHidden.includes(id);
    checkbox.setAttribute("aria-label", `Show ${SITE_NAV_LABELS[id]}`);
    const text = document.createElement("span");
    text.textContent = SITE_NAV_LABELS[id];
    label.append(checkbox, text);
    const up = document.createElement("button");
    up.type = "button";
    up.dataset.navMove = "up";
    up.textContent = "Up";
    up.title = `Move ${SITE_NAV_LABELS[id]} left`;
    const down = document.createElement("button");
    down.type = "button";
    down.dataset.navMove = "down";
    down.textContent = "Down";
    down.title = `Move ${SITE_NAV_LABELS[id]} right`;
    row.append(label, up, down);
    els.siteNavEditor.appendChild(row);
  }
}

function readSiteThemeConfig() {
  const rows = Array.from(els.siteNavEditor.querySelectorAll("[data-nav-id]"));
  return normalizeSiteThemeConfig({
    layout: els.siteLayoutMode.value,
    navOrder: rows.map((row) => row.dataset.navId),
    navHidden: rows
      .filter((row) => !row.querySelector("input[type='checkbox']")?.checked)
      .map((row) => row.dataset.navId)
  });
}

function normalizeThemeLibrary(value) {
  const base = defaultThemeLibrary();
  if (!value || typeof value !== "object") return base;
  for (const target of ["site", "runtime"]) {
    const source = value[target] && typeof value[target] === "object" ? value[target] : {};
    for (const [id, theme] of Object.entries(source)) {
      if (!theme || typeof theme !== "object") continue;
      const safeId = slugThemeName(id);
      if (LEGACY_THEME_IDS.has(safeId)) continue;
      const css = String(theme.css || "");
      base[target][safeId] = {
        id: safeId,
        name: String(theme.name || id || "Theme").trim().slice(0, 64),
        css,
        ...(target === "site" ? { siteConfig: normalizeSiteThemeConfig(theme.siteConfig) } : {}),
        updatedAt: Number(theme.updatedAt || 0)
      };
    }
  }
  return base;
}

function defaultThemeLibrary() {
  return {
      site: {
        default: { id: "default", name: "Dark clear", css: "", siteConfig: DEFAULT_SITE_THEME_CONFIG, updatedAt: 0 },
        classic: { id: "classic", name: "Classic", css: "", siteConfig: CLASSIC_SITE_THEME_CONFIG, updatedAt: 0 },
        "light-clear": { id: "light-clear", name: "Light clear", css: SITE_THEME_LIGHT_CLEAR, siteConfig: DEFAULT_SITE_THEME_CONFIG, updatedAt: 0 },
        "roblox-2007": { id: "roblox-2007", name: "Roblox 2007", css: SITE_THEME_ROBLOX_2007, siteConfig: DEFAULT_SITE_THEME_CONFIG, updatedAt: 0 },
        metro: { id: "metro", name: "Metro", css: SITE_THEME_METRO, siteConfig: DEFAULT_SITE_THEME_CONFIG, updatedAt: 0 }
      },
      runtime: {
        default: { id: "default", name: "Dark clear", css: RUNTIME_THEME_DEFAULT, updatedAt: 0 },
        "light-clear": { id: "light-clear", name: "Light clear", css: RUNTIME_THEME_LIGHT_GLASS, updatedAt: 0 },
        "roblox-2007": { id: "roblox-2007", name: "Roblox 2007", css: RUNTIME_THEME_ROBLOX_2007, updatedAt: 0 },
        metro: { id: "metro", name: "Metro", css: RUNTIME_THEME_METRO, updatedAt: 0 }
      }
    };
  }

async function loadCurrentDefaultCss(target) {
  const path = target === "site" ? "styles/site-vortex-web.css" : "runtime/page/styles.css";
  try {
    const url = extensionApi.runtime.getURL(path);
    return await fetch(url, { cache: "no-store" }).then((res) => res.ok ? res.text() : "");
  } catch {
    return "";
  }
}

function slugThemeName(value) {
  const slug = String(value || "theme")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug || "theme";
}

function presetLabel(name) {
  return THEME_PRESET_OPTIONS[activeThemeTarget]?.find((preset) => preset.id === name)?.label || "Dark clear";
}

async function ensureConnectionDefaults(stored) {
  const next = {};
  if (!stored.hubUrl) next.hubUrl = HOSTED_NATIVE_RELAY;
  if (!stored.licenseApiUrl) next.licenseApiUrl = HOSTED_LICENSE_API;
  if (Object.keys(next).length) await storageSet(next);
}

async function ensureThemeDefaults() {
  const raw = await storageGet({});
  const patch = {};
  const defaults = defaultThemeLibrary();
  const library = normalizeThemeLibrary(raw.vwebThemeLibrary);
  let libraryChanged = ["site", "runtime"].some((target) => Object.keys(raw.vwebThemeLibrary?.[target] || {}).some((id) => LEGACY_THEME_IDS.has(id)));
  const oldSiteThemeId = raw.vwebThemeSite;
  const oldRuntimeThemeId = raw.vwebThemeRuntime;
  const migratedSiteThemeId = LEGACY_THEME_IDS.has(oldSiteThemeId) ? "default" : oldSiteThemeId;
  const migratedRuntimeThemeId = LEGACY_THEME_IDS.has(oldRuntimeThemeId) ? "default" : oldRuntimeThemeId;
  if (migratedSiteThemeId !== oldSiteThemeId) {
    patch.vwebThemeSite = migratedSiteThemeId;
    patch.vwebThemeSiteCss = defaults.site.default.css;
    patch.vwebThemeSiteConfig = DEFAULT_SITE_THEME_CONFIG;
  }
  for (const target of ["site", "runtime"]) {
    for (const [id, theme] of Object.entries(defaults[target])) {
      const current = library[target][id];
      const configChanged = target === "site" && JSON.stringify(normalizeSiteThemeConfig(current?.siteConfig)) !== JSON.stringify(theme.siteConfig);
      if (!current || current.css !== theme.css || configChanged) {
        library[target][id] = theme;
        libraryChanged = true;
      }
    }
  }
  if (!raw.vwebThemeLibrary || libraryChanged) patch.vwebThemeLibrary = library;
  if (typeof raw.vwebThemeSiteCss !== "string") {
    patch.vwebThemeSiteCss = defaults.site[migratedSiteThemeId || "default"]?.css || "";
  }
  if (BUILT_IN_THEME_IDS.has(migratedSiteThemeId) && defaults.site[migratedSiteThemeId] && raw.vwebThemeSiteCss !== defaults.site[migratedSiteThemeId].css) {
    patch.vwebThemeSiteCss = defaults.site[migratedSiteThemeId].css;
  }
  const activeSiteTheme = defaults.site[migratedSiteThemeId] || library.site[migratedSiteThemeId] || defaults.site.default;
  const activeSiteConfig = normalizeSiteThemeConfig(activeSiteTheme.siteConfig || raw.vwebThemeSiteConfig);
  if (JSON.stringify(normalizeSiteThemeConfig(raw.vwebThemeSiteConfig)) !== JSON.stringify(activeSiteConfig)) {
    patch.vwebThemeSiteConfig = activeSiteConfig;
  }
  if (migratedRuntimeThemeId !== oldRuntimeThemeId) {
    patch.vwebThemeRuntime = migratedRuntimeThemeId;
    patch.vwebThemeRuntimeCss = defaults.runtime[migratedRuntimeThemeId]?.css || RUNTIME_THEME_DEFAULT;
  }
  if (typeof raw.vwebThemeRuntimeCss !== "string" || (!raw.vwebThemeRuntimeCss.trim() && (!raw.vwebThemeRuntime || raw.vwebThemeRuntime === "default"))) {
    patch.vwebThemeRuntimeCss = RUNTIME_THEME_DEFAULT;
  }
  if (BUILT_IN_THEME_IDS.has(migratedRuntimeThemeId) && defaults.runtime[migratedRuntimeThemeId] && raw.vwebThemeRuntimeCss !== defaults.runtime[migratedRuntimeThemeId].css) {
    patch.vwebThemeRuntimeCss = defaults.runtime[migratedRuntimeThemeId].css;
  }
  if (!raw.vwebThemeSite) patch.vwebThemeSite = "default";
  if (!raw.vwebThemeRuntime) patch.vwebThemeRuntime = "default";
  if (Object.keys(patch).length) await storageSet(patch);
}

function isLocalRelayUrl(value) {
  try {
    const parsed = new URL(value);
    return (parsed.protocol === "ws:" || parsed.protocol === "wss:") &&
      ["127.0.0.1", "localhost", "[::1]", "::1"].includes(parsed.hostname);
  } catch {
    return false;
  }
}

function storageGet(defaults) {
  return new Promise((resolve) => {
    const result = extensionApi.storage.local.get(defaults, (stored) => resolve(stored || defaults));
    if (result && typeof result.then === "function") result.then((stored) => resolve(stored || defaults));
  });
}

function storageSet(value) {
  return new Promise((resolve) => {
    const result = extensionApi.storage.local.set(value, () => resolve(true));
    if (result && typeof result.then === "function") result.then(() => resolve(true));
  });
}

let toastTimer = 0;
function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.classList.remove("show"), 1700);
}

function byId(id) {
  return document.getElementById(id);
}
