import { createCabinetStore } from '../shared/store';
import { executeTeacher } from './logic';
import { createTeacherSeed } from './seed';

const store = createCabinetStore(() => createTeacherSeed(), executeTeacher);

export const TeacherStoreProvider = store.Provider;
export const useTeacher = store.useStore;
