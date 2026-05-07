const WK_SK       = 'titan_active_workout';
const WK_UNIT_KEY = 'titan_unit';
function _getUnit() { return localStorage.getItem(WK_UNIT_KEY) || 'lbs'; }

let _onLog      = null;
let _state      = null;   // { plan, date, loggedSets: { "exIdx-setIdx": { weight, reps, entryId } } }
let _cloud      = null;
let _exPanelIdx = null;   // null = add mode, number = edit mode (exercise index)

export function setWorkoutCloud(c)    { _cloud = c; }
export function getWorkoutState()     { return _state; }
export function applyWorkoutState(s)  { _state = s; localStorage.setItem(WK_SK, JSON.stringify(_state)); _render(); }

function _load() {
    try { _state = JSON.parse(localStorage.getItem(WK_SK)) || null; } catch { _state = null; }
}
function _save() {
    localStorage.setItem(WK_SK, JSON.stringify(_state));
    if (_cloud) {
        if (_state) _cloud.saveWorkoutState(_state).catch(() => {});
        else        _cloud.clearWorkoutState().catch(() => {});
    }
}

function _fmtRest(s) {
    if (!s) return '—';
    if (s >= 60) {
        const m = Math.floor(s / 60), r = s % 60;
        return r ? `${m}:${String(r).padStart(2, '0')}` : `${m} min`;
    }
    return `${s}s`;
}

// Parse "4×8–12" → { count: 4, repsHint: "8" }
function _parseSpec(str) {
    const m = (str || '').match(/^(\d+)[×x](.+)$/);
    if (!m) return { count: 1, repsHint: '' };
    return {
        count:    parseInt(m[1]) || 1,
        repsHint: m[2].match(/\d+/)?.[0] || '',
    };
}

function _totalSets() {
    return _state.plan.scheme.reduce((s, item) => s + _parseSpec(item.sets_reps).count, 0);
}

// Count only logged sets that belong to current scheme (ignores orphaned keys after edits)
function _loggedCount() {
    return _state.plan.scheme.reduce((count, item, exIdx) => {
        const { count: setsN } = _parseSpec(item.sets_reps);
        return count + Array.from({ length: setsN }, (_, i) => _state.loggedSets[`${exIdx}-${i}`]).filter(Boolean).length;
    }, 0);
}

// ── Exercise Panel ─────────────────────────────────────────────────────────────

function _openExPanel(exIdx = null) {
    _exPanelIdx = exIdx;
    const panel   = document.getElementById('ex-panel');
    const overlay = document.getElementById('ex-panel-overlay');
    document.getElementById('ex-panel-title').textContent = exIdx !== null ? 'Edit Exercise' : 'Add Exercise';

    if (exIdx !== null && _state?.plan?.scheme?.[exIdx]) {
        const ex = _state.plan.scheme[exIdx];
        document.getElementById('ex-name').value = ex.name        || '';
        document.getElementById('ex-sets').value = ex.sets_reps   || '';
        document.getElementById('ex-rest').value = ex.rest_seconds || '';
        document.getElementById('ex-prog').value = ex.progression  || '';
    } else {
        document.getElementById('ex-name').value = '';
        document.getElementById('ex-sets').value = '';
        document.getElementById('ex-rest').value = '';
        document.getElementById('ex-prog').value = '';
    }

    panel.classList.add('open');
    overlay.classList.add('open');
    document.getElementById('ex-name').focus();
}

function _closeExPanel() {
    document.getElementById('ex-panel').classList.remove('open');
    document.getElementById('ex-panel-overlay').classList.remove('open');
    _exPanelIdx = null;
}

function _saveExFromPanel() {
    const name = document.getElementById('ex-name').value.trim();
    const sets = document.getElementById('ex-sets').value.trim();
    if (!name || !sets) {
        document.getElementById('ex-name').focus();
        return;
    }

    const ex = {
        name,
        sets_reps:    sets,
        rest_seconds: parseInt(document.getElementById('ex-rest').value) || 0,
        progression:  document.getElementById('ex-prog').value.trim(),
        custom:       true,
        order:        1,
    };

    if (!_state) {
        _state = {
            plan:       { workout: 'Custom', day: '', scheme: [], notes: '' },
            date:       new Date().toISOString().slice(0, 10),
            loggedSets: {},
        };
    }

    if (_exPanelIdx !== null) {
        // Preserve non-custom fields (e.g., from a plan)
        const existing = _state.plan.scheme[_exPanelIdx];
        _state.plan.scheme[_exPanelIdx] = { ...existing, ...ex };
    } else {
        ex.order = _state.plan.scheme.length + 1;
        _state.plan.scheme.push(ex);
    }

    // Re-number all exercises
    _state.plan.scheme.forEach((item, i) => { item.order = i + 1; });

    _save();
    _closeExPanel();
    _render();
}

function _deleteEx(exIdx) {
    if (!_state?.plan?.scheme) return;
    if (!confirm('Remove this exercise from the workout?')) return;

    // Remap logged sets: remove the deleted exercise's sets and shift higher indices down
    const newLoggedSets = {};
    Object.entries(_state.loggedSets).forEach(([key, val]) => {
        const [ei, si] = key.split('-').map(Number);
        if (ei === exIdx) return;
        newLoggedSets[`${ei > exIdx ? ei - 1 : ei}-${si}`] = val;
    });

    _state.plan.scheme.splice(exIdx, 1);
    _state.plan.scheme.forEach((item, i) => { item.order = i + 1; });
    _state.loggedSets = newLoggedSets;

    if (_state.plan.scheme.length === 0) _state = null;

    _save();
    _render();
}

// ── Public API ────────────────────────────────────────────────────────────────

export function refreshWorkout() { _render(); }

export function initWorkout(onLog) {
    _onLog = onLog;
    _load();
    _render();

    document.getElementById('wk-clear-btn').addEventListener('click', () => {
        if (!confirm('Clear current workout session?')) return;
        _state = null;
        _save();
        _render();
    });

    // Static "Add Exercise" button (always in DOM)
    document.getElementById('wk-add-ex-btn').addEventListener('click', () => _openExPanel());

    // Exercise panel controls
    document.getElementById('ex-panel-close').addEventListener('click',   _closeExPanel);
    document.getElementById('ex-panel-overlay').addEventListener('click', _closeExPanel);
    document.getElementById('ex-cancel-btn').addEventListener('click',    _closeExPanel);
    document.getElementById('ex-save-btn').addEventListener('click',      _saveExFromPanel);

    // Submit on Enter in the panel inputs
    ['ex-name', 'ex-sets', 'ex-rest', 'ex-prog'].forEach(id => {
        document.getElementById(id).addEventListener('keydown', e => {
            if (e.key === 'Enter') { e.preventDefault(); _saveExFromPanel(); }
        });
    });
}

export function activatePlan(plan) {
    _state = {
        plan,
        date:       new Date().toISOString().slice(0, 10),
        loggedSets: {},
    };
    _save();
    _render();
    document.querySelector('.tab-btn[data-tab="workout"]')?.click();
}

// ── Render ────────────────────────────────────────────────────────────────────

function _render() {
    const content   = document.getElementById('wk-content');
    const headerBar = document.getElementById('wk-header-bar');
    if (!content) return;

    if (!_state || !_state.plan) {
        headerBar.classList.add('wk-hidden');
        content.innerHTML = `
            <div class="wk-empty">
                <div class="wk-empty-icon">
                    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
                        <path d="M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v0a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2z"/>
                        <line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/>
                    </svg>
                </div>
                <div class="wk-empty-title">No Active Workout</div>
                <div class="wk-empty-sub">Add exercises below, or go to Strength → Log a Set → Load Plan</div>
            </div>`;
        return;
    }

    const { plan, date, loggedSets } = _state;
    const total = _totalSets();
    const done  = _loggedCount();
    const pct   = total ? Math.round(done / total * 100) : 0;

    headerBar.classList.remove('wk-hidden');
    document.getElementById('wk-plan-name').textContent    = plan.workout;
    document.getElementById('wk-plan-date').textContent    = date;
    document.getElementById('wk-progress-bar').style.width = pct + '%';
    document.getElementById('wk-progress-label').textContent = `${done} / ${total} sets · ${pct}%`;

    content.innerHTML = plan.scheme.map((item, exIdx) => {
        const { count: setsN, repsHint } = _parseSpec(item.sets_reps);
        const name    = item.name || `Exercise ${item.order}`;
        const allDone = Array.from({ length: setsN }, (_, i) => loggedSets[`${exIdx}-${i}`]).every(Boolean);

        const setsHtml = Array.from({ length: setsN }, (_, setIdx) => {
            const key    = `${exIdx}-${setIdx}`;
            const logged = loggedSets[key];
            if (logged) {
                return `<div class="wk-set wk-set--done">
                    <span class="wk-set-check">✓</span>
                    <span class="wk-set-badge">Set ${setIdx + 1}</span>
                    <span class="wk-set-logged">${logged.weight ? logged.weight + ' ' + _getUnit() : 'BW'} × ${logged.reps}</span>
                </div>`;
            }
            return `<div class="wk-set">
                <span class="wk-set-label">Set ${setIdx + 1}</span>
                <input class="wk-input wk-input--weight" type="number" min="0" step="0.5" placeholder="${_getUnit()}" aria-label="Weight">
                <input class="wk-input wk-input--reps" type="number" min="1" max="999"
                    placeholder="${repsHint || '—'}" ${repsHint ? `value="${repsHint}"` : ''}
                    aria-label="Reps">
                <button class="wk-log-btn" data-ex="${exIdx}" data-set="${setIdx}" data-reps="${repsHint}">✓ Log</button>
            </div>`;
        }).join('');

        return `<div class="wk-exercise${allDone ? ' wk-exercise--done' : ''}">
            <div class="wk-ex-header">
                <div class="wk-ex-num">${item.order}</div>
                <div class="wk-ex-info">
                    <div class="wk-ex-name">${name}</div>
                    <div class="wk-ex-meta">
                        <span class="wk-badge wk-badge--sets">${item.sets_reps}</span>
                        ${item.rest_seconds ? `<span class="wk-badge wk-badge--rest">⏱ ${_fmtRest(item.rest_seconds)}</span>` : ''}
                    </div>
                    ${item.progression ? `<div class="wk-ex-prog">${item.progression}</div>` : ''}
                </div>
                <div class="wk-ex-actions">
                    ${allDone ? '<div class="wk-ex-done-check">✓</div>' : ''}
                    <button class="wk-ex-edit-btn" data-ex="${exIdx}" title="Edit exercise" aria-label="Edit exercise">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button class="wk-ex-del-btn" data-ex="${exIdx}" title="Delete exercise" aria-label="Delete exercise">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                    </button>
                </div>
            </div>
            <div class="wk-sets-row">${setsHtml}</div>
        </div>`;
    }).join('');

    if (plan.notes) {
        content.innerHTML += `<div class="plan-notes" style="margin-top:1rem;">${plan.notes}</div>`;
    }

    content.querySelectorAll('.wk-log-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const exIdx  = parseInt(btn.dataset.ex);
            const setIdx = parseInt(btn.dataset.set);
            const row    = btn.closest('.wk-set');
            const weight = parseFloat(row.querySelector('.wk-input--weight').value) || 0;
            const reps   = parseInt(row.querySelector('.wk-input--reps').value) || parseInt(btn.dataset.reps) || 1;
            _logSet(exIdx, setIdx, weight, reps);
        });
    });

    content.querySelectorAll('.wk-ex-edit-btn').forEach(btn => {
        btn.addEventListener('click', () => _openExPanel(parseInt(btn.dataset.ex)));
    });

    content.querySelectorAll('.wk-ex-del-btn').forEach(btn => {
        btn.addEventListener('click', () => _deleteEx(parseInt(btn.dataset.ex)));
    });
}

function _logSet(exIdx, setIdx, weight, reps) {
    const { plan, date } = _state;
    const item = plan.scheme[exIdx];
    const name = item.name || `Exercise ${item.order}`;

    const entry = {
        id:           `wk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        date,
        muscleGroup:  plan.day || '',
        exercise:     name,
        weight,
        sets:         1,
        reps,
        volume:       weight ? weight * reps : reps,
        isBodyweight: weight === 0,
        rpe:          null,
        notes:        `${plan.workout} – Set ${setIdx + 1}`,
    };

    _state.loggedSets[`${exIdx}-${setIdx}`] = { weight, reps, entryId: entry.id };
    _save();

    if (_onLog) _onLog(entry);
    _render();
}
