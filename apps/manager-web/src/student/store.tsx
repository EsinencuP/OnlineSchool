import { createCabinetStore } from '../shared/store';
import { executeStudent } from './logic';
import { createStudentSeed } from './seed';

const store = createCabinetStore(() => createStudentSeed(), executeStudent);

export const StudentStoreProvider = store.Provider;
export const useStudent = store.useStore;
