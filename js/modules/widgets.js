const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MS_DAY = 1000 * 60 * 60 * 24;

function pad(n) { return String(n).padStart(2, '0'); }
function fmt(date) { return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}`; }

export function updatePstClock() {
    const el = document.getElementById('pstClockTime');
    if (!el) return;
    el.textContent = new Date().toLocaleTimeString('en-US', {
        timeZone: 'America/Los_Angeles',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    });
}

export function updateSessionDuration(sessionStart) {
    const el = document.getElementById('sessionDuration');
    if (!el) return;
    const elapsed = Math.floor((Date.now() - sessionStart) / 1000);
    const h = Math.floor(elapsed / 3600);
    const m = Math.floor((elapsed % 3600) / 60);
    const s = elapsed % 60;
    el.textContent = h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

export function setSessionUser(user) {
    const el = document.getElementById('sessionUser');
    if (!el) return;
    if (!user) { el.textContent = 'Offline'; return; }
    el.textContent = user.name || user.email?.split('@')[0] || 'User';
}

export function setTodayInput() {
    const now = new Date();
    document.getElementById('workoutDate').value =
        `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function setSyncStatus(state) {
    const dot  = document.getElementById('sync-dot');
    const lbl  = document.getElementById('sync-label');
    const wrap = document.getElementById('sync-status-item');
    if (!dot || !lbl || !wrap) return;
    wrap.style.display = '';
    dot.className = 'sync-dot';
    if (state === 'syncing') {
        dot.classList.add('sync-dot--syncing');
        lbl.textContent = 'Syncing…';
    } else if (state === 'synced') {
        dot.classList.add('sync-dot--synced');
        lbl.textContent = 'Synced';
    } else if (state === 'error') {
        dot.classList.add('sync-dot--error');
        lbl.textContent = 'Sync error';
    } else {
        lbl.textContent = 'Offline';
    }
}

export function updateWeeklySummary(workoutData) {
    const now        = new Date();
    const dayOfWeek  = now.getDay(); // 0=Sun … 6=Sat
    const sun = new Date(now); sun.setDate(now.getDate() - dayOfWeek); sun.setHours(0, 0, 0, 0);
    const sat = new Date(sun); sat.setDate(sun.getDate() + 6); sat.setHours(23, 59, 59, 999);

    const sunISO = `${sun.getFullYear()}-${pad(sun.getMonth()+1)}-${pad(sun.getDate())}`;
    const satISO = `${sat.getFullYear()}-${pad(sat.getMonth()+1)}-${pad(sat.getDate())}`;

    const periodEl = document.getElementById('ws-period');
    if (periodEl) periodEl.textContent = `${fmt(sun)} – ${fmt(sat)}`;

    const weekEntries = workoutData.filter(e => e.date >= sunISO && e.date <= satISO);
    const sessions    = new Set(weekEntries.map(e => e.date)).size;
    const volume      = weekEntries.reduce((s, e) => s + (e.volume || 0), 0);

    const sesEl = document.getElementById('ws-sessions');
    const volEl = document.getElementById('ws-volume');
    if (sesEl) sesEl.textContent = sessions;
    if (volEl) volEl.textContent = volume >= 1000 ? `${(volume / 1000).toFixed(1)}k` : Math.round(volume);

    let cardioMins = 0;
    try {
        const cardioData = JSON.parse(localStorage.getItem('titan_cardio') || '[]');
        cardioMins = cardioData
            .filter(c => c.date >= sunISO && c.date <= satISO)
            .reduce((s, c) => s + (Number(c.duration) || 0), 0);
    } catch { /* keep 0 */ }
    const cardioEl = document.getElementById('ws-cardio');
    if (cardioEl) cardioEl.textContent = Math.round(cardioMins);

    let wdelta = '—';
    let wdeltaColor = 'var(--text)';
    try {
        const bodyData = JSON.parse(localStorage.getItem('titan_body_v1') || 'null');
        if (bodyData?.entries?.length) {
            const sorted   = [...bodyData.entries].sort((a, b) => a.date.localeCompare(b.date));
            const thisWeek = sorted.filter(e => e.date >= sunISO && e.date <= satISO);
            const before   = sorted.filter(e => e.date < sunISO);
            const latest   = thisWeek.length ? thisWeek[thisWeek.length - 1].weight : null;
            const prev     = before.length   ? before[before.length - 1].weight     : null;
            if (latest !== null && prev !== null) {
                const diff = latest - prev;
                wdelta = `${diff > 0 ? '+' : ''}${diff.toFixed(1)}`;
                wdeltaColor = diff > 0 ? 'var(--danger)' : diff < 0 ? 'var(--mint)' : 'var(--text)';
            }
        }
    } catch { /* keep — */ }
    const wdeltaEl = document.getElementById('ws-wdelta');
    if (wdeltaEl) { wdeltaEl.textContent = wdelta; wdeltaEl.style.color = wdeltaColor; }
}

export function updateTimeWidgets() {
    const now = new Date();

    document.getElementById('widgetDayOfWeek').textContent = DAYS[now.getDay()];

    const sunday = new Date(now);
    sunday.setDate(now.getDate() - now.getDay());
    const saturday = new Date(sunday);
    saturday.setDate(sunday.getDate() + 6);
    document.getElementById('widgetWeekDates').textContent = `${fmt(sunday)} — ${fmt(saturday)}`;

    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const dayOfYear = Math.floor((now - startOfYear) / MS_DAY) + 1;
    const y = now.getFullYear();
    const isLeap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
    document.getElementById('widgetDayOfYear').textContent = `${dayOfYear} / ${isLeap ? 366 : 365}`;
}
