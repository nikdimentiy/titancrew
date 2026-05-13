const MS_DAY  = 1000 * 60 * 60 * 24;
const UNIT_KEY = 'titan_unit';

export function getUnit() {
    return localStorage.getItem(UNIT_KEY) || 'lbs';
}

function epley1RM(weight, reps) {
    if (reps === 1) return weight;
    return Math.round(weight * (1 + reps / 30));
}

export function updateMetrics(data) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const weekAgo = new Date(today);
    weekAgo.setDate(today.getDate() - 7);

    const twoWeeksAgo = new Date(today);
    twoWeeksAgo.setDate(today.getDate() - 14);

    const unit = getUnit();

    // ── Weekly Volume ──────────────────────────────────────────────
    const weeklyEntries = data.filter(e => {
        const d = new Date(e.date + 'T00:00:00');
        return !(e.isBodyweight ?? (e.weight === 0)) && d >= weekAgo;
    });
    const weeklyVolume = weeklyEntries.reduce((sum, e) => sum + e.volume, 0);
    document.getElementById('weeklyVolume').textContent = weeklyVolume.toLocaleString();

    const unitEl = document.getElementById('volumeUnit');
    if (unitEl) unitEl.textContent = unit + ' lifted';

    const bar = document.getElementById('weeklyVolumeBar');
    if (bar) bar.style.width = Math.min(100, Math.round(weeklyVolume / 50)) + '%';

    // ── Streak ─────────────────────────────────────────────────────
    const uniqueDates = [...new Set(data.map(e => e.date))]
        .sort((a, b) => new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00'));

    let streak = 0;
    if (uniqueDates.length > 0) {
        const latest = new Date(uniqueDates[0] + 'T00:00:00');
        if (Math.floor((today - latest) / MS_DAY) <= 1) {
            let check = new Date(latest);
            for (const dateStr of uniqueDates) {
                const d = new Date(dateStr + 'T00:00:00');
                if (d.getTime() === check.getTime()) {
                    streak++;
                    check.setDate(check.getDate() - 1);
                } else {
                    break;
                }
            }
        }
    }
    document.getElementById('workoutStreak').textContent = streak;

    // ── Arsenal ────────────────────────────────────────────────────
    const uniqueExercises = new Set(data.map(e => e.exercise));
    document.getElementById('prCount').textContent = uniqueExercises.size;

    // ── Volume Trend ───────────────────────────────────────────────
    const lastWeekVolume = data
        .filter(e => {
            const d = new Date(e.date + 'T00:00:00');
            return !(e.isBodyweight ?? (e.weight === 0)) && d >= twoWeeksAgo && d < weekAgo;
        })
        .reduce((sum, e) => sum + e.volume, 0);

    const trendEl = document.getElementById('volumeTrend');
    const badgeEl = document.getElementById('trendBadge');
    if (trendEl && badgeEl) {
        if (weeklyVolume === 0 && lastWeekVolume === 0) {
            trendEl.textContent = '—';
            badgeEl.textContent = 'log sets to start';
            badgeEl.className = 'trend-badge trend-badge--flat';
        } else if (lastWeekVolume === 0) {
            trendEl.textContent = '✦';
            badgeEl.textContent = 'first week!';
            badgeEl.className = 'trend-badge trend-badge--up';
        } else {
            const pct = Math.round(((weeklyVolume - lastWeekVolume) / lastWeekVolume) * 100);
            trendEl.textContent = (pct >= 0 ? '+' : '') + pct + '%';
            badgeEl.textContent = pct >= 0 ? '↑ vs last week' : '↓ vs last week';
            badgeEl.className = 'trend-badge ' + (pct >= 0 ? 'trend-badge--up' : 'trend-badge--down');
        }
    }

    // ── Avg RPE this week ──────────────────────────────────────────
    const rpeEntries = weeklyEntries.filter(e => e.rpe != null);
    const avgRpeEl = document.getElementById('avgRpe');
    if (avgRpeEl) {
        avgRpeEl.textContent = rpeEntries.length > 0
            ? (rpeEntries.reduce((s, e) => s + e.rpe, 0) / rpeEntries.length).toFixed(1)
            : '—';
    }

    // ── Total Sessions ─────────────────────────────────────────────
    const sessEl = document.getElementById('totalSessions');
    if (sessEl) sessEl.textContent = uniqueDates.length;
}

// ── Widget Detail Modal ────────────────────────────────────────────────────────

const _MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function _fmtDate(s) {
    const d = new Date(s + 'T00:00:00');
    return `${d.getDate()} ${_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function _buildVolume(data) {
    const unit = getUnit();
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const byDate = {};
    data.forEach(e => { if (e.weight > 0) byDate[e.date] = (byDate[e.date] || 0) + e.volume; });
    const recent = Object.entries(byDate).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 5);
    const weeklyVols = Array.from({ length: 5 }, (_, w) => {
        const end   = new Date(today); end.setDate(today.getDate() - 7 * w);
        const start = new Date(today); start.setDate(today.getDate() - 7 * (w + 1));
        return data.filter(e => { const d = new Date(e.date + 'T00:00:00'); return e.weight > 0 && d >= start && d < end; })
                   .reduce((s, e) => s + e.volume, 0);
    });
    const thisWeek = weeklyVols[0];
    const bestWeek = Math.max(...weeklyVols);
    const rows = recent.length
        ? recent.map(([dt, vol]) => `<div class="wdm-row"><span class="wdm-row-label">${_fmtDate(dt)}</span><span class="wdm-row-val">${Math.round(vol).toLocaleString()} ${unit}</span></div>`).join('')
        : '<div class="wdm-empty">No weighted sets logged yet.</div>';
    return `<div class="wdm-icon-title"><span class="wdm-icon">🏋️</span><div class="wdm-title">Weekly Volume</div></div>
<div class="wdm-section-label">5 Recent Sessions</div><div class="wdm-rows">${rows}</div>
<div class="wdm-stats">
  <div class="wdm-stat"><span class="wdm-stat-val">${Math.round(thisWeek).toLocaleString()}</span><span class="wdm-stat-lbl">This week</span></div>
  <div class="wdm-stat"><span class="wdm-stat-val">${Math.round(bestWeek).toLocaleString()}</span><span class="wdm-stat-lbl">Best week (5w)</span></div>
  <div class="wdm-stat"><span class="wdm-stat-val">${unit.toUpperCase()}</span><span class="wdm-stat-lbl">Unit</span></div>
</div>`;
}

function _buildStreak(data) {
    const uniqueAsc  = [...new Set(data.map(e => e.date))].sort();
    const uniqueDesc = [...uniqueAsc].reverse();
    const today = new Date(); today.setHours(0, 0, 0, 0);
    let streak = 0;
    if (uniqueDesc.length) {
        const latest = new Date(uniqueDesc[0] + 'T00:00:00');
        if (Math.floor((today - latest) / MS_DAY) <= 1) {
            let check = new Date(latest);
            for (const s of uniqueDesc) {
                if (new Date(s + 'T00:00:00').getTime() === check.getTime()) { streak++; check.setDate(check.getDate() - 1); }
                else break;
            }
        }
    }
    let best = uniqueAsc.length ? 1 : 0, cur = 1;
    for (let i = 1; i < uniqueAsc.length; i++) {
        const diff = Math.round((new Date(uniqueAsc[i] + 'T00:00:00') - new Date(uniqueAsc[i - 1] + 'T00:00:00')) / MS_DAY);
        if (diff === 1) { cur++; best = Math.max(best, cur); } else cur = 1;
    }
    best = Math.max(best, streak);
    const daysSince = uniqueDesc.length ? Math.floor((today - new Date(uniqueDesc[0] + 'T00:00:00')) / MS_DAY) : null;
    const rows = uniqueDesc.slice(0, 5).length
        ? uniqueDesc.slice(0, 5).map(dt => `<div class="wdm-row"><span class="wdm-row-label">${_fmtDate(dt)}</span><span class="wdm-row-val">🔥</span></div>`).join('')
        : '<div class="wdm-empty">No workouts logged yet.</div>';
    return `<div class="wdm-icon-title"><span class="wdm-icon">🔥</span><div class="wdm-title">Workout Streak</div></div>
<div class="wdm-section-label">Last 5 Training Days</div><div class="wdm-rows">${rows}</div>
<div class="wdm-stats">
  <div class="wdm-stat"><span class="wdm-stat-val">${streak}</span><span class="wdm-stat-lbl">Current streak</span></div>
  <div class="wdm-stat"><span class="wdm-stat-val">${best}</span><span class="wdm-stat-lbl">Best streak</span></div>
  <div class="wdm-stat"><span class="wdm-stat-val">${daysSince !== null ? daysSince : '—'}</span><span class="wdm-stat-lbl">Days since last</span></div>
</div>`;
}

function _buildArsenal(data) {
    const unit = getUnit();
    const pr = {};
    data.forEach(e => {
        if (e.weight > 0) {
            const est = epley1RM(e.weight, e.reps);
            if (!pr[e.exercise] || est > pr[e.exercise].est) pr[e.exercise] = { est, weight: e.weight, reps: e.reps };
        }
    });
    const top5 = Object.entries(pr).sort((a, b) => b[1].est - a[1].est).slice(0, 5);
    const rows = top5.length
        ? top5.map(([name, r]) => `<div class="wdm-row"><span class="wdm-row-label" title="${name}">${name.length > 26 ? name.slice(0, 24) + '…' : name}</span><span class="wdm-row-val">${r.est} ${unit}<span class="wdm-row-sub"> 1RM</span></span></div>`).join('')
        : '<div class="wdm-empty">No weighted exercises yet.</div>';
    return `<div class="wdm-icon-title"><span class="wdm-icon">💪</span><div class="wdm-title">Exercise Arsenal</div></div>
<div class="wdm-section-label">Top 5 by Est. 1RM</div><div class="wdm-rows">${rows}</div>
<div class="wdm-stats">
  <div class="wdm-stat"><span class="wdm-stat-val">${new Set(data.map(e => e.exercise)).size}</span><span class="wdm-stat-lbl">Total exercises</span></div>
  <div class="wdm-stat"><span class="wdm-stat-val">${Object.keys(pr).length}</span><span class="wdm-stat-lbl">Weighted</span></div>
</div>`;
}

function _buildTrend(data) {
    const unit = getUnit();
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const weeks = Array.from({ length: 5 }, (_, w) => {
        const end   = new Date(today); end.setDate(today.getDate() - 7 * w);
        const start = new Date(today); start.setDate(today.getDate() - 7 * (w + 1));
        const vol = data.filter(e => { const d = new Date(e.date + 'T00:00:00'); return e.weight > 0 && d >= start && d < end; })
                       .reduce((s, e) => s + e.volume, 0);
        let label;
        if (w === 0) label = 'This week';
        else if (w === 1) label = 'Last week';
        else {
            const s2 = `${start.getDate()} ${_MONTHS[start.getMonth()]}`;
            const e2 = new Date(end - 1);
            label = `${s2} – ${e2.getDate()} ${_MONTHS[e2.getMonth()]}`;
        }
        return { label, vol };
    });
    const max = Math.max(...weeks.map(w => w.vol), 1);
    const rows = weeks.map(w => {
        const pct = Math.round(w.vol / max * 100);
        return `<div class="wdm-row"><span class="wdm-row-label">${w.label}</span><div class="wdm-bar-wrap"><div class="wdm-bar-fill" style="width:${pct}%"></div></div><span class="wdm-row-val">${Math.round(w.vol).toLocaleString()}</span></div>`;
    }).join('');
    const pctChange = weeks[1].vol > 0 ? Math.round(((weeks[0].vol - weeks[1].vol) / weeks[1].vol) * 100) : null;
    return `<div class="wdm-icon-title"><span class="wdm-icon">📈</span><div class="wdm-title">Volume Trend</div></div>
<div class="wdm-section-label">Weekly Volumes (${unit})</div><div class="wdm-rows">${rows}</div>
<div class="wdm-stats">
  <div class="wdm-stat"><span class="wdm-stat-val">${Math.round(max).toLocaleString()}</span><span class="wdm-stat-lbl">Peak week (5w)</span></div>
  <div class="wdm-stat"><span class="wdm-stat-val">${pctChange !== null ? (pctChange >= 0 ? '+' : '') + pctChange + '%' : '—'}</span><span class="wdm-stat-lbl">vs last week</span></div>
</div>`;
}

function _buildRpe(data) {
    const recent = data.filter(e => e.rpe != null).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
    const rows = recent.length
        ? recent.map(e => `<div class="wdm-row"><span class="wdm-row-label">${e.exercise.length > 22 ? e.exercise.slice(0, 20) + '…' : e.exercise}<span class="wdm-row-date">${e.date}</span></span><span class="wdm-row-val">RPE ${e.rpe}</span></div>`).join('')
        : '<div class="wdm-empty">No RPE data logged yet.</div>';
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const weekAgo = new Date(today); weekAgo.setDate(today.getDate() - 7);
    const weekRpe = data.filter(e => e.rpe != null && new Date(e.date + 'T00:00:00') >= weekAgo);
    const allRpe  = data.filter(e => e.rpe != null);
    const avgWeek = weekRpe.length ? (weekRpe.reduce((s, e) => s + e.rpe, 0) / weekRpe.length).toFixed(1) : '—';
    const avgAll  = allRpe.length  ? (allRpe.reduce((s, e) => s + e.rpe, 0) / allRpe.length).toFixed(1) : '—';
    return `<div class="wdm-icon-title"><span class="wdm-icon">⚡</span><div class="wdm-title">Avg Intensity (RPE)</div></div>
<div class="wdm-section-label">5 Recent RPE Entries</div><div class="wdm-rows">${rows}</div>
<div class="wdm-stats">
  <div class="wdm-stat"><span class="wdm-stat-val">${avgWeek}</span><span class="wdm-stat-lbl">This week avg</span></div>
  <div class="wdm-stat"><span class="wdm-stat-val">${avgAll}</span><span class="wdm-stat-lbl">All-time avg</span></div>
  <div class="wdm-stat"><span class="wdm-stat-val">${allRpe.length}</span><span class="wdm-stat-lbl">Total RPE logs</span></div>
</div>`;
}

function _buildSessions(data) {
    const unit = getUnit();
    const byDate = {};
    data.forEach(e => {
        if (!byDate[e.date]) byDate[e.date] = { ex: new Set(), sets: 0, vol: 0 };
        byDate[e.date].ex.add(e.exercise);
        byDate[e.date].sets++;
        byDate[e.date].vol += e.volume || 0;
    });
    const recent = Object.entries(byDate).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 5);
    const rows = recent.length
        ? recent.map(([dt, s]) => `<div class="wdm-row"><span class="wdm-row-label">${_fmtDate(dt)}</span><span class="wdm-row-val">${s.ex.size} ex · ${s.sets} sets</span></div>`).join('')
        : '<div class="wdm-empty">No sessions logged yet.</div>';
    const allDates = Object.keys(byDate).sort();
    const total = allDates.length;
    let monthlyAvg = '—';
    if (allDates.length >= 2) {
        const first = new Date(allDates[0] + 'T00:00:00');
        const last  = new Date(allDates[allDates.length - 1] + 'T00:00:00');
        const months = Math.max(1, (last.getFullYear() - first.getFullYear()) * 12 + last.getMonth() - first.getMonth() + 1);
        monthlyAvg = (total / months).toFixed(1);
    }
    return `<div class="wdm-icon-title"><span class="wdm-icon">🎯</span><div class="wdm-title">Total Sessions</div></div>
<div class="wdm-section-label">Last 5 Workouts</div><div class="wdm-rows">${rows}</div>
<div class="wdm-stats">
  <div class="wdm-stat"><span class="wdm-stat-val">${total}</span><span class="wdm-stat-lbl">Total days</span></div>
  <div class="wdm-stat"><span class="wdm-stat-val">${monthlyAvg}</span><span class="wdm-stat-lbl">Days / month</span></div>
  <div class="wdm-stat"><span class="wdm-stat-val">${data.length}</span><span class="wdm-stat-lbl">Total sets</span></div>
</div>`;
}

export function initWidgetModal(getData) {
    const overlay = document.getElementById('wdm-overlay');
    const content = document.getElementById('wdm-content');
    if (!overlay || !content) return;

    function close() { overlay.classList.remove('open'); }

    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    document.getElementById('wdm-close').addEventListener('click', close);
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && overlay.classList.contains('open')) close(); });

    const builders = { volume: _buildVolume, streak: _buildStreak, arsenal: _buildArsenal, trend: _buildTrend, rpe: _buildRpe, sessions: _buildSessions };

    document.querySelectorAll('.metric-card[data-widget]').forEach(card => {
        card.addEventListener('click', () => {
            const fn = builders[card.dataset.widget];
            if (!fn) return;
            content.innerHTML = fn(getData());
            overlay.classList.add('open');
        });
    });
}

export function updatePersonalRecords(data) {
    const container = document.getElementById('prTable');
    container.innerHTML = '';

    const unit = getUnit();

    const pr = {};
    data.forEach(e => {
        if (e.weight > 0) {
            const estimated = epley1RM(e.weight, e.reps);
            if (!pr[e.exercise] || estimated > pr[e.exercise].estimated) {
                pr[e.exercise] = { weight: e.weight, reps: e.reps, estimated, date: e.date };
            }
        }
    });

    if (Object.keys(pr).length === 0) {
        const p = document.createElement('p');
        p.className = 'empty-state';
        p.textContent = 'No records yet — only weighted exercises (weight > 0) are counted.';
        container.appendChild(p);
        return;
    }

    const grid = document.createElement('div');
    grid.className = 'pr-grid';

    Object.entries(pr)
        .sort((a, b) => b[1].estimated - a[1].estimated)
        .forEach(([ex, rec]) => {
            const card = document.createElement('div');
            card.className = 'pr-card';
            card.innerHTML = `
                <div class="pr-card-name" title="${ex}">${ex}</div>
                <div class="pr-card-stats">
                    <div class="pr-stat">
                        <span class="pr-stat-val">${rec.weight}</span>
                        <span class="pr-stat-lbl">${unit} max</span>
                    </div>
                    <div class="pr-stat">
                        <span class="pr-stat-val">${rec.reps}</span>
                        <span class="pr-stat-lbl">best reps</span>
                    </div>
                    <div class="pr-stat">
                        <span class="pr-stat-val">${rec.estimated}</span>
                        <span class="pr-stat-lbl">est. 1RM ${unit}</span>
                    </div>
                </div>
                <div class="pr-card-date">${rec.date}</div>
            `;
            grid.appendChild(card);
        });

    container.appendChild(grid);
}
