import { Client, Account, Databases, ID, Query, Permission, Role }
    from 'https://esm.sh/appwrite@16';

export const DATABASE_ID        = 'titan-db';
export const WORKOUTS_COL       = 'workouts';
export const CARDIO_COL         = 'cardio';
export const PLANS_COL          = 'plans';
export const WORKOUT_STATE_COL  = 'workout_state';
export const MEASUREMENTS_COL   = 'measurements';

export const client = new Client()
    .setEndpoint('https://sfo.cloud.appwrite.io/v1')
    .setProject('69f6a18a002152c7442a');

export const account   = new Account(client);
export const databases = new Databases(client);
export { ID, Query, Permission, Role };
