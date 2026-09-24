import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
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
import { TicketBatchesService } from './ticket-batches.service';
import { CreateTicketBatchDto } from './dto/create-ticket-batch.dto';
import { UpdateTicketBatchDto } from './dto/update-ticket-batch.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Lotes de Ingressos')
@Controller('ticket-batches')
export class TicketBatchesController {
  constructor(private readonly ticketBatchesService: TicketBatchesService) {}

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ORGANIZER, Role.ADMIN)
  @Post()
  @ApiOperation({ summary: 'Criar novo lote de ingressos para um setor' })
  @ApiResponse({ status: 201, description: 'Lote criado com sucesso' })
  @ApiResponse({ status: 400, description: 'Datas ou valores inválidos' })
  @ApiResponse({ status: 403, description: 'Tentativa de criar lote em evento de terceiro' })
  @ApiResponse({ status: 409, description: 'Quantidade excede a capacidade do setor' })
  create(
    @Body() createTicketBatchDto: CreateTicketBatchDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.ticketBatchesService.create(createTicketBatchDto, user);
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('sector/:sectorId')
  @ApiOperation({ summary: 'Listar lotes de um setor' })
  @ApiParam({ name: 'sectorId', description: 'ID numérico do setor' })
  @ApiResponse({ status: 200, description: 'Lista de lotes' })
  findBySectorId(
    @Param('sectorId', ParseIntPipe) sectorId: number,
    @CurrentUser() user?: CurrentUserPayload,
  ) {
    return this.ticketBatchesService.findVisibleBySectorId(sectorId, user);
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id')
  @ApiOperation({ summary: 'Obter detalhes de um lote' })
  @ApiParam({ name: 'id', description: 'ID numérico do lote' })
  @ApiResponse({ status: 200, description: 'Detalhes do lote' })
  @ApiResponse({ status: 404, description: 'Lote não encontrado' })
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user?: CurrentUserPayload,
  ) {
    return this.ticketBatchesService.findVisibleById(id, user);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ORGANIZER, Role.ADMIN)
  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar lote de ingressos' })
  @ApiParam({ name: 'id', description: 'ID numérico do lote' })
  @ApiResponse({ status: 200, description: 'Lote atualizado' })
  @ApiResponse({ status: 403, description: 'Tentativa de alterar lote de terceiro' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateTicketBatchDto: UpdateTicketBatchDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.ticketBatchesService.update(id, updateTicketBatchDto, user);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ORGANIZER, Role.ADMIN)
  @Delete(':id')
  @ApiOperation({ summary: 'Excluir lote de ingressos (Sem ingressos emitidos)' })
  @ApiParam({ name: 'id', description: 'ID numérico do lote' })
  @ApiResponse({ status: 200, description: 'Lote excluído com sucesso' })
  @ApiResponse({ status: 403, description: 'Tentativa de excluir lote de terceiro' })
  @ApiResponse({ status: 409, description: 'Lote possui ingressos emitidos' })
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.ticketBatchesService.remove(id, user);
  }
}
