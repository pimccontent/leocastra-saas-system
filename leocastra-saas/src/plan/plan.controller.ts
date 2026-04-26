import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { PlanService } from './plan.service';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';

@Controller('plans')
export class PlanController {
  constructor(private readonly planService: PlanService) {}

  @Post()
  create(@Body() dto: CreatePlanDto, @CurrentUser() currentUser: CurrentUserPayload) {
    return this.planService.create(dto, currentUser.userId);
  }

  @Get()
  findAll() {
    return this.planService.findAll();
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePlanDto,
    @CurrentUser() currentUser: CurrentUserPayload,
  ) {
    return this.planService.update(id, dto, currentUser.userId);
  }
}
