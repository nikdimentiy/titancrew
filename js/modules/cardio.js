const SK = 'titan_cardio';

const MONS  = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONFL = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const AC = {
    Treadmill: { hex: '#facc15', bg: 'rgba(250,204,21,0.15)' },
    Elliptical:{ hex: '#22c55e', bg: 'rgba(34,197,94,0.15)'  },
    Swimming:  { hex: '#38bdf8', bg: 'rgba(56,189,248,0.15)'  },
    Walking:   { hex: '#4ade80', bg: 'rgba(74,222,128,0.15)'  },
};

const ICONS = {
    Treadmill:  `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9 18H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-4M9 18l3-3 3 3"/></svg>`,
    Elliptical: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z"/></svg>`,
    Swimming:   `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3 15c.74.89 1.76 1.5 3 1.5s2.26-.61 3-1.5 1.76-1.5 3-1.5 2.26.61 3 1.5 1.76 1.5 3 1.5"/><path stroke-linecap="round" stroke-linejoin="round" d="M3 9.75A9 9 0 0 1 12 3a9 9 0 0 1 9 6.75"/></svg>`,
    Walking:    `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"/></svg>`,
};

let workouts = [];
let calY, calM;
let _cloud = null;

export function setCardioCloud(c)          { _cloud = c; }
export function getCardioWorkouts()        { return workouts; }
export function syncCardioFromCloud(list)  { workouts = list; save(); renderAll(); }

const pad = n => String(n).padStart(2, '0');
const fmt = (n, d = 2) => Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: d });

function getNowLA() {
    return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
}

function toDS(d) {
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}

function getWeekNum(date) {
    const d = new Date(date);
    const dUtc  = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
    const jan1  = Date.UTC(d.getFullYear(), 0, 1);
    const dow   = new Date(jan1).getUTCDay();
    return Math.floor((Math.floor((dUtc - jan1) / 86400000) + dow) / 7) + 1;
}

function save()  { localStorage.setItem(SK, JSON.stringify(workouts)); }
function load()  {
    try { workouts = JSON.parse(localStorage.getItem(SK) || '[]'); } catch { workouts = []; }
}

// ── Tooltip ──────────────────────────────────────────────────────────────────
let tooltipEl;

function showTip(e, ds, dws) {
    const date = new Date(ds + 'T12:00:00');
    const label = date.toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric', year:'numeric' });
    let h = `<div class="tt-date">${label}</div>`;
    if (!dws.length) h += `<div style="opacity:.6;margin-top:3px">No activity</div>`;
    else dws.forEach(w => {
        const c = AC[w.activity];
        h += `<div class="tt-row"><div class="tt-dot" style="background:${c ? c.hex : '#888'}"></div>
              <span>${w.activity} · ${w.duration} min</span>
              ${w.calories ? `<span style="opacity:.65;margin-left:auto">${w.calories} cal</span>` : ''}</div>`;
    });
    tooltipEl.innerHTML = h;
    tooltipEl.classList.add('visible');
    tooltipEl.style.left = Math.min(e.clientX + 12, window.innerWidth - 240) + 'px';
    tooltipEl.style.top  = Math.min(e.clientY + 12, window.innerHeight - 120) + 'px';
}

function hideTip() { tooltipEl.classList.remove('visible'); }

// ── Stats ─────────────────────────────────────────────────────────────────────
function renderStats() {
    const total = workouts.length;
    const dist  = workouts.reduce((s, w) => s + Number(w.distance || 0), 0);
    const time  = workouts.reduce((s, w) => s + Number(w.duration || 0), 0);
    const cal   = workouts.reduce((s, w) => s + Number(w.calories || 0), 0);

    document.getElementById('c-total-workouts').textContent = total;
    document.getElementById('c-total-distance').innerHTML = `${fmt(dist)}<span class="cs-unit">mi</span>`;
    document.getElementById('c-total-time').innerHTML     = `${fmt(time, 0)}<span class="cs-unit">min</span>`;
    document.getElementById('c-total-calories').textContent = fmt(cal, 0);
    document.getElementById('c-avg-calories').textContent   = total ? fmt(cal / total, 0) : '0';
}

// ── Heatmap ───────────────────────────────────────────────────────────────────
function renderHeatmap() {
    const colsEl   = document.getElementById('c-hm-cols');
    const monthsEl = document.getElementById('c-hm-months');
    colsEl.innerHTML = monthsEl.innerHTML = '';

    const today = getNowLA();
    const todayS = toDS(today);
    const WEEKS  = 16;

    const map = {};
    workouts.forEach(w => { if (!map[w.date]) map[w.date] = []; map[w.date].push(w); });

    const start = new Date(today);
    start.setDate(start.getDate() - (WEEKS * 7 - 1));
    start.setDate(start.getDate() - start.getDay());

    const COLS = WEEKS + 1;
    colsEl.style.gridTemplateColumns   = `repeat(${COLS},minmax(0,1fr))`;
    monthsEl.style.gridTemplateColumns = `repeat(${COLS},minmax(0,1fr))`;

    for (let col = 0; col < COLS; col++) {
        const ld = new Date(start);
        ld.setDate(start.getDate() + col * 7);

        const ml = document.createElement('div');
        ml.className   = 'hm-month-slot';
        ml.textContent = (col === 0 || ld.getDate() <= 7) ? MONS[ld.getMonth()] : '';
        ml.style.cssText = 'font-size:0.6rem;color:var(--muted);font-family:var(--ff-h);';
        monthsEl.appendChild(ml);

        const colDiv = document.createElement('div');
        colDiv.className = 'hm-col';

        for (let row = 0; row < 7; row++) {
            const cd = new Date(start);
            cd.setDate(start.getDate() + col * 7 + row);
            const ds = toDS(cd);

            const cell = document.createElement('div');
            cell.className = 'hm-cell';
            if (ds > todayS) cell.classList.add('future');

            const dws = map[ds];
            if (dws && dws.length && ds <= todayS) {
                const acts = [...new Set(dws.map(w => w.activity))];
                cell.dataset.act = acts.length === 1 ? acts[0] : 'Mixed';
            }

            cell.addEventListener('mousemove', e => showTip(e, ds, map[ds] || []));
            cell.addEventListener('mouseleave', hideTip);
            colDiv.appendChild(cell);
        }
        colsEl.appendChild(colDiv);
    }
}

// ── Monthly ───────────────────────────────────────────────────────────────────
function renderMonthly() {
    const grid = document.getElementById('c-monthly-grid');
    grid.innerHTML = '';
    document.getElementById('c-cal-month-lbl').textContent = `${MONFL[calM].slice(0,3)} ${calY}`;

    const map = {};
    workouts.forEach(w => { if (!map[w.date]) map[w.date] = []; map[w.date].push(w); });
    const today = toDS(getNowLA());

    grid.appendChild(Object.assign(document.createElement('div'), { className: 'mg-hdr' }));
    ['S','M','T','W','T','F','S'].forEach(d => {
        const h = document.createElement('div');
        h.className = 'mg-hdr'; h.textContent = d;
        grid.appendChild(h);
    });

    const firstDOW  = new Date(calY, calM, 1).getDay();
    const daysInMon = new Date(calY, calM + 1, 0).getDate();
    const weeks     = Math.ceil((firstDOW + daysInMon) / 7);

    for (let week = 0; week < weeks; week++) {
        const rowSun = new Date(calY, calM, 1 - firstDOW + week * 7);
        const wl = document.createElement('div');
        wl.className = 'mg-wlbl'; wl.textContent = `W${getWeekNum(rowSun)}`;
        grid.appendChild(wl);

        for (let dow = 0; dow < 7; dow++) {
            const dayNum = week * 7 + dow - firstDOW + 1;
            const cell   = document.createElement('div');

            if (dayNum < 1 || dayNum > daysInMon) {
                cell.className = 'mg-day empty';
            } else {
                cell.className = 'mg-day';
                cell.textContent = dayNum;
                const ds  = `${calY}-${pad(calM+1)}-${pad(dayNum)}`;
                if (ds === today) cell.classList.add('today');
                const dws = map[ds];
                if (dws && dws.length) {
                    const acts = [...new Set(dws.map(w => w.activity))];
                    cell.dataset.act = acts.length === 1 ? acts[0] : 'Mixed';
                }
                cell.addEventListener('mousemove', e => showTip(e, ds, map[ds] || []));
                cell.addEventListener('mouseleave', hideTip);
            }
            grid.appendChild(cell);
        }
    }
}

// ── Distribution ──────────────────────────────────────────────────────────────
function renderDist() {
    const el = document.getElementById('c-dist-row');
    if (!workouts.length) {
        el.innerHTML = `<span style="color:var(--muted);font-size:0.72rem;font-family:var(--ff-h);letter-spacing:0.08em;">No sessions yet</span>`;
        return;
    }

    const counts = {};
    const totalMins = {};
    workouts.forEach(w => {
        counts[w.activity] = (counts[w.activity] || 0) + 1;
        totalMins[w.activity] = (totalMins[w.activity] || 0) + Number(w.duration || 0);
    });

    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    const max   = Math.max(...Object.values(counts));

    el.innerHTML = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .map(([act, cnt]) => {
            const c      = AC[act] || { hex: '#888' };
            const barPct = Math.round(cnt / max * 100);
            const pct    = Math.round(cnt / total * 100);
            const mins   = totalMins[act] || 0;
            const timeStr = mins >= 60
                ? `${Math.floor(mins / 60)}h ${mins % 60 ? (mins % 60) + 'm' : ''}`.trim()
                : `${mins}m`;
            return `<div class="hm-dist-item">
              <span class="hm-dist-dot" style="background:${c.hex}"></span>
              <span class="hm-dist-name">${act}</span>
              <span class="hm-dist-count">${cnt}× · ${timeStr}</span>
              <div class="hm-dist-bar-bg"><div class="hm-dist-bar-fill" style="width:${barPct}%;background:${c.hex}"></div></div>
              <span class="hm-dist-pct">${pct}%</span>
            </div>`;
        }).join('');
}

// ── Table ─────────────────────────────────────────────────────────────────────
function renderTable() {
    const tb = document.getElementById('c-table-body');
    if (!workouts.length) {
        tb.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--muted);font-family:var(--ff-h);font-size:0.82rem;letter-spacing:0.08em;">NO SESSIONS YET — START TRACKING</td></tr>`;
        return;
    }
    tb.innerHTML = [...workouts].sort((a, b) => b.date.localeCompare(a.date)).map(w => {
        const c   = AC[w.activity] || { hex: '#888', bg: 'rgba(128,128,128,.1)' };
        const ic  = ICONS[w.activity] || '';
        const d   = new Date(w.date + 'T12:00:00');
        const disp = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        return `<tr>
          <td>${disp}</td>
          <td style="color:var(--muted)">W${getWeekNum(d)}</td>
          <td><span style="display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:99px;font-size:0.75rem;font-weight:700;background:${c.bg};color:${c.hex}">${ic}${w.activity}</span></td>
          <td>${fmt(w.duration, 0)} min</td>
          <td>${w.distance ? fmt(w.distance) + ' mi' : '—'}</td>
          <td>${w.calories ? fmt(w.calories, 0) + ' cal' : '—'}</td>
          <td style="text-align:right"><button class="btn-delete" data-id="${w.id}">✕</button></td>
        </tr>`;
    }).join('');

    tb.querySelectorAll('[data-id]').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = Number(btn.dataset.id);
            workouts = workouts.filter(w => w.id !== id);
            save(); renderAll();
            if (_cloud) _cloud.removeCardioSession(id).catch(() => {});
        });
    });
}

function renderAll() {
    renderStats();
    renderHeatmap();
    renderMonthly();
    renderDist();
    renderTable();
}

// ── Init ──────────────────────────────────────────────────────────────────────
let _panelOpen = null;
export function openCardioPanel() { if (_panelOpen) _panelOpen(); }

export function initCardio() {
    tooltipEl = document.getElementById('c-hm-tooltip');

    load();

    const la  = getNowLA();
    calY = la.getFullYear();
    calM = la.getMonth();

    // Default date
    document.getElementById('c-date').value = toDS(la);

    // Panel
    const overlay   = document.getElementById('c-panel-overlay');
    const panel     = document.getElementById('c-panel');
    const openBtn   = document.getElementById('c-open-panel');
    const closeBtn  = document.getElementById('c-panel-close');

    function openPanel()  { panel.classList.add('open'); overlay.classList.add('open'); }
    function closePanel() { panel.classList.remove('open'); overlay.classList.remove('open'); }

    _panelOpen = openPanel;

    openBtn.addEventListener('click', openPanel);
    closeBtn.addEventListener('click', closePanel);
    overlay.addEventListener('click', closePanel);

    // Save
    document.getElementById('c-save-btn').addEventListener('click', () => {
        const date     = document.getElementById('c-date').value;
        const activity = document.getElementById('c-activity').value;
        const duration = parseFloat(document.getElementById('c-duration').value);
        const distance = parseFloat(document.getElementById('c-distance').value);
        const calories = parseFloat(document.getElementById('c-calories').value);

        if (!date) return;
        if (!duration || duration <= 0) return;

        const entry = { id: Date.now(), date, activity, duration, distance: distance || 0, calories: calories || 0 };
        workouts.push(entry);
        save(); renderAll(); closePanel();
        if (_cloud) _cloud.addCardioSession(entry).catch(() => {});
        document.getElementById('c-duration').value  = '';
        document.getElementById('c-distance').value  = '';
        document.getElementById('c-calories').value  = '';
        document.getElementById('c-date').value      = toDS(getNowLA());
    });

    // Reset form
    document.getElementById('c-reset-btn').addEventListener('click', () => {
        document.getElementById('c-duration').value = '';
        document.getElementById('c-distance').value = '';
        document.getElementById('c-calories').value = '';
        document.getElementById('c-date').value     = toDS(getNowLA());
    });

    // Calendar nav
    document.getElementById('c-cal-prev').addEventListener('click', () => {
        calM--; if (calM < 0) { calM = 11; calY--; } renderMonthly();
    });
    document.getElementById('c-cal-next').addEventListener('click', () => {
        calM++; if (calM > 11) { calM = 0; calY++; } renderMonthly();
    });

    // Export
    document.getElementById('c-export').addEventListener('click', () => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([JSON.stringify(workouts, null, 2)], { type: 'application/json' }));
        a.download = 'titan-cardio.json'; a.click();
    });

    // Import
    document.getElementById('c-import-input').addEventListener('change', e => {
        const f = e.target.files[0]; if (!f) return;
        const r = new FileReader();
        r.onload = ev => {
            try {
                const d = JSON.parse(ev.target.result);
                if (!Array.isArray(d)) throw 0;
                workouts = d; save(); renderAll();
                if (_cloud) {
                    _cloud.wipeAllCardioSessions()
                        .then(() => Promise.all(workouts.map(w => _cloud.addCardioSession(w).catch(() => {}))))
                        .catch(() => {});
                }
            } catch { /* invalid */ }
        };
        r.readAsText(f);
        e.target.value = '';
    });

    // Clear
    document.getElementById('c-clear-btn').addEventListener('click', () => {
        if (!confirm('Delete all cardio data?')) return;
        workouts = []; save(); renderAll();
        if (_cloud) _cloud.wipeAllCardioSessions().catch(() => {});
    });

    renderAll();
}
