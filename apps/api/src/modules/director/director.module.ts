import { Module } from '@nestjs/common';
import { CoreModule } from '../../core/core.module.js';
import { FinanceInfrastructureModule } from '../finance/finance-infrastructure.module.js';
import { DirectorRefundsController } from '../finance/refunds/refunds.controller.js';
import { DirectorSaleConditionsController } from './director-sale-conditions.controller.js';
import { DirectorSaleConditionsService } from './director-sale-conditions.service.js';
import { DirectorMeetController } from './director-meet.controller.js';
import { FinanceModule } from '../finance/finance.module.js';
import { ScheduleInfrastructureModule } from '../schedule/schedule-infrastructure.module.js';
import { DirectorCommandsController } from './director-commands.controller.js';
import { DirectorCommandsService } from './director-commands.service.js';
import { DirectorDecisionsService } from './director-decisions.service.js';
import { DirectorEscalationsController } from './director-escalations.controller.js';
import { DirectorEscalationsService } from './director-escalations.service.js';
import { DirectorLessonDisputeController } from './director-lesson-dispute.controller.js';
import { DirectorLessonDisputeService } from './director-lesson-dispute.service.js';
import { DirectorPayrollController } from './director-payroll.controller.js';
import { DirectorPayrollService } from './director-payroll.service.js';
import { DirectorStaffController } from './director-staff.controller.js';
import { DirectorStaffService } from './director-staff.service.js';
import { DirectorController } from './director.controller.js';
import { DirectorService } from './director.service.js';
import { DirectorContextGuard } from './guards/director-context.guard.js';

@Module({
  imports: [CoreModule, FinanceModule, FinanceInfrastructureModule, ScheduleInfrastructureModule],
  controllers: [
    DirectorMeetController,
    DirectorSaleConditionsController,
    DirectorRefundsController,
    DirectorController,
    DirectorCommandsController,
    DirectorEscalationsController,
    DirectorStaffController,
    DirectorPayrollController,
    DirectorLessonDisputeController,
  ],
  providers: [
    DirectorSaleConditionsService,
    DirectorService,
    DirectorDecisionsService,
    DirectorEscalationsService,
    DirectorStaffService,
    DirectorPayrollService,
    DirectorCommandsService,
    DirectorLessonDisputeService,
    DirectorContextGuard,
  ],
})
export class DirectorModule {}
