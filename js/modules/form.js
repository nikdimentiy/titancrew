import { exercises } from '../data/exercises.js';
import { showToast } from './ui.js';

let _getWorkouts = () => [];
export function setWorkoutGetter(fn) { _getWorkouts = fn; }

function showLastSession(exerciseName) {
    const hint = document.getElementById('last-session-hint');
    const wrap = document.getElementById('last-hint-wrap');
    if (!hint || !wrap) return;
    if (!exerciseName) { wrap.style.display = 'none'; return; }

    const workouts = _getWorkouts();
    const past = workouts
        .filter(e => e.exercise === exerciseName)
        .sort((a, b) => b.date.localeCompare(a.date));

    if (past.length === 0) { wrap.style.display = 'none'; return; }

    const last       = past[0];
    const weightStr  = last.isBodyweight ? 'BW' : `${last.weight} lbs`;
    hint.innerHTML   = `<div class="last-hint-label">Last logged (${last.date})</div>
                        <div class="last-hint-val">${weightStr} · ${last.sets} sets · ${last.reps} reps</div>`;
    wrap.style.display = '';
}

export function updateExerciseAutocomplete(data) {
    const dl = document.getElementById('exercise-history');
    if (!dl) return;
    const names = [...new Set(data.map(e => e.exercise).filter(Boolean))].sort();
    dl.innerHTML = names.map(n => `<option value="${n.replace(/"/g, '&quot;')}">`).join('');
}

export function setupForm(onLog) {
    const muscleGroupEl = document.getElementById('muscleGroup');
    const exerciseEl    = document.getElementById('exercise');
    const customGroupEl = document.getElementById('customExGroup');
    const customExEl    = document.getElementById('customExercise');

    muscleGroupEl.addEventListener('change', () => {
        const day = muscleGroupEl.value;
        exerciseEl.innerHTML = '<option value="">Select exercise</option>';
        customGroupEl.style.display = 'none';
        customExEl.value = '';

        if (day && exercises[day]) {
            exercises[day].forEach(ex => {
                const opt = document.createElement('option');
                opt.value = ex;
                opt.textContent = ex;
                exerciseEl.appendChild(opt);
            });
        }
    });

    exerciseEl.addEventListener('change', () => {
        const isOther = exerciseEl.value === 'Other';
        customGroupEl.style.display = isOther ? 'flex' : 'none';
        if (!isOther) customExEl.value = '';
        showLastSession(isOther ? '' : exerciseEl.value);
    });

    customExEl.addEventListener('input', () => {
        showLastSession(customExEl.value.trim());
    });

    document.getElementById('btnLog').addEventListener('click', () => {
        const date        = document.getElementById('workoutDate').value;
        const muscleGroup = muscleGroupEl.value;
        const weight      = parseFloat(document.getElementById('weight').value) || 0;
        const sets        = parseInt(document.getElementById('sets').value)  || 0;
        const reps        = parseInt(document.getElementById('reps').value)  || 0;
        const rpe         = parseFloat(document.getElementById('rpe').value) || null;
        const notes       = document.getElementById('notes').value.trim();

        let exercise = exerciseEl.value;
        if (exercise === 'Other') exercise = customExEl.value.trim();

        if (!date || !muscleGroup || !exercise || sets < 1 || reps < 1) {
            showToast('Please fill in all required fields.', 'error');
            return;
        }

        const isBodyweight = weight === 0;
        const volume = isBodyweight ? sets * reps : weight * sets * reps;

        onLog({
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            date, muscleGroup, exercise,
            weight, sets, reps, volume, isBodyweight,
            rpe, notes,
        });

        document.getElementById('weight').value = '';
        document.getElementById('sets').value   = '';
        document.getElementById('reps').value   = '';
        document.getElementById('rpe').value    = '';
        document.getElementById('notes').value  = '';
        document.getElementById('weight').focus();

        showToast('Set logged!', 'success');
    });
}
