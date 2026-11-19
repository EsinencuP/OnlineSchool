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
import { TeacherMeetOAuthController } from './teacher-meet-oauth.controller.js';
import { TeacherMeetOAuthService } from './teacher-meet-oauth.service.js';
import { TeacherMeetOperationsController } from './teacher-meet-operations.controller.js';
import { TeacherMeetOperationsService } from './teacher-meet-operations.service.js';

@Module({
  imports: [CoreModule, StorageModule],
  controllers: [
    TeacherMeetOAuthController,
    TeacherMeetOperationsController,
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
    TeacherMeetOAuthService,
    TeacherMeetOperationsService,
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
