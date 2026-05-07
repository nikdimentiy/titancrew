const KEY        = 'titanCrewData';
const LEGACY_KEY = 'titanWorkoutData';

// One-time migration from old key
if (localStorage.getItem(LEGACY_KEY) !== null && localStorage.getItem(KEY) === null) {
    localStorage.setItem(KEY, localStorage.getItem(LEGACY_KEY));
    localStorage.removeItem(LEGACY_KEY);
}

export const storage = {
    load() {
        try {
            return JSON.parse(localStorage.getItem(KEY)) || [];
        } catch {
            return [];
        }
    },
    save(data) {
        try {
            localStorage.setItem(KEY, JSON.stringify(data));
        } catch (e) {
            if (e.name === 'QuotaExceededError') {
                alert('Storage is full. Export your data and clear some entries to free space.');
            }
        }
    },
    clear() {
        localStorage.removeItem(KEY);
    },
};
