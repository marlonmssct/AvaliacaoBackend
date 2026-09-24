import {
  Controller,
  Get,
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
import { TicketsService } from './tickets.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';

@ApiTags('Ingressos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Get('my-tickets')
  @ApiOperation({ summary: 'Listar todos os ingressos do usuário logado' })
  @ApiResponse({ status: 200, description: 'Lista de ingressos' })
  findMyTickets(@CurrentUser() user: CurrentUserPayload) {
    return this.ticketsService.findMyTickets(user.id);
  }

  @Get('code/:code')
  @ApiOperation({ summary: 'Consultar ingresso pelo código alfanumérico / QR Code' })
  @ApiParam({ name: 'code', description: 'Código do ingresso (ex: TKT-1A2B3C)' })
  @ApiResponse({ status: 200, description: 'Dados do ingresso' })
  @ApiResponse({ status: 403, description: 'Sem permissão' })
  @ApiResponse({ status: 404, description: 'Ingresso não encontrado' })
  findByCode(
    @Param('code') code: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.ticketsService.findByCode(code, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obter dados detalhados de um ingresso por ID' })
  @ApiParam({ name: 'id', description: 'ID numérico do ingresso' })
  @ApiResponse({ status: 200, description: 'Detalhes do ingresso' })
  @ApiResponse({ status: 403, description: 'Sem permissão' })
  @ApiResponse({ status: 404, description: 'Ingresso não encontrado' })
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.ticketsService.findById(id, user);
  }
}
