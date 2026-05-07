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
