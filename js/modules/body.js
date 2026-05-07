const SK       = 'titan_body_v1';
const FAST_GOAL = 100;
const B_UNIT_KEY = 'titan_unit';
const MK = 'titan_meas_v1';

function getUnit()  { return localStorage.getItem(B_UNIT_KEY) || 'lbs'; }
function toDisp(v)  { return getUnit() === 'kg' ? v / 2.20462 : v; }

let appData = {
    startWeight:     188.7,
    goalWeight:      173.0,
    height:          70,
    missionStartDate: '2026-05-03',
    entries:         [],
};

let bodyChart    = null;
let bfChart      = null;
let calendarDate = new Date();
let currentRange = 'all';
let mData        = [];
let _measCloud   = null;

const pad2 = n => String(n).padStart(2, '0');

function getLocalISO(date) {
    return `${date.getFullYear()}-${pad2(date.getMonth()+1)}-${pad2(date.getDate())}`;
}

function formatUSDate(iso) {
    const [y, m, d] = iso.split('-');
    return `${m}/${d}/${y.substring(2)}`;
}

function saveData() {
    appData.entries.sort((a, b) => new Date(b.date) - new Date(a.date));
    localStorage.setItem(SK, JSON.stringify(appData));
    renderAll();
}

function el(id) { return document.getElementById(id); }

// ── Render all ────────────────────────────────────────────────────────────────
function renderAll() {
    const current = appData.entries.length > 0 ? appData.entries[0].weight : appData.startWeight;
    const unit    = getUnit();

    el('b-current-weight').textContent = toDisp(current).toFixed(1);
    el('b-start-weight').textContent   = toDisp(appData.startWeight).toFixed(1);
    el('b-goal-weight').textContent    = toDisp(appData.goalWeight).toFixed(1);
    el('b-logs-count').textContent     = appData.entries.length;

    const unitLbl = el('b-unit-label');
    if (unitLbl) unitLbl.textContent = unit === 'kg' ? 'kilograms' : 'pounds';
    const toGoalLbl = el('b-to-goal-label');
    if (toGoalLbl) toGoalLbl.textContent = unit.toUpperCase() + ' TO GOAL';

    const lost   = appData.startWeight - current;
    const lostEl = el('b-total-lost');
    if (lost > 0)      { lostEl.textContent = toDisp(lost).toFixed(1); lostEl.className = 'vital-block-val green'; }
    else if (lost < 0) { lostEl.textContent = toDisp(Math.abs(lost)).toFixed(1); lostEl.className = 'vital-block-val red'; }
    else               { lostEl.textContent = '0.0'; lostEl.className = 'vital-block-val'; }

    // Progress
    const totalDiff  = Math.abs(appData.startWeight - appData.goalWeight);
    const isLossGoal = appData.startWeight > appData.goalWeight;
    let percent = 0;
    if (totalDiff > 0) {
        if (isLossGoal) percent = Math.min(100, Math.max(0, ((appData.startWeight - current) / totalDiff) * 100));
        else            percent = Math.min(100, Math.max(0, ((current - appData.startWeight) / totalDiff) * 100));
    }

    const circ   = 2 * Math.PI * 66;
    const offset = circ - (percent / 100) * circ;
    el('b-ring-fill').style.strokeDashoffset = offset;
    el('b-linear-progress').style.width      = `${percent}%`;
    el('b-percent-text').textContent          = `${Math.round(percent)}%`;
    el('b-weight-remaining').textContent = toDisp(Math.abs(current - appData.goalWeight)).toFixed(1);

    const msdEl = el('b-mission-start-date');
    if (msdEl) msdEl.textContent = appData.missionStartDate ? formatUSDate(appData.missionStartDate) : '--';

    calcBMI(current);
    calcStreak();
    calcFasting();
    calcPrediction();
    renderHistory();
    renderBodyChart(currentRange);
    renderBodyCalendar();
}

// ── BMI ───────────────────────────────────────────────────────────────────────
function calcBMI(weight) {
    const h  = appData.height || 70;
    let bmi;
    if (getUnit() === 'kg') {
        const weightKg = weight / 2.20462;
        const heightM  = h * 0.0254;
        bmi = weightKg / (heightM * heightM);
    } else {
        bmi = (weight / (h * h)) * 703;
    }
    el('b-bmi').textContent = bmi.toFixed(1);
    const badge = el('b-bmi-badge');
    let status = 'NORMAL', bg = 'rgba(52,211,153,0.15)', color = 'var(--mint)';
    if      (bmi < 18.5)             { status = 'UNDER'; bg = 'rgba(56,189,248,0.15)'; color = 'var(--sky)'; }
    else if (bmi >= 25 && bmi < 30)  { status = 'OVER';  bg = 'rgba(212,175,55,0.15)'; color = '#d4af37'; }
    else if (bmi >= 30)              { status = 'OBESE'; bg = 'rgba(248,113,113,0.15)'; color = 'var(--danger)'; }
    badge.textContent = status; badge.style.background = bg; badge.style.color = color;
}

// ── Streak ────────────────────────────────────────────────────────────────────
function calcStreak() {
    let streak = 0;
    const dates = appData.entries.map(e => e.date);
    const today = new Date(); today.setHours(0,0,0,0);
    let check = new Date(today);
    let ds = getLocalISO(check);
    if (!dates.includes(ds)) {
        check.setDate(check.getDate() - 1); ds = getLocalISO(check);
        if (!dates.includes(ds)) { el('b-streak').textContent = '0D'; return; }
    }
    while (dates.includes(ds)) { streak++; check.setDate(check.getDate() - 1); ds = getLocalISO(check); }
    el('b-streak').textContent = `${streak}D`;
}

// ── Fasting ───────────────────────────────────────────────────────────────────
function calcFasting() {
    const fasts = appData.entries.filter(e => e.isFasting);
    const count = fasts.length;
    el('b-fasting-counter').textContent = count;
    el('b-fast-fraction').textContent   = `${count} / ${FAST_GOAL}`;
    el('b-fast-fill').style.width       = `${Math.min(100, (count / FAST_GOAL) * 100)}%`;
    el('b-streak-fasts').textContent    = `${count}/${FAST_GOAL}`;

    if (count < 2) { el('b-avg-fast-gap').textContent = '--'; el('b-streak-avg-gap').textContent = '--'; return; }
    const sorted = [...fasts].sort((a, b) => new Date(a.date) - new Date(b.date));
    let total = 0;
    for (let i = 1; i < sorted.length; i++) {
        total += Math.ceil(Math.abs(new Date(sorted[i].date) - new Date(sorted[i-1].date)) / 86400000);
    }
    const avg = (total / (sorted.length - 1)).toFixed(1);
    el('b-avg-fast-gap').textContent    = avg;
    el('b-streak-avg-gap').textContent  = `${avg}D`;
}

// ── Prediction ───────────────────────────────────────────────────────────────
function calcPrediction() {
    const dateEl = el('b-pred-date');
    const daysEl = el('b-pred-days');
    const rateEl = el('b-pred-rate');
    const confEl = el('b-pred-conf');
    const badge  = el('b-pred-badge');
    const rateLbl = el('b-pred-rate-lbl');
    if (!dateEl) return;

    const unit = getUnit();
    if (rateLbl) rateLbl.textContent = `${unit.toUpperCase()} / WEEK`;

    const sorted = [...appData.entries].sort((a, b) => new Date(a.date) - new Date(b.date));

    if (sorted.length < 2) {
        dateEl.textContent = 'Log more entries';
        daysEl.textContent = '--';
        rateEl.textContent = '--';
        confEl.textContent = '--';
        if (badge) { badge.textContent = 'NEED DATA'; badge.className = 'pred-badge pred-badge--gold'; }
        renderPredTimeline(0, null);
        return;
    }

    const origin = new Date(sorted[0].date);

    // Linear regression: days-since-first-entry vs weight (lbs stored internally)
    const n   = sorted.length;
    const xs  = sorted.map(e => (new Date(e.date) - origin) / 86400000);
    const ys  = sorted.map(e => e.weight);
    const sumX  = xs.reduce((a, b) => a + b, 0);
    const sumY  = ys.reduce((a, b) => a + b, 0);
    const sumXY = xs.reduce((acc, x, i) => acc + x * ys[i], 0);
    const sumXX = xs.reduce((acc, x) => acc + x * x, 0);
    const denom = n * sumXX - sumX * sumX;

    if (denom === 0) {
        dateEl.textContent = 'No change detected';
        daysEl.textContent = '--'; rateEl.textContent = '0.0'; confEl.textContent = '--';
        if (badge) { badge.textContent = 'STALLED'; badge.className = 'pred-badge pred-badge--red'; }
        renderPredTimeline(0, null);
        return;
    }

    const slope     = (n * sumXY - sumX * sumY) / denom;   // lbs per day
    const intercept = (sumY - slope * sumX) / n;

    const today     = new Date();
    today.setHours(0, 0, 0, 0);
    const todayDays = (today - origin) / 86400000;
    const currentPred = slope * todayDays + intercept;

    const goal        = appData.goalWeight;
    const isLossGoal  = appData.startWeight > goal;

    // Check if already at or past goal
    const currentActual = sorted.length > 0 ? sorted[sorted.length - 1].weight : appData.startWeight;
    const alreadyDone   = isLossGoal ? currentActual <= goal : currentActual >= goal;
    if (alreadyDone) {
        dateEl.textContent = 'ACHIEVED!';
        daysEl.textContent = '0';
        rateEl.textContent = toDisp(slope * 7).toFixed(1);
        confEl.textContent = '100%';
        if (badge) { badge.textContent = 'ACHIEVED'; badge.className = 'pred-badge pred-badge--green'; }
        renderPredTimeline(100, null);
        return;
    }

    // Check if moving in wrong direction
    const wrongDir = (isLossGoal && slope >= 0) || (!isLossGoal && slope <= 0);
    if (wrongDir) {
        dateEl.textContent = 'Off track';
        daysEl.textContent = '--'; rateEl.textContent = toDisp(slope * 7).toFixed(1); confEl.textContent = '--';
        if (badge) { badge.textContent = 'OFF TRACK'; badge.className = 'pred-badge pred-badge--red'; }
        renderPredTimeline(0, null);
        return;
    }

    // Days until goal from today (solve slope * x + intercept = goal for x, x in absolute days since origin)
    const daysToGoalAbs = (goal - intercept) / slope;
    const daysLeft      = Math.max(0, Math.round(daysToGoalAbs - todayDays));

    const goalDate = new Date(today);
    goalDate.setDate(goalDate.getDate() + daysLeft);

    // R² confidence
    const yMean  = sumY / n;
    const ssTot  = ys.reduce((acc, y) => acc + (y - yMean) ** 2, 0);
    const ssRes  = ys.reduce((acc, y, i) => acc + (y - (slope * xs[i] + intercept)) ** 2, 0);
    const r2     = ssTot > 0 ? Math.max(0, 1 - ssRes / ssTot) : 0;

    // Weekly rate in display unit
    const weeklyLbs  = slope * 7;
    const weeklyDisp = toDisp(weeklyLbs);

    const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    dateEl.textContent = `${MONTHS[goalDate.getMonth()]} ${goalDate.getDate()}, ${goalDate.getFullYear()}`;
    daysEl.textContent = daysLeft;
    rateEl.textContent = `${weeklyDisp >= 0 ? '+' : ''}${weeklyDisp.toFixed(1)}`;
    confEl.textContent = `${Math.round(r2 * 100)}%`;

    const rateColor = (isLossGoal && weeklyDisp < 0) || (!isLossGoal && weeklyDisp > 0) ? 'green' : 'red';
    rateEl.className = `pred-stat-val ${rateColor}`;

    // Badge: compare recent 7-entry rate vs overall slope
    if (badge) {
        const recentN    = Math.min(7, sorted.length);
        const recent     = sorted.slice(-recentN);
        const recentDays = (new Date(recent[recent.length - 1].date) - new Date(recent[0].date)) / 86400000 || 1;
        const recentRate = (recent[recent.length - 1].weight - recent[0].weight) / recentDays * 7;
        const goingRight = (isLossGoal && recentRate <= 0) || (!isLossGoal && recentRate >= 0);
        if (!goingRight) {
            badge.textContent = 'OFF TRACK'; badge.className = 'pred-badge pred-badge--red';
        } else if (Math.abs(recentRate) >= Math.abs(weeklyLbs) * 0.75) {
            badge.textContent = 'ON TRACK'; badge.className = 'pred-badge pred-badge--green';
        } else {
            badge.textContent = 'SLOWING'; badge.className = 'pred-badge pred-badge--gold';
        }
    }

    // Progress pct for timeline
    const totalDiff = Math.abs(appData.startWeight - goal);
    const pct = totalDiff > 0
        ? Math.min(100, Math.max(0, Math.abs(appData.startWeight - currentActual) / totalDiff * 100))
        : 0;
    renderPredTimeline(pct, currentActual);
}

function renderPredTimeline(pct, currentActual) {
    const wrap = el('b-pred-timeline');
    if (!wrap) return;

    const start   = appData.startWeight;
    const goal    = appData.goalWeight;
    const current = currentActual !== null ? currentActual
                  : (appData.entries.length > 0 ? appData.entries[0].weight : start);
    const p = Math.round(pct);

    wrap.innerHTML = `
        <div class="pred-timeline-bar">
            <div class="pred-timeline-fill" style="width:${p}%"></div>
            <div class="pred-timeline-dot" style="left:${p}%"></div>
        </div>
        <div class="pred-tl-labels">
            <div class="pred-tl-lbl" style="left:0;transform:translateX(0);">
                <div class="pred-tl-val">${toDisp(start).toFixed(1)}</div>
                <div class="pred-tl-sub">START</div>
            </div>
            <div class="pred-tl-lbl" style="left:${p}%;transform:translateX(-50%);">
                <div class="pred-tl-val gold">${toDisp(current).toFixed(1)}</div>
                <div class="pred-tl-sub">NOW</div>
            </div>
            <div class="pred-tl-lbl" style="right:0;transform:translateX(0);">
                <div class="pred-tl-val green">${toDisp(goal).toFixed(1)}</div>
                <div class="pred-tl-sub">GOAL</div>
            </div>
        </div>`;
}

// ── History ───────────────────────────────────────────────────────────────────
function renderHistory() {
    const tbody = el('b-history-body');
    tbody.innerHTML = '';
    appData.entries.forEach((entry, idx) => {
        const prev      = appData.entries[idx + 1] ? appData.entries[idx + 1].weight : appData.startWeight;
        const change    = toDisp(entry.weight) - toDisp(prev);
        const changeStr = change > 0 ? `+${change.toFixed(1)}` : change.toFixed(1);
        const cc        = change > 0 ? 'var(--danger)' : (change < 0 ? 'var(--mint)' : 'var(--muted)');
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-family:var(--ff-h);font-size:0.82rem;letter-spacing:0.05em;">${formatUSDate(entry.date)}</td>
            <td style="font-weight:700;color:#d4af37;font-family:var(--ff-h);font-size:1rem;">${toDisp(entry.weight).toFixed(1)}</td>
            <td style="text-align:center">${entry.isFasting ? '<span style="color:#d4af37;font-size:1rem;">⚡</span>' : '<span style="color:var(--dimmed)">○</span>'}</td>
            <td style="color:${cc};font-family:var(--ff-h);font-size:1rem;">${changeStr}</td>
            <td style="color:var(--muted);font-size:0.82rem;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${entry.note || '—'}</td>
            <td style="text-align:right"><button class="btn-delete" data-date="${entry.date}">✕</button></td>`;
        tbody.appendChild(tr);
    });

    tbody.querySelectorAll('[data-date]').forEach(btn => {
        btn.addEventListener('click', () => {
            if (!confirm('Delete this entry?')) return;
            appData.entries = appData.entries.filter(e => e.date !== btn.dataset.date);
            saveData();
        });
    });
}

// ── Chart ─────────────────────────────────────────────────────────────────────
function renderBodyChart(range) {
    const ctx = el('b-main-chart').getContext('2d');
    if (bodyChart) { bodyChart.destroy(); bodyChart = null; }

    let data = [...appData.entries].sort((a, b) => new Date(a.date) - new Date(b.date));
    if (range !== 'all') {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - parseInt(range));
        data = data.filter(d => new Date(d.date) >= cutoff);
    }

    const labels = data.map(d => { const [,m,day] = d.date.split('-'); return `${m}/${day}`; });
    const pts    = data.map(d => d.weight);

    const grad = ctx.createLinearGradient(0, 0, 0, 280);
    grad.addColorStop(0, 'rgba(212,175,55,0.35)');
    grad.addColorStop(1, 'rgba(212,175,55,0.0)');

    bodyChart = new Chart(ctx, {
        type: 'line',
        data: { labels, datasets: [{ label: `Mass (${getUnit()})`, data: pts, borderColor: '#d4af37', backgroundColor: grad, borderWidth: 2.5, pointBackgroundColor: '#0d0b1a', pointBorderColor: '#d4af37', pointBorderWidth: 2, pointRadius: 4, pointHoverRadius: 7, fill: true, tension: 0.4 }] },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { backgroundColor: 'var(--bg-card)', titleColor: 'var(--muted)', bodyColor: '#d4af37', borderColor: 'var(--bdr)', borderWidth: 1, padding: 10, displayColors: false,
                    titleFont: { family: 'Roboto', size: 11, weight: '600' },
                    bodyFont:  { family: 'Oswald',  size: 15, weight: '700' } }
            },
            scales: {
                y: { grid: { color: 'rgba(167,139,250,0.06)' }, ticks: { color: 'var(--muted)', font: { family: 'Roboto', size: 11 } }, border: { color: 'var(--bdr)' } },
                x: { grid: { display: false }, ticks: { color: 'var(--muted)', font: { family: 'Roboto', size: 11 } }, border: { color: 'var(--bdr)' } }
            }
        }
    });
}

// ── Calendar ──────────────────────────────────────────────────────────────────
function renderBodyCalendar() {
    const grid  = el('b-cal-grid');
    const year  = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

    grid.innerHTML = '';
    el('b-cal-month-lbl').textContent = `${MONTHS[month]} ${year}`;

    const firstDOW   = new Date(year, month, 1).getDay();
    const daysInMon  = new Date(year, month + 1, 0).getDate();
    const today      = new Date();

    for (let i = 0; i < firstDOW; i++) {
        const b = document.createElement('div'); b.className = 'body-cal-day empty'; grid.appendChild(b);
    }

    for (let day = 1; day <= daysInMon; day++) {
        const cell  = document.createElement('div');
        cell.className   = 'body-cal-day';
        cell.textContent = day;

        const checkDate = `${year}-${pad2(month+1)}-${pad2(day)}`;
        const prevObj   = new Date(year, month, day - 1);
        const prevDate  = getLocalISO(prevObj);
        const entry     = appData.entries.find(e => e.date === checkDate);
        const prevEntry = appData.entries.find(e => e.date === prevDate);

        if (day === today.getDate() && month === today.getMonth() && year === today.getFullYear()) {
            cell.classList.add('today');
        }

        if (entry) {
            if (prevEntry) {
                const diff = entry.weight - prevEntry.weight;
                if (diff < 0)        cell.classList.add('trend-loss');
                else if (diff < 0.5) cell.classList.add('trend-sm');
                else                 cell.classList.add('trend-lg');
            } else { cell.classList.add('trend-neu'); }
            if (entry.isFasting) cell.classList.add('is-fasting');
            cell.title = `${toDisp(entry.weight).toFixed(1)} ${getUnit()}${entry.isFasting ? ' — Titan Fast' : ''}`;
        }
        grid.appendChild(cell);
    }
}

// ── Measurements ─────────────────────────────────────────────────────────────
function loadMeas() {
    try { mData = JSON.parse(localStorage.getItem(MK) || '[]'); } catch { mData = []; }
}

function saveMeas() {
    mData.sort((a, b) => new Date(b.date) - new Date(a.date));
    localStorage.setItem(MK, JSON.stringify(mData));
    renderMeas();
}

function renderMeas() {
    renderMeasStats();
    renderMeasHistory();
    renderBFChart();
}

function renderMeasStats() {
    const grid = el('m-stats-grid');
    if (!grid) return;
    const latest = mData[0] || null;
    const prev   = mData[1] || null;

    const FIELDS = [
        { key: 'bodyfat', label: 'Body Fat', unit: '%'  },
        { key: 'chest',   label: 'Chest',    unit: 'cm' },
        { key: 'waist',   label: 'Waist',    unit: 'cm' },
        { key: 'biceps',  label: 'Biceps',   unit: 'cm' },
        { key: 'thighs',  label: 'Thighs',   unit: 'cm' },
    ];

    grid.innerHTML = FIELDS.map(f => {
        const val    = latest?.[f.key] ?? null;
        const pval   = prev?.[f.key]   ?? null;
        const hasVal = val !== null && val !== '';

        let trendHtml = '';
        if (hasVal && pval !== null && pval !== '') {
            const diff = parseFloat(val) - parseFloat(pval);
            if (Math.abs(diff) >= 0.1) {
                const cls = diff > 0 ? 'up' : 'down';
                const arr = diff > 0 ? '▲' : '▼';
                trendHtml = `<div class="msc-trend ${cls}">${arr} ${Math.abs(diff).toFixed(1)}</div>`;
            }
        }

        return `<div class="meas-stat-card">
            <div class="msc-label">${f.label}</div>
            <div class="msc-val${hasVal ? '' : ' empty'}">${hasVal ? parseFloat(val).toFixed(1) : '—'}</div>
            <div class="msc-unit">${f.unit}</div>
            ${trendHtml}
        </div>`;
    }).join('');
}

function renderMeasHistory() {
    const list = el('m-history-list');
    if (!list) return;

    if (!mData.length) {
        list.innerHTML = '<div class="meas-empty-state">No measurements yet.<br>Log your first entry.</div>';
        return;
    }

    const header = `<div class="meas-history-row header">
        <div>Date</div>
        <div style="text-align:center">BF%</div>
        <div style="text-align:center">Chest</div>
        <div style="text-align:center">Waist</div>
        <div style="text-align:center">Biceps</div>
        <div style="text-align:center">Thighs</div>
        <div></div>
    </div>`;

    const rows = mData.map(m => {
        const fmt = v => (v !== null && v !== '' && v !== undefined) ? parseFloat(v).toFixed(1) : '—';
        return `<div class="meas-history-row">
            <div class="mhr-date">${formatUSDate(m.date)}</div>
            <div class="mhr-val">${fmt(m.bodyfat)}</div>
            <div class="mhr-val">${fmt(m.chest)}</div>
            <div class="mhr-val">${fmt(m.waist)}</div>
            <div class="mhr-val">${fmt(m.biceps)}</div>
            <div class="mhr-val">${fmt(m.thighs)}</div>
            <div><button class="mhr-delete" data-mid="${m.id}">✕</button></div>
        </div>`;
    }).join('');

    list.innerHTML = header + rows;

    list.querySelectorAll('[data-mid]').forEach(btn => {
        btn.addEventListener('click', () => {
            if (!confirm('Delete this measurement?')) return;
            const mid = parseInt(btn.dataset.mid);
            mData = mData.filter(m => m.id !== mid);
            saveMeas();
            if (_measCloud) _measCloud.removeMeasurement(mid).catch(() => {});
        });
    });
}

function renderBFChart() {
    const canvas = el('m-bf-chart');
    if (!canvas) return;
    if (bfChart) { bfChart.destroy(); bfChart = null; }

    const pts = [...mData]
        .filter(m => m.bodyfat !== null && m.bodyfat !== '' && m.bodyfat !== undefined)
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .slice(-20);

    if (pts.length < 2) return;

    const labels = pts.map(p => { const [,mm,dd] = p.date.split('-'); return `${mm}/${dd}`; });
    const data   = pts.map(p => parseFloat(p.bodyfat));

    const ctx  = canvas.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, 148);
    grad.addColorStop(0, 'rgba(167,139,250,0.4)');
    grad.addColorStop(1, 'rgba(167,139,250,0.0)');

    bfChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Body Fat %',
                data,
                borderColor: '#a78bfa',
                backgroundColor: grad,
                borderWidth: 2,
                pointBackgroundColor: '#0d0b1a',
                pointBorderColor: '#a78bfa',
                pointBorderWidth: 2,
                pointRadius: 3,
                pointHoverRadius: 6,
                fill: true,
                tension: 0.4,
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#16132a',
                    titleColor: '#8883a8',
                    bodyColor: '#a78bfa',
                    borderColor: 'rgba(167,139,250,0.1)',
                    borderWidth: 1,
                    padding: 8,
                    displayColors: false,
                },
            },
            scales: {
                y: { grid: { color: 'rgba(167,139,250,0.06)' }, ticks: { color: '#8883a8', font: { family: 'Roboto', size: 10 } }, border: { color: 'rgba(167,139,250,0.1)' } },
                x: { grid: { display: false }, ticks: { color: '#8883a8', font: { family: 'Roboto', size: 10 } }, border: { color: 'rgba(167,139,250,0.1)' } },
            },
        },
    });
}

// ── Modals ────────────────────────────────────────────────────────────────────
function openBodyModal(id)  { el(id).classList.add('open'); }
function closeBodyModal(id) { el(id).classList.remove('open'); }

// ── Init ──────────────────────────────────────────────────────────────────────
export function refreshBody()             { renderAll(); }
export function setMeasCloud(c)          { _measCloud = c; }
export function getMeasData()            { return mData; }
export function syncMeasFromCloud(list)  { mData = list; localStorage.setItem(MK, JSON.stringify(mData)); renderMeas(); }

export function initBody() {
    const stored = localStorage.getItem(SK);
    if (stored) {
        try {
            const p = JSON.parse(stored);
            if (p.entries) {
                appData = p;
                if (!appData.height) appData.height = 70;
                if (!appData.missionStartDate) {
                    const first = [...p.entries].sort((a, b) => new Date(a.date) - new Date(b.date))[0];
                    appData.missionStartDate = first ? first.date : getLocalISO(new Date());
                }
            }
        } catch { /* ignore */ }
    } else {
        appData.entries = [{ date: '2026-05-03', weight: appData.startWeight, isFasting: false, note: 'Mission Start' }];
        saveData();
    }

    // Log entry
    el('b-open-log').addEventListener('click', () => openBodyModal('b-add-modal'));
    el('b-add-modal').querySelector('[data-close]').addEventListener('click', () => closeBodyModal('b-add-modal'));
    el('b-add-modal').querySelector('[data-backdrop]').addEventListener('click', () => closeBodyModal('b-add-modal'));

    el('b-save-entry').addEventListener('click', () => {
        const w = parseFloat(el('b-input-weight').value);
        const n = el('b-input-note').value;
        const f = el('b-input-fasting').checked;
        if (!w) return;
        const dateStr = getLocalISO(new Date());
        appData.entries = appData.entries.filter(e => e.date !== dateStr);
        appData.entries.push({ date: dateStr, weight: w, isFasting: f, note: n });
        saveData(); closeBodyModal('b-add-modal');
        el('b-input-weight').value = ''; el('b-input-note').value = ''; el('b-input-fasting').checked = false;
    });

    // Settings
    el('b-open-settings').addEventListener('click', () => {
        el('b-set-mission-date').value = appData.missionStartDate || '';
        el('b-set-start').value        = appData.startWeight;
        el('b-set-current').value      = '';  // placeholder — auto from latest log
        el('b-set-goal').value         = appData.goalWeight;
        el('b-set-height').value       = appData.height || 70;
        openBodyModal('b-settings-modal');
    });
    el('b-settings-modal').querySelector('[data-close]').addEventListener('click', () => closeBodyModal('b-settings-modal'));
    el('b-settings-modal').querySelector('[data-backdrop]').addEventListener('click', () => closeBodyModal('b-settings-modal'));

    el('b-save-settings').addEventListener('click', () => {
        const mdate   = el('b-set-mission-date').value;
        const s       = parseFloat(el('b-set-start').value);
        const cRaw    = el('b-set-current').value;
        const g       = parseFloat(el('b-set-goal').value);
        const h       = parseFloat(el('b-set-height').value);
        if (!s || !g || !h) return;
        appData.startWeight = s;
        appData.goalWeight  = g;
        appData.height      = h;
        if (mdate) appData.missionStartDate = mdate;
        // If user specified an override current weight, inject it as today's entry
        if (cRaw !== '' && !isNaN(parseFloat(cRaw))) {
            const cw      = parseFloat(cRaw);
            const dateStr = getLocalISO(new Date());
            appData.entries = appData.entries.filter(e => e.date !== dateStr);
            appData.entries.push({ date: dateStr, weight: cw, isFasting: false, note: 'Config override' });
        }
        saveData();
        closeBodyModal('b-settings-modal');
    });

    // Chart range
    document.querySelectorAll('.b-range-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.b-range-tab').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentRange = btn.dataset.range;
            renderBodyChart(currentRange);
        });
    });

    // Calendar nav
    el('b-cal-prev').addEventListener('click', () => {
        calendarDate.setMonth(calendarDate.getMonth() - 1); renderBodyCalendar();
    });
    el('b-cal-next').addEventListener('click', () => {
        calendarDate.setMonth(calendarDate.getMonth() + 1); renderBodyCalendar();
    });

    // Toggle history
    el('b-toggle-history').addEventListener('click', () => {
        const hs = el('b-history-section');
        const hidden = hs.style.display !== 'block';
        hs.style.display = hidden ? 'block' : 'none';
        if (hidden) hs.scrollIntoView({ behavior: 'smooth' });
    });

    // Export
    el('b-export').addEventListener('click', () => {
        const blob = new Blob([JSON.stringify(appData, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `titan-body-${getLocalISO(new Date())}.json`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
    });

    // Import
    el('b-import-btn').addEventListener('click', () => {
        const input = document.createElement('input'); input.type = 'file'; input.accept = 'application/json';
        input.onchange = e => {
            const reader = new FileReader();
            reader.onload = ev => {
                try {
                    const p = JSON.parse(ev.target.result);
                    if (p.entries) { appData = p; if (!appData.height) appData.height = 70; saveData(); }
                } catch { /* invalid */ }
            };
            reader.readAsText(e.target.files[0]);
        };
        input.click();
    });

    // Clear
    el('b-wipe').addEventListener('click', () => {
        if (!confirm('Wipe all body data?')) return;
        localStorage.removeItem(SK); location.reload();
    });

    renderAll();

    // ── Measurements init ─────────────────────────────────────────────────────
    loadMeas();
    renderMeas();
    const mDateEl = el('m-date');
    if (mDateEl) mDateEl.value = getLocalISO(new Date());

    el('m-save-btn')?.addEventListener('click', () => {
        const date = el('m-date').value;
        if (!date) return;
        const bodyfat = el('m-bodyfat').value !== '' ? parseFloat(el('m-bodyfat').value) : null;
        const chest   = el('m-chest').value   !== '' ? parseFloat(el('m-chest').value)   : null;
        const waist   = el('m-waist').value   !== '' ? parseFloat(el('m-waist').value)   : null;
        const biceps  = el('m-biceps').value  !== '' ? parseFloat(el('m-biceps').value)  : null;
        const thighs  = el('m-thighs').value  !== '' ? parseFloat(el('m-thighs').value)  : null;
        const notes   = el('m-notes').value.trim();

        const existingIdx = mData.findIndex(m => m.date === date);
        const entry = {
            id:     existingIdx >= 0 ? mData[existingIdx].id : Date.now(),
            date, bodyfat, chest, waist, biceps, thighs, notes,
        };
        if (existingIdx >= 0) mData[existingIdx] = entry;
        else                  mData.push(entry);
        saveMeas();
        if (_measCloud) {
            if (existingIdx >= 0) {
                _measCloud.removeMeasurement(entry.id)
                    .catch(() => {})
                    .then(() => _measCloud.addMeasurement(entry).catch(() => {}));
            } else {
                _measCloud.addMeasurement(entry).catch(() => {});
            }
        }

        el('m-bodyfat').value = '';
        el('m-chest').value   = '';
        el('m-waist').value   = '';
        el('m-biceps').value  = '';
        el('m-thighs').value  = '';
        el('m-notes').value   = '';
    });

    el('m-export-btn')?.addEventListener('click', () => {
        const blob = new Blob([JSON.stringify(mData, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `titan-measurements-${getLocalISO(new Date())}.json`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
    });

    el('m-clear-btn')?.addEventListener('click', () => {
        if (!confirm('Clear all measurement data? This cannot be undone.')) return;
        mData = [];
        localStorage.removeItem(MK);
        renderMeas();
        if (_measCloud) _measCloud.wipeAllMeasurements().catch(() => {});
    });
}
