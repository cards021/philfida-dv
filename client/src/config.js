// App configuration.
//
// The old PHP pages injected a small `window.APP_CONFIG` object with the
// handful of values that genuinely need to be server-provided per session.
// In the new world there is no server-rendered config: the backend exposes
// GET /api/bootstrap instead, which this module fetches before anything
// interactive renders. A 401 means the session is gone → back to login.

export const API = '/api';

export const appConfig = {
    isAdmin: false,
    csrfToken: '',
    user: null, // { fullName, role }
    logos: { philfida: '', bagong: '', daPhilfida: '', socotec: '' }, // data URLs
};

export async function initConfig() {
    const res = await fetch('/api/bootstrap', { credentials: 'same-origin' });
    if (res.status === 401) {
        window.location.href = 'login.html';
        throw new Error('unauthenticated');
    }
    if (!res.ok) throw new Error('Failed to load app configuration');
    const cfg = await res.json();
    appConfig.isAdmin = !!cfg.isAdmin;
    appConfig.csrfToken = cfg.csrfToken || '';
    appConfig.user = cfg.user || null;
    if (cfg.logos) appConfig.logos = { ...appConfig.logos, ...cfg.logos };
    populateUserHeader();
}

// Fills the session-dependent bits of the static shell (header user chip,
// hero greeting, header logo) that the old PHP rendered inline.
function populateUserHeader() {
    const user = appConfig.user || {};
    const fullName = user.fullName || 'User';
    const firstName = (fullName.split(' ')[0] || 'User');
    const roleLabel = user.role === 'admin' ? 'Admin' : 'User';
    const setText = (id, text) => {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    };
    setText('headerAvatar', (firstName[0] || 'A').toUpperCase());
    setText('headerUserName', fullName);
    setText('headerUserRole', roleLabel);
    const greeting = document.getElementById('heroGreeting');
    if (greeting) greeting.textContent = `Welcome back, ${firstName} 👋`;
    const logo = document.getElementById('headerLogo');
    if (logo && appConfig.logos.philfida) logo.src = appConfig.logos.philfida;
}
