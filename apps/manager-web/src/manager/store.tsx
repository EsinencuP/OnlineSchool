import { createCabinetStore } from '../shared/store';
import { execute } from './logic';
import { createSeed } from './seed';

const store = createCabinetStore(() => createSeed(), execute);

export const ManagerStoreProvider = store.Provider;
export const useManager = store.useStore;
