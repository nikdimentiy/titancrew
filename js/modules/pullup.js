const PL_DATA_KEY = 'titan_pullup_data';
const PL_BW_KEY   = 'titan_pullup_bw';

let _plOnLog    = null;
let _plOnDelete = null;
let _plCloud    = null;
let _plData     = [];
let _editingId  = null;

export function setPullUpCloud(c) { _plCloud = c; }

export function syncPullUpFromCloud(history) {
    _plData = history;
    localStorage.setItem(PL_DATA_KEY, JSON.stringify(_plData));
    _updatePath();
    _renderHistory();
}

function _load() {
    try { _plData = JSON.parse(localStorage.getItem(PL_DATA_KEY)) || []; }
    catch { _plData = []; }
}

function _save() {
    localStorage.setItem(PL_DATA_KEY, JSON.stringify(_plData));
    if (_plCloud) _plCloud.savePullUpHistory(_plData).catch(() => {});
}

function _computeVolume(w) {
    return w.setsData.reduce((sum, reps) => sum + reps * (w.bodyweight + (w.weight || 0)), 0);
}

function _getSetValues() {
    return Array.from(document.querySelectorAll('.pl-rep-input'))
        .map(i => parseInt(i.value) || 0)
        .filter(r => r > 0);
}

function _updateSetLabels() {
    document.querySelectorAll('.pl-set-label').forEach((lbl, idx) => {
        lbl.textContent = `Set ${idx + 1}`;
    });
}

function _makeSetBlock(initialValue) {
    const div = document.createElement('div');
    div.className = 'wkmod-set-block';
    div.innerHTML = `
        <span class="wkmod-set-label pl-set-label">Set X</span>
        <input type="number" min="1" value="${initialValue ?? 5}" class="wkmod-set-input pl-rep-input">
        <button type="button" class="wkmod-set-del" title="Remove set">✕</button>
    `;
    div.querySelector('.wkmod-set-del').addEventListener('click', () => {
        const container = document.getElementById('pl-sets-container');
        if (container && container.querySelectorAll('.wkmod-set-block').length > 1) {
            div.remove();
            _updateSetLabels();
        }
    });
    return div;
}

function _addSet(value) {
    const container = document.getElementById('pl-sets-container');
    if (!container) return;
    container.appendChild(_makeSetBlock(value));
    _updateSetLabels();
    container.scrollTop = container.scrollHeight;
}

function _resetSets() {
    const container = document.getElementById('pl-sets-container');
    if (!container) return;
    container.innerHTML = '';
    container.appendChild(_makeSetBlock());
    _updateSetLabels();
}

function _updatePath() {
    const fill   = document.getElementById('pl-path-fill');
    const maxEl  = document.getElementById('pl-max-reps');
    const status = document.getElementById('pl-path-status');

    if (!_plData.length) {
        if (fill)   fill.style.width = '0%';
        if (maxEl)  maxEl.textContent = '0';
        if (status) status.textContent = 'BEGINNER';
        return;
    }

    const maxReps = Math.max(..._plData.map(w => Math.max(...(w.setsData || [0]))));
    if (fill)   fill.style.width = `${Math.min((maxReps / 25) * 100, 100)}%`;
    if (maxEl)  maxEl.textContent = maxReps;
    if (status) {
        if (maxReps >= 25)      status.textContent = 'ELITE';
        else if (maxReps >= 15) status.textContent = 'ADVANCED';
        else if (maxReps >= 8)  status.textContent = 'INTERMEDIATE';
        else                    status.textContent = 'BEGINNER';
    }
}

function _exitEditMode() {
    _editingId = null;
    const logBtn = document.getElementById('pl-log-btn');
    if (logBtn) logBtn.textContent = '✓ Log Session';
    const cancelBtn = document.getElementById('pl-edit-cancel-btn');
    if (cancelBtn) cancelBtn.style.display = 'none';
    _renderHistory();
}

function _logSession() {
    const setsArray = _getSetValues();
    if (!setsArray.length) return;

    const typeEl   = document.getElementById('pl-type');
    const weightEl = document.getElementById('pl-weight');
    const bwEl     = document.getElementById('pl-bodyweight');
    const notesEl  = document.getElementById('pl-notes');

    if (_editingId) {
        const idx = _plData.findIndex(w => w.id === _editingId);
        if (idx >= 0) {
            const updated = {
                ..._plData[idx],
                type:       typeEl?.value  || 'Standard',
                setsData:   setsArray,
                weight:     parseFloat(weightEl?.value) || 0,
                bodyweight: parseFloat(bwEl?.value)     || 170,
                notes:      notesEl?.value.trim()        || '',
            };
            updated.volume = _computeVolume(updated);
            _plData[idx] = updated;
        }
        _save();
        _updatePath();
        if (bwEl) localStorage.setItem(PL_BW_KEY, bwEl.value);
        _exitEditMode();
        _resetSets();
        if (weightEl) weightEl.value = '0';
        if (notesEl)  notesEl.value  = '';
        return;
    }

    const entryId = `pl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const entry = {
        id:         entryId,
        date:       new Date().toISOString().slice(0, 10),
        type:       typeEl?.value  || 'Standard',
        setsData:   setsArray,
        weight:     parseFloat(weightEl?.value) || 0,
        bodyweight: parseFloat(bwEl?.value)     || 170,
        notes:      notesEl?.value.trim()        || '',
        volume:     0,
    };
    entry.volume = _computeVolume(entry);

    _plData.unshift(entry);
    _save();

    if (_plOnLog) {
        _plOnLog({
            id:           entryId,
            date:         entry.date,
            muscleGroup:  'Back',
            exercise:     `Pull-Ups (${entry.type})`,
            weight:       entry.weight,
            sets:         setsArray.length,
            reps:         Math.max(...setsArray),
            volume:       Math.round(entry.volume),
            isBodyweight: entry.weight === 0,
            rpe:          null,
            notes:        entry.notes || `${entry.type}: ${setsArray.join(' · ')} reps`,
        });
    }

    if (bwEl)     localStorage.setItem(PL_BW_KEY, bwEl.value);
    if (weightEl) weightEl.value = '0';
    if (notesEl)  notesEl.value  = '';
    _resetSets();
    _updatePath();
    _renderHistory();
}

function _editSession(id) {
    const entry = _plData.find(w => w.id === id);
    if (!entry) return;

    _editingId = id;

    // Fill form inputs
    const typeEl   = document.getElementById('pl-type');
    const weightEl = document.getElementById('pl-weight');
    const bwEl     = document.getElementById('pl-bodyweight');
    const notesEl  = document.getElementById('pl-notes');

    if (typeEl)   typeEl.value   = entry.type       || 'Standard';
    if (weightEl) weightEl.value = entry.weight      ?? 0;
    if (bwEl)     bwEl.value     = entry.bodyweight  ?? 170;
    if (notesEl)  notesEl.value  = entry.notes       || '';

    // Rebuild sets
    const container = document.getElementById('pl-sets-container');
    if (container) {
        container.innerHTML = '';
        (entry.setsData || [5]).forEach(val => container.appendChild(_makeSetBlock(val)));
        _updateSetLabels();
    }

    const logBtn = document.getElementById('pl-log-btn');
    if (logBtn) logBtn.textContent = '✓ Update Session';

    const cancelBtn = document.getElementById('pl-edit-cancel-btn');
    if (cancelBtn) cancelBtn.style.display = '';

    // Expand module if collapsed
    const body = document.getElementById('pl-body');
    const icon = document.getElementById('pl-toggle-icon');
    if (body && body.classList.contains('wkmod-collapsed')) {
        body.classList.remove('wkmod-collapsed');
        if (icon) icon.textContent = '▾';
    }

    document.getElementById('pl-sets-container')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    _renderHistory();
}

function _deleteSession(id) {
    if (!confirm('Delete this pull-up session?')) return;
    _plData = _plData.filter(w => w.id !== id);
    _save();
    if (_plOnDelete) _plOnDelete(id);
    if (_editingId === id) _exitEditMode();
    _updatePath();
    _renderHistory();
}

function _renderHistory() {
    const el = document.getElementById('pl-history');
    if (!el) return;
    const recent = _plData.slice(0, 5);
    if (!recent.length) {
        el.innerHTML = '<div class="wkmod-empty">No sessions logged yet.</div>';
        return;
    }
    el.innerHTML = recent.map(w => `
        <div class="wkmod-hist-row${w.id === _editingId ? ' wkmod-hist-row--editing' : ''}">
            <span class="wkmod-hist-date">${w.date}</span>
            <span class="wkmod-hist-sets">${w.type} · ${w.setsData.join('-')}</span>
            <span class="wkmod-hist-total pl-hist-vol">${Math.round(w.volume).toLocaleString()} vol</span>
            <div class="wkmod-hist-actions">
                <button class="wkmod-hist-btn wkmod-hist-btn--edit" data-id="${w.id}" title="Edit session">✎</button>
                <button class="wkmod-hist-btn wkmod-hist-btn--del" data-id="${w.id}" title="Delete session">✕</button>
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

export function initPullUp(onLog, onDelete) {
    _plOnLog    = onLog;
    _plOnDelete = onDelete ?? null;
    _load();

    const bwEl  = document.getElementById('pl-bodyweight');
    const saved = localStorage.getItem(PL_BW_KEY);
    if (bwEl && saved) bwEl.value = saved;

    // Wire the initial static set block's delete button
    const container = document.getElementById('pl-sets-container');
    container?.querySelector('.wkmod-set-del')?.addEventListener('click', () => {
        if (container.querySelectorAll('.wkmod-set-block').length > 1) {
            container.querySelector('.wkmod-set-block').remove();
            _updateSetLabels();
        }
    });

    document.getElementById('pl-add-set-btn')?.addEventListener('click', () => _addSet());
    document.getElementById('pl-log-btn')?.addEventListener('click', _logSession);

    const cancelBtn = document.getElementById('pl-edit-cancel-btn');
    if (cancelBtn) {
        cancelBtn.style.display = 'none';
        cancelBtn.addEventListener('click', () => {
            _exitEditMode();
            _resetSets();
            const weightEl = document.getElementById('pl-weight');
            const notesEl  = document.getElementById('pl-notes');
            if (weightEl) weightEl.value = '0';
            if (notesEl)  notesEl.value  = '';
        });
    }

    document.getElementById('pl-toggle')?.addEventListener('click', () => {
        const body = document.getElementById('pl-body');
        const icon = document.getElementById('pl-toggle-icon');
        if (!body) return;
        const collapsed = body.classList.toggle('wkmod-collapsed');
        if (icon) icon.textContent = collapsed ? '▸' : '▾';
    });

    _updatePath();
    _renderHistory();
}
