import { Module } from '@nestjs/common';
import { CoreModule } from '../../core/core.module.js';
import { FinanceInfrastructureModule } from '../finance/finance-infrastructure.module.js';
import { ScheduleInfrastructureModule } from '../schedule/schedule-infrastructure.module.js';
import { DirectorCommandsController } from './director-commands.controller.js';
import { DirectorCommandsService } from './director-commands.service.js';
import { DirectorDecisionsService } from './director-decisions.service.js';
import { DirectorEscalationsController } from './director-escalations.controller.js';
import { DirectorEscalationsService } from './director-escalations.service.js';
import { DirectorPayrollController } from './director-payroll.controller.js';
import { DirectorPayrollService } from './director-payroll.service.js';
import { DirectorStaffController } from './director-staff.controller.js';
import { DirectorStaffService } from './director-staff.service.js';
import { DirectorController } from './director.controller.js';
import { DirectorService } from './director.service.js';
import { DirectorContextGuard } from './guards/director-context.guard.js';

@Module({
  imports: [CoreModule, FinanceInfrastructureModule, ScheduleInfrastructureModule],
  controllers: [
    DirectorController,
    DirectorCommandsController,
    DirectorEscalationsController,
    DirectorStaffController,
    DirectorPayrollController,
  ],
  providers: [
    DirectorService,
    DirectorDecisionsService,
    DirectorEscalationsService,
    DirectorStaffService,
    DirectorPayrollService,
    DirectorCommandsService,
    DirectorContextGuard,
  ],
})
export class DirectorModule {}
