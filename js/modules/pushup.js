const PU_DATA_KEY = 'titan_pushup_data';
const PU_GRID_KEY = 'titan_pushup_grid';
const ROWS = 5;
const COLS = 5;

let _puOnLog    = null;
let _puOnDelete = null;
let _puCloud    = null;
let _puState    = { history: [] };
let _editingId  = null;

export function setPushUpCloud(c) { _puCloud = c; }

export function syncPushUpFromCloud(history) {
    _puState = { history };
    localStorage.setItem(PU_DATA_KEY, JSON.stringify(_puState));
    _renderHistory();
}

function _load() {
    try { _puState = JSON.parse(localStorage.getItem(PU_DATA_KEY)) || { history: [] }; }
    catch { _puState = { history: [] }; }
}

function _save() {
    localStorage.setItem(PU_DATA_KEY, JSON.stringify(_puState));
    if (_puCloud) _puCloud.savePushUpHistory(_puState.history).catch(() => {});
}

function _saveGrid() {
    const vals = [];
    for (let r = 0; r < ROWS; r++)
        for (let c = 0; c < COLS; c++) {
            const el = document.getElementById(`pu-cell-${r}-${c}`);
            vals.push(el ? el.value : '');
        }
    localStorage.setItem(PU_GRID_KEY, JSON.stringify(vals));
}

function _restoreGrid() {
    const stored = localStorage.getItem(PU_GRID_KEY);
    if (!stored) return;
    try {
        const vals = JSON.parse(stored);
        let i = 0;
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                const el = document.getElementById(`pu-cell-${r}-${c}`);
                if (el && vals[i] !== undefined) el.value = vals[i];
                i++;
            }
            _updateRowSum(r);
        }
        _updateStats();
    } catch {}
}

function _updateRowSum(rowIdx) {
    let total = 0, hasInput = false;
    for (let c = 0; c < COLS; c++) {
        const el = document.getElementById(`pu-cell-${rowIdx}-${c}`);
        if (el && el.value !== '') { total += parseInt(el.value) || 0; hasInput = true; }
    }
    const el = document.getElementById(`pu-row-sum-${rowIdx}`);
    if (!el) return;
    if (hasInput && total > 0) { el.textContent = total; el.classList.add('has-value'); }
    else                       { el.textContent = '—';   el.classList.remove('has-value'); }
}

function _getGridData() {
    const rows = [];
    for (let r = 0; r < ROWS; r++) {
        const row = [];
        for (let c = 0; c < COLS; c++) {
            const el = document.getElementById(`pu-cell-${r}-${c}`);
            if (!el) continue;
            const num = parseInt(el.value);
            if (!isNaN(num) && el.value !== '') row.push(num);
        }
        if (row.length) rows.push(row);
    }
    return rows;
}

function _updateStats() {
    const data = _getGridData();
    let total = 0, setCount = 0, maxReps = 0, minReps = Infinity;
    data.forEach(row => row.forEach(rep => {
        total += rep; setCount++;
        if (rep > maxReps) maxReps = rep;
        if (rep < minReps) minReps = rep;
    }));
    const avg = setCount > 0 ? (total / setCount).toFixed(1) : 0;
    const $ = id => document.getElementById(id);
    if ($('pu-stat-total'))   $('pu-stat-total').textContent  = total;
    if ($('pu-stat-sets'))    $('pu-stat-sets').textContent   = setCount;
    if ($('pu-stat-avg'))     $('pu-stat-avg').textContent    = avg;
    if ($('pu-stat-max'))     $('pu-stat-max').textContent    = maxReps > 0 ? maxReps : 0;
    if ($('pu-stat-dropoff')) {
        const el = $('pu-stat-dropoff');
        if (setCount >= 2) {
            const drop = maxReps - minReps;
            el.textContent = `−${drop}`;
            el.style.color = drop > 3 ? 'var(--coral)' : '#22c55e';
        } else {
            el.textContent = '—';
            el.style.color = '';
        }
    }
}

function _clearGrid() {
    document.querySelectorAll('.pu-cell').forEach(i => i.value = '');
    for (let r = 0; r < ROWS; r++) {
        const el = document.getElementById(`pu-row-sum-${r}`);
        if (el) { el.textContent = '—'; el.classList.remove('has-value'); }
    }
    _updateStats();
    _saveGrid();
}

function _exitEditMode() {
    _editingId = null;
    const logBtn = document.getElementById('pu-log-btn');
    if (logBtn) logBtn.textContent = '✓ Log Workout';
    const cancelBtn = document.getElementById('pu-edit-cancel-btn');
    if (cancelBtn) cancelBtn.style.display = 'none';
    _renderHistory();
}

function _logWorkout() {
    const gridData = _getGridData();
    if (!gridData.length) return;

    const now     = new Date();
    const date    = now.toISOString().slice(0, 10);
    const time    = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const allSets = gridData.flat();
    const total   = allSets.reduce((a, b) => a + b, 0);
    const max     = Math.max(...allSets);

    if (_editingId) {
        const idx = _puState.history.findIndex(h => h.id === _editingId);
        if (idx >= 0) {
            _puState.history[idx] = {
                ..._puState.history[idx],
                rows: gridData, total, max, sets: allSets.length,
            };
        }
        _save();
        _exitEditMode();
        _clearGrid();
        return;
    }

    const entryId = `pu-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    _puState.history.unshift({ id: entryId, date, time, rows: gridData, total, max, sets: allSets.length });
    _save();

    if (_puOnLog) {
        _puOnLog({
            id:           entryId,
            date,
            muscleGroup:  'Chest',
            exercise:     'Push-Ups',
            weight:       0,
            sets:         allSets.length,
            reps:         max,
            volume:       total,
            isBodyweight: true,
            rpe:          null,
            notes:        `Push-up session: ${total} reps across ${gridData.length} round${gridData.length > 1 ? 's' : ''}`,
        });
    }

    _renderHistory();
    _clearGrid();
}

function _editSession(id) {
    const entry = _puState.history.find(h => h.id === id);
    if (!entry || !entry.rows) return;

    _editingId = id;

    // Clear then fill grid with session data
    document.querySelectorAll('.pu-cell').forEach(i => i.value = '');
    for (let r = 0; r < ROWS; r++) {
        const el = document.getElementById(`pu-row-sum-${r}`);
        if (el) { el.textContent = '—'; el.classList.remove('has-value'); }
    }

    entry.rows.forEach((row, r) => {
        if (r >= ROWS) return;
        row.forEach((val, c) => {
            if (c >= COLS) return;
            const el = document.getElementById(`pu-cell-${r}-${c}`);
            if (el) el.value = val;
        });
        _updateRowSum(r);
    });
    _updateStats();
    _saveGrid();

    const logBtn = document.getElementById('pu-log-btn');
    if (logBtn) logBtn.textContent = '✓ Update Session';

    const cancelBtn = document.getElementById('pu-edit-cancel-btn');
    if (cancelBtn) cancelBtn.style.display = '';

    // Expand module if collapsed
    const body = document.getElementById('pu-body');
    const icon = document.getElementById('pu-toggle-icon');
    if (body && body.classList.contains('wkmod-collapsed')) {
        body.classList.remove('wkmod-collapsed');
        if (icon) icon.textContent = '▾';
    }

    document.getElementById('pu-grid')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    _renderHistory();
}

function _deleteSession(id) {
    if (!confirm('Delete this push-up session?')) return;
    _puState.history = _puState.history.filter(h => h.id !== id);
    _save();
    if (_puOnDelete) _puOnDelete(id);
    if (_editingId === id) _exitEditMode();
    _renderHistory();
}

function _renderHistory() {
    const el = document.getElementById('pu-history');
    if (!el) return;
    const recent = _puState.history.slice(0, 5);
    if (!recent.length) {
        el.innerHTML = '<div class="wkmod-empty">No sessions logged yet.</div>';
        return;
    }
    el.innerHTML = recent.map(item => `
        <div class="wkmod-hist-row${item.id === _editingId ? ' wkmod-hist-row--editing' : ''}">
            <span class="wkmod-hist-date">${item.date}</span>
            <span class="wkmod-hist-sets">${item.sets} sets · max ${item.max}</span>
            <span class="wkmod-hist-total">${item.total} reps</span>
            <div class="wkmod-hist-actions">
                <button class="wkmod-hist-btn wkmod-hist-btn--edit" data-id="${item.id}" title="Edit session">✎</button>
                <button class="wkmod-hist-btn wkmod-hist-btn--del" data-id="${item.id}" title="Delete session">✕</button>
            </div>
        </div>
    `).join('');

    el.querySelectorAll('.wkmod-hist-btn--edit').forEach(btn => {
        btn.addEventListener('click', () => _editSession(btn.dataset.id));
    });
    el.querySelectorAll('.wkmod-hist-btn--del').forEach(btn => {
        btn.addEventListener('click', () => _deleteSession(btn.dataset.id));
    });
}

function _renderGrid() {
    const container = document.getElementById('pu-grid');
    if (!container) return;

    let html = '<div class="wkmod-grid-header">';
    html += '<div class="wkmod-grid-num"></div>';
    for (let c = 0; c < COLS; c++) html += `<div class="wkmod-grid-col-label">S${c + 1}</div>`;
    html += '<div class="wkmod-grid-col-label">SUM</div></div>';

    for (let r = 0; r < ROWS; r++) {
        html += `<div class="wkmod-grid-row"><span class="wkmod-grid-num">R${r + 1}</span>`;
        for (let c = 0; c < COLS; c++) {
            html += `<input type="number" min="0" placeholder="·" class="wkmod-grid-input pu-cell" id="pu-cell-${r}-${c}" data-row="${r}" data-col="${c}">`;
        }
        html += `<div class="wkmod-grid-sum" id="pu-row-sum-${r}">—</div></div>`;
    }
    container.innerHTML = html;

    container.querySelectorAll('.pu-cell').forEach(inp => {
        inp.addEventListener('input', () => {
            _updateRowSum(parseInt(inp.dataset.row));
            _updateStats();
            _saveGrid();
        });
    });
}

export function initPushUp(onLog, onDelete) {
    _puOnLog    = onLog;
    _puOnDelete = onDelete ?? null;
    _load();
    _renderGrid();
    _restoreGrid();
    _renderHistory();

    document.getElementById('pu-log-btn')?.addEventListener('click', _logWorkout);
    document.getElementById('pu-clear-btn')?.addEventListener('click', () => {
        if (confirm('Clear push-up grid?')) _clearGrid();
    });

    const cancelBtn = document.getElementById('pu-edit-cancel-btn');
    if (cancelBtn) {
        cancelBtn.style.display = 'none';
        cancelBtn.addEventListener('click', () => { _exitEditMode(); _clearGrid(); });
    }

    document.getElementById('pu-toggle')?.addEventListener('click', () => {
        const body = document.getElementById('pu-body');
        const icon = document.getElementById('pu-toggle-icon');
        if (!body) return;
        const collapsed = body.classList.toggle('wkmod-collapsed');
        if (icon) icon.textContent = collapsed ? '▸' : '▾';
    });
}
