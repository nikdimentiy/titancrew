import { storage }                               from './data/storage.js';
import { setTodayInput, updateTimeWidgets, updatePstClock, updateSessionDuration, setSessionUser, setSyncStatus, updateWeeklySummary } from './modules/widgets.js';
import { setupForm, setWorkoutGetter, updateExerciseAutocomplete } from './modules/form.js';
import { updateWorkoutLog, updateFilterOptions } from './modules/history.js';
import { updateMetrics, updatePersonalRecords }  from './modules/metrics.js';
import { showToast }                             from './modules/ui.js';
import { savePlan, renderPlanPanel, setPlansCloud, getAllPlans, syncPlansFromCloud } from './modules/plan.js';
import { initAuth, signOut, signOutHard } from './modules/auth.js';
import { initCardio, openCardioPanel, setCardioCloud, getCardioWorkouts, syncCardioFromCloud } from './modules/cardio.js';
import { initBody, refreshBody, setMeasCloud, getMeasData, syncMeasFromCloud } from './modules/body.js';
import { initWorkout, activatePlan, setWorkoutCloud, getWorkoutState, applyWorkoutState, refreshWorkout } from './modules/workout.js';

// ── State ─────────────────────────────────────────────────────────────────────
let workoutData  = [];
let cloud        = null;  // lazily loaded when user is online
const SESSION_START = Date.now();

// ── Helpers ───────────────────────────────────────────────────────────────────
function normalizeEntry(e, i) {
    return {
        ...e,
        id:           e.id           ?? `legacy-${i}`,
        isBodyweight: e.isBodyweight ?? (e.weight === 0),
        rpe:          e.rpe          ?? null,
        notes:        e.notes        ?? '',
    };
}

// ── Render ────────────────────────────────────────────────────────────────────
function render() {
    updateFilterOptions(workoutData);
    updateWorkoutLog(workoutData, deleteEntry);
    updateMetrics(workoutData);
    updatePersonalRecords(workoutData);
    updateWeeklySummary(workoutData);
    updateExerciseAutocomplete(workoutData);
}

// ── Entry operations ──────────────────────────────────────────────────────────
function deleteEntry(id) {
    workoutData = workoutData.filter(e => e.id !== id);
    storage.save(workoutData);
    render();
    showToast('Set deleted.', 'info');
    if (cloud) cloud.removeWorkout(id).catch(() => {});
}

function logEntry(entry) {
    workoutData.push(entry);
    storage.save(workoutData);
    render();
    if (cloud) cloud.addWorkout(entry).catch(() => {});
}

// ── Plan template ─────────────────────────────────────────────────────────────
const PLAN_TEMPLATE = {
    workout_name: 'Грудь + Трицепс',
    day: 'day1',
    date: new Date().toISOString().slice(0, 10),
    exercises: [
        { name: 'Жим гантелей лёжа',     sets: 4, reps_range: '8–12',      rest_seconds: 90, progression: '+1 повтор каждую неделю или +1–2 кг' },
        { name: 'Разводка гантелей лёжа', sets: 3, reps_range: '12–15',     rest_seconds: 60, progression: 'Увеличивай амплитуду и вес' },
        { name: 'Жим гантелей сидя',      sets: 3, reps_range: '8–12',      rest_seconds: 90, progression: '+1 повтор каждую неделю' },
        { name: 'Французский жим',        sets: 3, reps_range: '10–12',     rest_seconds: 60, progression: 'Медленнее отрицательная фаза' },
        { name: 'Отжимания',              sets: 3, reps_range: 'до отказа', rest_seconds: 90, progression: 'Добавь вес (рюкзак)' },
    ],
    notes: 'Следуй прогрессии последовательно; записывай рабочие веса и повторы для отслеживания прогресса.',
};

function downloadTemplate() {
    const json = JSON.stringify(PLAN_TEMPLATE, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), { href: url, download: 'titan-plan-template.json' });
    a.click();
    URL.revokeObjectURL(url);
    showToast('Template downloaded!', 'success');
}

// ── Plan import ───────────────────────────────────────────────────────────────
function _normalizePlan(p) {
    // New format: { workout_name, exercises, day?, notes? }
    if (p.workout_name && Array.isArray(p.exercises)) {
        return {
            workout: p.workout_name,
            day: p.day || null,
            scheme: p.exercises.map((ex, i) => ({
                order:       i + 1,
                name:        ex.name,
                sets_reps:   `${ex.sets}×${ex.reps_range}`,
                rest_seconds: ex.rest_seconds,
                progression: ex.progression,
            })),
            notes: p.notes || '',
        };
    }
    // Legacy format: { workout, scheme }
    if (p.workout && Array.isArray(p.scheme)) return p;
    throw new Error('Expected "workout_name" + "exercises" array, or legacy "workout" + "scheme" array.');
}

function handlePlanImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = e => {
        try {
            const raw   = JSON.parse(e.target.result);
            const items = Array.isArray(raw) ? raw : [raw];
            const plans = items.map(_normalizePlan);

            plans.forEach(savePlan);
            showToast(`Plan loaded: ${plans.map(p => p.workout).join(', ')}`, 'success');

            const day = document.getElementById('muscleGroup').value;
            if (day) renderPlanPanel(day);

            // Activate the first plan in the Workout tab
            if (plans.length > 0) activatePlan(plans[0]);
        } catch (err) {
            showToast('Plan error: ' + err.message, 'error');
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}

// ── Wipe ──────────────────────────────────────────────────────────────────────
async function wipeData() {
    if (!confirm('ARE YOU SURE?\n\nThis permanently deletes all workout history.\nExport a backup first.')) return;
    workoutData = [];
    storage.clear();
    render();
    showToast('All data cleared.', 'info');
    if (cloud) {
        cloud.wipeAllWorkouts().catch(() => {});
    }
}

// ── UI setup ──────────────────────────────────────────────────────────────────
setupForm(logEntry);
setWorkoutGetter(() => workoutData);
setTodayInput();
updateTimeWidgets();
updatePstClock();
setInterval(() => {
    updatePstClock();
    updateSessionDuration(SESSION_START);
}, 1000);

// ── Strength storage ──────────────────────────────────────────────────────────
function exportStrengthData() {
    const json = JSON.stringify(workoutData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    Object.assign(document.createElement('a'), { href: url, download: 'titan-strength-backup.json' }).click();
    URL.revokeObjectURL(url);
    showToast('Strength data exported!', 'success');
}

function importStrengthData(file) {
    const reader = new FileReader();
    reader.onload = e => {
        try {
            const data = JSON.parse(e.target.result);
            if (!Array.isArray(data)) throw new Error('Invalid format');
            workoutData = data.map(normalizeEntry);
            storage.save(workoutData);
            render();
            showToast('Strength data imported!', 'success');
        } catch {
            showToast('Import failed — invalid file.', 'error');
        }
    };
    reader.readAsText(file);
}

// ── Unit preference ───────────────────────────────────────────────────────────
const UNIT_KEY = 'titan_unit';

function applyUnit(unit) {
    localStorage.setItem(UNIT_KEY, unit);
    document.getElementById('unitLbs')?.classList.toggle('active', unit === 'lbs');
    document.getElementById('unitKg') ?.classList.toggle('active', unit === 'kg');
    render();
    refreshBody();
    refreshWorkout();
}

document.getElementById('unitLbs')?.addEventListener('click', () => applyUnit('lbs'));
document.getElementById('unitKg') ?.addEventListener('click', () => applyUnit('kg'));

// Sync toggle buttons with whatever is already in storage
applyUnit(localStorage.getItem(UNIT_KEY) || 'lbs');

// ── Event listeners ───────────────────────────────────────────────────────────
document.getElementById('btnWipe').addEventListener('click', wipeData);
document.getElementById('btnSignOut').addEventListener('click', signOut);
document.getElementById('btnSignOutHard').addEventListener('click', signOutHard);
document.getElementById('btnLoadPlan').addEventListener('click', () => document.getElementById('planFileInput').click());
document.getElementById('btnDownloadTemplate').addEventListener('click', downloadTemplate);
document.getElementById('planFileInput').addEventListener('change', handlePlanImport);
document.getElementById('muscleGroup').addEventListener('change', () => renderPlanPanel(document.getElementById('muscleGroup').value));
document.getElementById('filterExercise').addEventListener('change', render);
document.getElementById('filterRange').addEventListener('change', render);
document.getElementById('s-export-btn').addEventListener('click', exportStrengthData);
document.getElementById('s-import-input').addEventListener('change', e => { if (e.target.files[0]) importStrengthData(e.target.files[0]); e.target.value = ''; });
document.getElementById('s-wipe-btn').addEventListener('click', wipeData);

// ── Auth → data load ──────────────────────────────────────────────────────────
initAuth(async user => {
    setSessionUser(user);
    if (user) {
        cloud = await import('./data/cloud.js');

        // Render cached local data immediately for instant UI
        workoutData = storage.load().map(normalizeEntry);
        render();

        try {
            setSyncStatus('syncing');
            showToast('Syncing with cloud…', 'info');
            const cloudEntries = await cloud.fetchWorkouts();
            const cloudIds     = new Set(cloudEntries.map(e => e.id));
            const localOnly    = workoutData.filter(e => !cloudIds.has(e.id));

            // Cloud is source of truth; append any local-only entries
            workoutData = [...cloudEntries, ...localOnly].map(normalizeEntry);
            storage.save(workoutData);
            render();
            setSyncStatus('synced');
            showToast('Cloud sync complete.', 'success');

            // Upload entries that exist locally but not yet in cloud
            if (localOnly.length > 0) {
                Promise.all(localOnly.map(e => cloud.addWorkout(e).catch(() => {}))).catch(() => {});
            }
        } catch {
            setSyncStatus('error');
            showToast('Sync error — showing local data.', 'error');
        }

        // Cardio cloud sync
        try {
            const cloudCardio   = await cloud.fetchCardioSessions();
            const localCardio   = getCardioWorkouts();
            const cloudCardioIds = new Set(cloudCardio.map(e => e.id));
            const localCardioOnly = localCardio.filter(e => !cloudCardioIds.has(e.id));
            syncCardioFromCloud([...cloudCardio, ...localCardioOnly]);
            if (localCardioOnly.length > 0) {
                Promise.all(localCardioOnly.map(e => cloud.addCardioSession(e).catch(() => {}))).catch(() => {});
            }
        } catch { /* sync error — keep local cardio data */ }

        setCardioCloud(cloud);

        cloud.subscribeCardio(user.$id, (event, entry) => {
            const current = getCardioWorkouts();
            if (event === 'create' && !current.some(e => e.id === entry.id)) {
                syncCardioFromCloud([entry, ...current]);
            } else if (event === 'delete') {
                syncCardioFromCloud(current.filter(e => e.id !== entry.id));
            }
        });

        // Plans cloud sync
        try {
            const cloudPlans      = await cloud.fetchPlans();
            const localPlans      = getAllPlans();
            const cloudPlanNames  = new Set(cloudPlans.map(p => p.workout));
            const localOnlyPlans  = localPlans.filter(p => !cloudPlanNames.has(p.workout));
            syncPlansFromCloud([...cloudPlans, ...localOnlyPlans]);
            if (localOnlyPlans.length > 0) {
                Promise.all(localOnlyPlans.map(p => cloud.upsertPlan(p).catch(() => {}))).catch(() => {});
            }
        } catch { /* keep local plans */ }

        setPlansCloud(cloud);

        cloud.subscribePlans(user.$id, (event, data) => {
            const all = getAllPlans();
            if (event === 'upsert') {
                const i = all.findIndex(p => p.workout === data.workout);
                if (i >= 0) all[i] = data; else all.push(data);
                syncPlansFromCloud(all);
            } else if (event === 'delete') {
                syncPlansFromCloud(all.filter(p => p.workout !== data));
            }
        });

        // Measurements cloud sync
        try {
            const cloudMeas     = await cloud.fetchMeasurements();
            const localMeas     = getMeasData();
            const cloudMeasIds  = new Set(cloudMeas.map(e => String(e.id)));
            const localMeasOnly = localMeas.filter(e => !cloudMeasIds.has(String(e.id)));
            syncMeasFromCloud([...cloudMeas, ...localMeasOnly]);
            if (localMeasOnly.length > 0) {
                Promise.all(localMeasOnly.map(e => cloud.addMeasurement(e).catch(() => {}))).catch(() => {});
            }
        } catch { /* keep local measurements */ }

        setMeasCloud(cloud);

        // Workout state cloud sync
        try {
            const cloudState = await cloud.fetchWorkoutState();
            if (cloudState && !getWorkoutState()) applyWorkoutState(cloudState);
        } catch { /* keep local state */ }

        setWorkoutCloud(cloud);

        cloud.subscribeWorkoutState(user.$id, (event, state) => {
            if (event === 'update') applyWorkoutState(state);
            else if (event === 'clear') applyWorkoutState(null);
        });

        // Realtime subscription: receive changes from other devices
        cloud.subscribe(user.$id, (event, entry) => {
            if (event === 'create' && !workoutData.some(e => e.id === entry.id)) {
                workoutData = [entry, ...workoutData];
                storage.save(workoutData);
                render();
            } else if (event === 'delete') {
                workoutData = workoutData.filter(e => e.id !== entry.id);
                storage.save(workoutData);
                render();
            }
        });
    } else {
        // Offline mode — localStorage only
        workoutData = storage.load().map(normalizeEntry);
        setSyncStatus('idle');
        render();
    }
});

// ── Tab Navigation ────────────────────────────────────────────────────────────
function switchTab(name) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.bnav-btn').forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
    });
    document.querySelectorAll('.tab-section').forEach(s => s.classList.remove('active'));

    const btn = document.querySelector(`.tab-btn[data-tab="${name}"]`);
    if (btn) btn.classList.add('active');

    const bBtn = document.querySelector(`.bnav-btn[data-tab="${name}"]`);
    if (bBtn) { bBtn.classList.add('active'); bBtn.setAttribute('aria-selected', 'true'); }

    const sec = document.getElementById(`tab-${name}`);
    if (sec) sec.classList.add('active');
}

document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

document.querySelectorAll('.bnav-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

// ── Log Sidebar ───────────────────────────────────────────────────────────────
const logOverlay = document.getElementById('log-overlay');
const logPanel   = document.getElementById('log-panel');

function openLogPanel()   { logPanel.classList.add('open'); logOverlay.classList.add('open'); }
function closeLogPanel()  { logPanel.classList.remove('open'); logOverlay.classList.remove('open'); }
function toggleLogPanel() { logPanel.classList.contains('open') ? closeLogPanel() : openLogPanel(); }

document.getElementById('btnOpenLog').addEventListener('click', openLogPanel);
document.getElementById('log-panel-close').addEventListener('click', closeLogPanel);
logOverlay.addEventListener('click', closeLogPanel);

// ── Keyboard Shortcuts ────────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
    if (e.ctrlKey && e.key === '1') { e.preventDefault(); switchTab('strength'); }
    if (e.ctrlKey && e.key === '2') { e.preventDefault(); switchTab('cardio'); }
    if (e.ctrlKey && e.key === '3') { e.preventDefault(); switchTab('body'); }
    if (e.ctrlKey && e.key === '4') { e.preventDefault(); switchTab('metrics'); }
    if (e.ctrlKey && e.key === '5') { e.preventDefault(); switchTab('vault'); }
    if (e.ctrlKey && e.key === '6') { e.preventDefault(); switchTab('workout'); }
    if (e.ctrlKey && e.key === '7') { e.preventDefault(); switchTab('system'); }
    if ((e.key === 's' || e.key === 'S') && !e.ctrlKey && !e.altKey && !e.metaKey) {
        const tag = document.activeElement.tagName;
        if (!['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) {
            e.preventDefault();
            toggleLogPanel();
        }
    }
    if ((e.key === 'c' || e.key === 'C') && !e.ctrlKey && !e.altKey && !e.metaKey) {
        const tag = document.activeElement.tagName;
        if (!['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) {
            e.preventDefault();
            openCardioPanel();
        }
    }
    if ((e.key === 'w' || e.key === 'W') && !e.ctrlKey && !e.altKey && !e.metaKey) {
        const tag = document.activeElement.tagName;
        if (!['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) {
            e.preventDefault();
            document.getElementById('b-open-log')?.click();
        }
    }
    if ((e.key === 'p' || e.key === 'P') && !e.ctrlKey && !e.altKey && !e.metaKey) {
        const tag = document.activeElement.tagName;
        if (!['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) {
            e.preventDefault();
            switchTab('workout');
        }
    }
    if (e.ctrlKey && e.key === '/') {
        e.preventDefault();
        toggleShortcutsModal();
    }
    if (e.key === 'Escape') {
        closeShortcutsModal();
    }
});

// ── Shortcuts Modal ───────────────────────────────────────────────────────────
const shortcutsModal = document.getElementById('shortcuts-modal');
function openShortcutsModal()  { shortcutsModal.classList.add('open'); }
function closeShortcutsModal() { shortcutsModal.classList.remove('open'); }
function toggleShortcutsModal(){ shortcutsModal.classList.toggle('open'); }
document.getElementById('shortcuts-close').addEventListener('click', closeShortcutsModal);
shortcutsModal.addEventListener('click', e => { if (e.target === shortcutsModal) closeShortcutsModal(); });

// ── 1RM Calculator ───────────────────────────────────────────────────────────
function calcORM() {
    const w  = parseFloat(document.getElementById('orm-weight')?.value);
    const r  = parseInt(document.getElementById('orm-reps')?.value);
    const el = document.getElementById('orm-result-val');
    if (!el) return;
    if (!w || !r || r < 1) { el.textContent = '—'; return; }
    const orm  = r === 1 ? w : w * (1 + r / 30);
    const unit = localStorage.getItem('titan_unit') || 'lbs';
    el.textContent = `${Math.round(orm)} ${unit}`;
}
document.getElementById('orm-weight')?.addEventListener('input', calcORM);
document.getElementById('orm-reps')?.addEventListener('input', calcORM);

// ── Init Cardio + Body + Workout ──────────────────────────────────────────────
initCardio();
document.getElementById('c-open-panel-cardio').addEventListener('click', openCardioPanel);
initBody();
initWorkout(logEntry);

// ── Service worker ────────────────────────────────────────────────────────────
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
}
