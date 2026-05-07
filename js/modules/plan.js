import { exercises } from '../data/exercises.js';

const KEY = 'titan_plans';

let _cloud = null;

export function setPlansCloud(c)        { _cloud = c; }
export function getAllPlans()           { return _all(); }
export function syncPlansFromCloud(list) { localStorage.setItem(KEY, JSON.stringify(list)); }

export function savePlan(plan) {
    const all = _all();
    const i   = all.findIndex(p => p.workout === plan.workout);
    if (i >= 0) all[i] = plan; else all.push(plan);
    localStorage.setItem(KEY, JSON.stringify(all));
    if (_cloud) _cloud.upsertPlan(plan).catch(() => {});
}

export function removePlan(workout) {
    localStorage.setItem(KEY, JSON.stringify(_all().filter(p => p.workout !== workout)));
    if (_cloud) _cloud.deletePlan(workout).catch(() => {});
}

function _findForDay(dayValue) {
    const el    = document.getElementById('muscleGroup');
    const label = el?.options[el?.selectedIndex]?.textContent ?? '';
    return _all().find(p => (p.day && p.day === dayValue) || label.includes(p.workout)) ?? null;
}

function _all() {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; }
}

function _fmtRest(s) {
    if (s >= 60) {
        const m = Math.floor(s / 60), r = s % 60;
        return r ? `${m}:${String(r).padStart(2, '0')}` : `${m} min`;
    }
    return `${s}s`;
}

export function renderPlanPanel(day) {
    const panel = document.getElementById('planPanel');
    if (!panel) return;

    if (!day) { panel.innerHTML = ''; panel.hidden = true; return; }

    const plan = _findForDay(day);
    if (!plan) { panel.innerHTML = ''; panel.hidden = true; return; }

    const exList = exercises[day] || [];

    panel.hidden = false;
    panel.innerHTML = `
        <div class="plan-header">
            <div class="plan-header-left">
                <span class="plan-label">Program Guide</span>
                <span class="plan-title">${plan.workout}</span>
            </div>
            <button type="button" class="btn-plan-remove" data-workout="${plan.workout}">✕ Remove</button>
        </div>
        <div class="plan-grid">
            ${plan.scheme.map(item => {
                const name = item.name || exList[item.order - 1] || `Exercise ${item.order}`;
                return `
                <div class="plan-card">
                    <div class="plan-card-order">${item.order}</div>
                    <div class="plan-card-body">
                        <div class="plan-card-name">${name}</div>
                        <div class="plan-card-meta">
                            <span class="plan-badge plan-badge--sets">${item.sets_reps}</span>
                            <span class="plan-badge plan-badge--rest">⏱ ${_fmtRest(item.rest_seconds)}</span>
                        </div>
                        <div class="plan-card-prog">${item.progression}</div>
                    </div>
                </div>`;
            }).join('')}
        </div>
        ${plan.notes ? `<div class="plan-notes">${plan.notes}</div>` : ''}`;

    panel.querySelector('.btn-plan-remove').addEventListener('click', e => {
        removePlan(e.currentTarget.dataset.workout);
        panel.innerHTML = '';
        panel.hidden = true;
    });
}
