import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { CheckInsService } from './check-ins.service';
import { CreateCheckInDto } from './dto/create-check-in.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';

@ApiTags('Controle de Entrada (Check-in)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('check-ins')
export class CheckInsController {
  constructor(private readonly checkInsService: CheckInsService) {}

  @Roles(Role.ORGANIZER, Role.ADMIN)
  @Post()
  @ApiOperation({ summary: 'Validar e realizar check-in de um ingresso (Apenas organizador ou ADMIN)' })
  @ApiResponse({ status: 201, description: 'Check-in realizado com sucesso' })
  @ApiResponse({ status: 403, description: 'Operador não tem permissão para gerenciar este evento' })
  @ApiResponse({ status: 404, description: 'Ingresso não encontrado' })
  @ApiResponse({ status: 409, description: 'Ingresso já utilizado anteriormente ou cancelado' })
  performCheckIn(
    @Body() createCheckInDto: CreateCheckInDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.checkInsService.performCheckIn(createCheckInDto, user);
  }

  @Roles(Role.ORGANIZER, Role.ADMIN)
  @Get('event/:eventId')
  @ApiOperation({ summary: 'Relatório de check-ins realizados no evento' })
  @ApiParam({ name: 'eventId', description: 'ID numérico do evento' })
  @ApiResponse({ status: 200, description: 'Histórico de check-ins do evento' })
  @ApiResponse({ status: 403, description: 'Acesso negado a evento de outro organizador' })
  getCheckInsByEvent(
    @Param('eventId', ParseIntPipe) eventId: number,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.checkInsService.getCheckInsByEvent(eventId, user);
  }
}
