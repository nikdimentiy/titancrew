const MS_DAY = 1000 * 60 * 60 * 24;

export function updateFilterOptions(data) {
    const sel = document.getElementById('filterExercise');
    const current = sel.value;
    sel.innerHTML = '<option value="">All Exercises</option>';
    [...new Set(data.map(e => e.exercise))].sort().forEach(ex => {
        const opt = document.createElement('option');
        opt.value = ex;
        opt.textContent = ex;
        sel.appendChild(opt);
    });
    if (current) sel.value = current;
}

export function updateWorkoutLog(data, onDelete) {
    const tbody     = document.querySelector('#workoutLog tbody');
    const table     = document.getElementById('workoutLog');
    const emptyMsg  = document.getElementById('historyEmpty');
    const filterEx  = document.getElementById('filterExercise').value;
    const filterRange = document.getElementById('filterRange').value;

    let filtered = [...data];

    if (filterEx) {
        filtered = filtered.filter(e => e.exercise === filterEx);
    }

    if (filterRange !== 'all') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        filtered = filtered.filter(e => {
            const d = new Date(e.date + 'T00:00:00');
            if (filterRange === 'week') {
                const weekAgo = new Date(today);
                weekAgo.setDate(today.getDate() - 7);
                return d >= weekAgo;
            }
            if (filterRange === 'month') {
                return d.getMonth() === today.getMonth() &&
                       d.getFullYear() === today.getFullYear();
            }
            return true;
        });
    }

    filtered.sort((a, b) => new Date(b.date + 'T00:00:00') - new Date(a.date + 'T00:00:00'));

    tbody.innerHTML = '';

    if (filtered.length === 0) {
        emptyMsg.style.display = 'block';
        table.style.display    = 'none';
        return;
    }

    emptyMsg.style.display = 'none';
    table.style.display    = 'table';

    filtered.forEach(entry => {
        const isBodyweight = entry.isBodyweight ?? (entry.weight === 0);
        const volumeText   = isBodyweight
            ? `${entry.volume} reps`
            : entry.volume > 0 ? `${entry.volume} lbs` : '-';

        const tr = document.createElement('tr');

        [
            entry.date,
            entry.exercise,
            entry.weight > 0 ? String(entry.weight) : 'BW',
            String(entry.sets),
            String(entry.reps),
            entry.rpe != null ? String(entry.rpe) : '-',
            volumeText,
            entry.notes || '-',
        ].forEach(text => {
            const td = document.createElement('td');
            td.textContent = text;
            tr.appendChild(td);
        });

        const tdDel = document.createElement('td');
        const btn   = document.createElement('button');
        btn.textContent = '✕';
        btn.className   = 'btn-delete';
        btn.setAttribute('aria-label', `Delete ${entry.exercise} on ${entry.date}`);
        btn.addEventListener('click', () => {
            if (confirm(`Delete this set?\n${entry.exercise} — ${entry.date}\n${entry.sets}×${entry.reps} @ ${entry.weight || 'BW'} lbs`)) {
                onDelete(entry.id);
            }
        });
        tdDel.appendChild(btn);
        tr.appendChild(tdDel);

        tbody.appendChild(tr);
    });
}
