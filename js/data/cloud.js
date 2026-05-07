import {
    client, account, databases,
    DATABASE_ID, WORKOUTS_COL, CARDIO_COL, PLANS_COL, WORKOUT_STATE_COL, MEASUREMENTS_COL,
    ID, Query, Permission, Role,
} from './appwrite.js';

let _userId = null;

export async function getUserId() {
    if (!_userId) {
        const user = await account.get();
        _userId = user.$id;
    }
    return _userId;
}

// Fetches all workouts for the current user, paginating automatically.
export async function fetchWorkouts() {
    const userId  = await getUserId();
    const results = [];
    let   cursor  = null;

    for (;;) {
        const queries = [
            Query.equal('userId', userId),
            Query.orderDesc('date'),
            Query.limit(100),
        ];
        if (cursor) queries.push(Query.cursorAfter(cursor));

        const res = await databases.listDocuments(DATABASE_ID, WORKOUTS_COL, queries);
        results.push(...res.documents.map(docToEntry));
        if (res.documents.length < 100) break;
        cursor = res.documents[res.documents.length - 1].$id;
    }

    return results;
}

export async function addWorkout(entry) {
    const userId = await getUserId();
    await databases.createDocument(
        DATABASE_ID,
        WORKOUTS_COL,
        ID.unique(),
        {
            userId,
            localId:      entry.id,
            date:         entry.date,
            muscleGroup:  entry.muscleGroup,
            exercise:     entry.exercise,
            weight:       entry.weight,
            sets:         entry.sets,
            reps:         entry.reps,
            volume:       entry.volume,
            isBodyweight: entry.isBodyweight,
            rpe:          entry.rpe   ?? null,
            notes:        entry.notes ?? '',
        },
        [
            Permission.read(Role.user(userId)),
            Permission.update(Role.user(userId)),
            Permission.delete(Role.user(userId)),
        ]
    );
}

export async function removeWorkout(localId) {
    const userId = await getUserId();
    const res = await databases.listDocuments(DATABASE_ID, WORKOUTS_COL, [
        Query.equal('userId',  userId),
        Query.equal('localId', localId),
        Query.limit(1),
    ]);
    if (res.documents.length > 0) {
        await databases.deleteDocument(DATABASE_ID, WORKOUTS_COL, res.documents[0].$id);
    }
}

export async function wipeAllWorkouts() {
    const userId = await getUserId();
    for (;;) {
        const res = await databases.listDocuments(DATABASE_ID, WORKOUTS_COL, [
            Query.equal('userId', userId),
            Query.limit(100),
        ]);
        if (res.documents.length === 0) break;
        await Promise.all(
            res.documents.map(d =>
                databases.deleteDocument(DATABASE_ID, WORKOUTS_COL, d.$id)
            )
        );
        if (res.documents.length < 100) break;
    }
}

// Returns an unsubscribe function. Fires onEvent('create'|'delete', entry)
// for documents belonging to userId arriving from other sessions.
export function subscribe(userId, onEvent) {
    return client.subscribe(
        `databases.${DATABASE_ID}.collections.${WORKOUTS_COL}.documents`,
        response => {
            const doc    = response.payload;
            const events = response.events;
            if (doc.userId !== userId) return;

            if (events.some(e => e.includes('.create'))) {
                onEvent('create', docToEntry(doc));
            } else if (events.some(e => e.includes('.delete'))) {
                onEvent('delete', docToEntry(doc));
            }
        }
    );
}

// ── Cardio ────────────────────────────────────────────────────────────────────

export async function fetchCardioSessions() {
    const userId  = await getUserId();
    const results = [];
    let   cursor  = null;

    for (;;) {
        const queries = [
            Query.equal('userId', userId),
            Query.orderDesc('date'),
            Query.limit(100),
        ];
        if (cursor) queries.push(Query.cursorAfter(cursor));

        const res = await databases.listDocuments(DATABASE_ID, CARDIO_COL, queries);
        results.push(...res.documents.map(cardioDocToEntry));
        if (res.documents.length < 100) break;
        cursor = res.documents[res.documents.length - 1].$id;
    }

    return results;
}

export async function addCardioSession(entry) {
    const userId = await getUserId();
    await databases.createDocument(
        DATABASE_ID,
        CARDIO_COL,
        ID.unique(),
        {
            userId,
            localId:  String(entry.id),
            date:     entry.date,
            activity: entry.activity,
            duration: Number(entry.duration  || 0),
            distance: Number(entry.distance  || 0),
            calories: Number(entry.calories  || 0),
        },
        [
            Permission.read(Role.user(userId)),
            Permission.update(Role.user(userId)),
            Permission.delete(Role.user(userId)),
        ]
    );
}

export async function removeCardioSession(localId) {
    const userId = await getUserId();
    const res = await databases.listDocuments(DATABASE_ID, CARDIO_COL, [
        Query.equal('userId',  userId),
        Query.equal('localId', String(localId)),
        Query.limit(1),
    ]);
    if (res.documents.length > 0) {
        await databases.deleteDocument(DATABASE_ID, CARDIO_COL, res.documents[0].$id);
    }
}

export async function wipeAllCardioSessions() {
    const userId = await getUserId();
    for (;;) {
        const res = await databases.listDocuments(DATABASE_ID, CARDIO_COL, [
            Query.equal('userId', userId),
            Query.limit(100),
        ]);
        if (res.documents.length === 0) break;
        await Promise.all(
            res.documents.map(d =>
                databases.deleteDocument(DATABASE_ID, CARDIO_COL, d.$id)
            )
        );
        if (res.documents.length < 100) break;
    }
}

export function subscribeCardio(userId, onEvent) {
    return client.subscribe(
        `databases.${DATABASE_ID}.collections.${CARDIO_COL}.documents`,
        response => {
            const doc    = response.payload;
            const events = response.events;
            if (doc.userId !== userId) return;

            if (events.some(e => e.includes('.create'))) {
                onEvent('create', cardioDocToEntry(doc));
            } else if (events.some(e => e.includes('.delete'))) {
                onEvent('delete', cardioDocToEntry(doc));
            }
        }
    );
}

function cardioDocToEntry(doc) {
    return {
        id:       Number(doc.localId) || doc.$id,
        date:     doc.date,
        activity: doc.activity,
        duration: doc.duration,
        distance: doc.distance,
        calories: doc.calories,
    };
}

// ── Plans ─────────────────────────────────────────────────────────────────────

export async function fetchPlans() {
    const userId  = await getUserId();
    const results = [];
    let   cursor  = null;

    for (;;) {
        const queries = [Query.equal('userId', userId), Query.limit(100)];
        if (cursor) queries.push(Query.cursorAfter(cursor));

        const res = await databases.listDocuments(DATABASE_ID, PLANS_COL, queries);
        results.push(...res.documents.map(d => JSON.parse(d.planData)));
        if (res.documents.length < 100) break;
        cursor = res.documents[res.documents.length - 1].$id;
    }

    return results;
}

export async function upsertPlan(plan) {
    const userId  = await getUserId();
    const localId = plan.workout;
    const res = await databases.listDocuments(DATABASE_ID, PLANS_COL, [
        Query.equal('userId',  userId),
        Query.equal('localId', localId),
        Query.limit(1),
    ]);
    const planData = JSON.stringify(plan);
    if (res.documents.length > 0) {
        await databases.updateDocument(DATABASE_ID, PLANS_COL, res.documents[0].$id, { planData });
    } else {
        await databases.createDocument(
            DATABASE_ID, PLANS_COL, ID.unique(),
            { userId, localId, planData },
            [
                Permission.read(Role.user(userId)),
                Permission.update(Role.user(userId)),
                Permission.delete(Role.user(userId)),
            ]
        );
    }
}

export async function deletePlan(workoutName) {
    const userId = await getUserId();
    const res = await databases.listDocuments(DATABASE_ID, PLANS_COL, [
        Query.equal('userId',  userId),
        Query.equal('localId', workoutName),
        Query.limit(1),
    ]);
    if (res.documents.length > 0) {
        await databases.deleteDocument(DATABASE_ID, PLANS_COL, res.documents[0].$id);
    }
}

export function subscribePlans(userId, onEvent) {
    return client.subscribe(
        `databases.${DATABASE_ID}.collections.${PLANS_COL}.documents`,
        response => {
            const doc    = response.payload;
            const events = response.events;
            if (doc.userId !== userId) return;

            if (events.some(e => e.includes('.create')) || events.some(e => e.includes('.update'))) {
                try { onEvent('upsert', JSON.parse(doc.planData)); } catch {}
            } else if (events.some(e => e.includes('.delete'))) {
                onEvent('delete', doc.localId);
            }
        }
    );
}

// ── Workout state ─────────────────────────────────────────────────────────────

export async function fetchWorkoutState() {
    const userId = await getUserId();
    const res = await databases.listDocuments(DATABASE_ID, WORKOUT_STATE_COL, [
        Query.equal('userId', userId),
        Query.limit(1),
    ]);
    if (res.documents.length === 0) return null;
    try { return JSON.parse(res.documents[0].state); } catch { return null; }
}

export async function saveWorkoutState(state) {
    const userId = await getUserId();
    const res = await databases.listDocuments(DATABASE_ID, WORKOUT_STATE_COL, [
        Query.equal('userId', userId),
        Query.limit(1),
    ]);
    const stateStr = JSON.stringify(state);
    if (res.documents.length > 0) {
        await databases.updateDocument(DATABASE_ID, WORKOUT_STATE_COL, res.documents[0].$id, { state: stateStr });
    } else {
        await databases.createDocument(
            DATABASE_ID, WORKOUT_STATE_COL, ID.unique(),
            { userId, state: stateStr },
            [
                Permission.read(Role.user(userId)),
                Permission.update(Role.user(userId)),
                Permission.delete(Role.user(userId)),
            ]
        );
    }
}

export async function clearWorkoutState() {
    const userId = await getUserId();
    const res = await databases.listDocuments(DATABASE_ID, WORKOUT_STATE_COL, [
        Query.equal('userId', userId),
        Query.limit(1),
    ]);
    // Upsert a null state so the realtime subscription fires on all connected devices
    if (res.documents.length > 0) {
        await databases.updateDocument(DATABASE_ID, WORKOUT_STATE_COL, res.documents[0].$id, { state: 'null' });
    } else {
        await databases.createDocument(
            DATABASE_ID, WORKOUT_STATE_COL, ID.unique(),
            { userId, state: 'null' },
            [
                Permission.read(Role.user(userId)),
                Permission.update(Role.user(userId)),
                Permission.delete(Role.user(userId)),
            ]
        );
    }
}

export function subscribeWorkoutState(userId, onEvent) {
    return client.subscribe(
        `databases.${DATABASE_ID}.collections.${WORKOUT_STATE_COL}.documents`,
        response => {
            const doc    = response.payload;
            const events = response.events;
            if (doc.userId !== userId) return;

            if (events.some(e => e.includes('.create')) || events.some(e => e.includes('.update'))) {
                try {
                    const s = JSON.parse(doc.state);
                    onEvent(s === null ? 'clear' : 'update', s);
                } catch {}
            } else if (events.some(e => e.includes('.delete'))) {
                onEvent('clear', null);
            }
        }
    );
}

// ── Measurements ──────────────────────────────────────────────────────────────

export async function fetchMeasurements() {
    const userId  = await getUserId();
    const results = [];
    let   cursor  = null;

    for (;;) {
        const queries = [
            Query.equal('userId', userId),
            Query.orderDesc('date'),
            Query.limit(100),
        ];
        if (cursor) queries.push(Query.cursorAfter(cursor));

        const res = await databases.listDocuments(DATABASE_ID, MEASUREMENTS_COL, queries);
        results.push(...res.documents.map(measDocToEntry));
        if (res.documents.length < 100) break;
        cursor = res.documents[res.documents.length - 1].$id;
    }

    return results;
}

export async function addMeasurement(entry) {
    const userId = await getUserId();
    await databases.createDocument(
        DATABASE_ID,
        MEASUREMENTS_COL,
        ID.unique(),
        {
            userId,
            localId: String(entry.id),
            date:    entry.date,
            bodyfat: entry.bodyfat ?? null,
            chest:   entry.chest   ?? null,
            waist:   entry.waist   ?? null,
            biceps:  entry.biceps  ?? null,
            thighs:  entry.thighs  ?? null,
            notes:   entry.notes   ?? '',
        },
        [
            Permission.read(Role.user(userId)),
            Permission.update(Role.user(userId)),
            Permission.delete(Role.user(userId)),
        ]
    );
}

export async function removeMeasurement(localId) {
    const userId = await getUserId();
    const res = await databases.listDocuments(DATABASE_ID, MEASUREMENTS_COL, [
        Query.equal('userId',  userId),
        Query.equal('localId', String(localId)),
        Query.limit(1),
    ]);
    if (res.documents.length > 0) {
        await databases.deleteDocument(DATABASE_ID, MEASUREMENTS_COL, res.documents[0].$id);
    }
}

export async function wipeAllMeasurements() {
    const userId = await getUserId();
    for (;;) {
        const res = await databases.listDocuments(DATABASE_ID, MEASUREMENTS_COL, [
            Query.equal('userId', userId),
            Query.limit(100),
        ]);
        if (res.documents.length === 0) break;
        await Promise.all(
            res.documents.map(d =>
                databases.deleteDocument(DATABASE_ID, MEASUREMENTS_COL, d.$id)
            )
        );
        if (res.documents.length < 100) break;
    }
}

function measDocToEntry(doc) {
    return {
        id:      Number(doc.localId) || doc.$id,
        date:    doc.date,
        bodyfat: doc.bodyfat,
        chest:   doc.chest,
        waist:   doc.waist,
        biceps:  doc.biceps,
        thighs:  doc.thighs,
        notes:   doc.notes ?? '',
    };
}

function docToEntry(doc) {
    return {
        id:           doc.localId || doc.$id,
        date:         doc.date,
        muscleGroup:  doc.muscleGroup,
        exercise:     doc.exercise,
        weight:       doc.weight,
        sets:         doc.sets,
        reps:         doc.reps,
        volume:       doc.volume,
        isBodyweight: doc.isBodyweight,
        rpe:          doc.rpe,
        notes:        doc.notes,
    };
}
