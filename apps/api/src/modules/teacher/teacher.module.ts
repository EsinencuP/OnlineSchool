import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module.js';
import { CoreModule } from '../../core/core.module.js';
import { TeacherContextGuard } from './guards/teacher-context.guard.js';
import { TeacherController } from './teacher.controller.js';
import { TeacherAvailabilityService } from './teacher-availability.service.js';
import { TeacherJournalService } from './teacher-journal.service.js';
import { TeacherHomeworkController } from './teacher-homework.controller.js';
import { TeacherHomeworkService } from './teacher-homework.service.js';
import { TeacherCheckpointsController } from './teacher-checkpoints.controller.js';
import { TeacherCheckpointsService } from './teacher-checkpoints.service.js';
import { TeacherGoalsController } from './teacher-goals.controller.js';
import { TeacherGoalsService } from './teacher-goals.service.js';
import { TeacherMaterialsController } from './teacher-materials.controller.js';
import { TeacherMaterialsService } from './teacher-materials.service.js';
import { TeacherProfileController } from './teacher-profile.controller.js';
import { TeacherProfileService } from './teacher-profile.service.js';
import { TeacherNotificationsController } from './teacher-notifications.controller.js';
import { TeacherNotificationsService } from './teacher-notifications.service.js';
import { TeacherPayrollController } from './teacher-payroll.controller.js';
import { TeacherPayrollService } from './teacher-payroll.service.js';
import { TeacherSkillsController } from './teacher-skills.controller.js';
import { TeacherSkillsService } from './teacher-skills.service.js';
import { TeacherService } from './teacher.service.js';

@Module({
  imports: [CoreModule, StorageModule],
  controllers: [
    TeacherController,
    TeacherHomeworkController,
    TeacherSkillsController,
    TeacherCheckpointsController,
    TeacherGoalsController,
    TeacherPayrollController,
    TeacherNotificationsController,
    TeacherMaterialsController,
    TeacherProfileController,
  ],
  providers: [
    TeacherService,
    TeacherJournalService,
    TeacherAvailabilityService,
    TeacherHomeworkService,
    TeacherSkillsService,
    TeacherCheckpointsService,
    TeacherGoalsService,
    TeacherPayrollService,
    TeacherNotificationsService,
    TeacherMaterialsService,
    TeacherProfileService,
    TeacherContextGuard,
  ],
})
export class TeacherModule {}
