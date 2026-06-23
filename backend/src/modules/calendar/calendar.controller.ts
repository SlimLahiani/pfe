import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CalendarService } from './calendar.service';
import { CreateCalendarEventDto } from './dto/create-calendar-event.dto';
import { UpdateCalendarEventDto } from './dto/update-calendar-event.dto';
import { QueryCalendarEventsDto } from './dto/query-calendar-events.dto';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../core/guards/permissions.guard';
import { RequirePermissions } from '../../core/decorators/permissions.decorator';
import { CurrentUser } from '../../core/decorators/current-user.decorator';

@Controller('calendar')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  @Get('events')
  @RequirePermissions('calendar:read')
  findAll(@Query() query: QueryCalendarEventsDto) {
    return this.calendarService.findAll(query);
  }

  @Get('events/my')
  @RequirePermissions('calendar:read')
  findMyEvents(@CurrentUser() user: any, @Query() query: QueryCalendarEventsDto) {
    return this.calendarService.findAll({ ...query, userId: user.id });
  }

  @Get('events/:id')
  @RequirePermissions('calendar:read')
  findOne(@Param('id') id: string) {
    return this.calendarService.findOne(id);
  }

  @Post('events')
  @RequirePermissions('calendar:write')
  create(@Body() dto: CreateCalendarEventDto, @CurrentUser() user: any) {
    return this.calendarService.create(dto, user.id);
  }

  @Patch('events/:id')
  @RequirePermissions('calendar:write')
  update(@Param('id') id: string, @Body() dto: UpdateCalendarEventDto) {
    return this.calendarService.update(id, dto);
  }

  @Delete('events/:id')
  @RequirePermissions('calendar:write')
  delete(@Param('id') id: string) {
    return this.calendarService.delete(id);
  }

  @Patch('events/:id/restore')
  @RequirePermissions('calendar:write')
  restore(@Param('id') id: string) {
    return this.calendarService.restore(id);
  }

  @Patch('events/:id/respond')
  @RequirePermissions('calendar:write')
  respond(
    @Param('id') id: string,
    @Body('accepted') accepted: boolean,
    @CurrentUser() user: any,
  ) {
    return this.calendarService.respondToEvent(id, user.id, accepted);
  }

  @Post('events/:id/attendees')
  @RequirePermissions('calendar:write')
  inviteAttendee(
    @Param('id') id: string,
    @Body('userId') userId: string,
  ) {
    return this.calendarService.inviteAttendee(id, userId);
  }

  @Delete('events/:id/attendees/:userId')
  @RequirePermissions('calendar:write')
  removeAttendee(
    @Param('id') id: string,
    @Param('userId') userId: string,
  ) {
    return this.calendarService.removeAttendee(id, userId);
  }
}
