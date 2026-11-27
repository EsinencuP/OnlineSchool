import { createCabinetStore } from '../shared/store';
import { execute } from './logic';
import { createDirectorSeed } from './seed';

const store = createCabinetStore(() => createDirectorSeed(), execute);

export const DirectorStoreProvider = store.Provider;
export const useDirector = store.useStore;
