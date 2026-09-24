import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { SectorsService } from './sectors.service';
import { CreateSectorDto } from './dto/create-sector.dto';
import { UpdateSectorDto } from './dto/update-sector.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Setores')
@Controller('sectors')
export class SectorsController {
  constructor(private readonly sectorsService: SectorsService) {}

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ORGANIZER, Role.ADMIN)
  @Post()
  @ApiOperation({ summary: 'Cadastrar novo setor no evento (Apenas organizador do evento ou ADMIN)' })
  @ApiResponse({ status: 201, description: 'Setor criado com sucesso' })
  @ApiResponse({ status: 403, description: 'Tentativa de criar setor em evento de terceiro' })
  @ApiResponse({ status: 404, description: 'Evento não encontrado' })
  create(
    @Body() createSectorDto: CreateSectorDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.sectorsService.create(createSectorDto, user);
  }

  @Public()
  @Get('event/:eventId')
  @ApiOperation({ summary: 'Listar setores de um evento' })
  @ApiParam({ name: 'eventId', description: 'UUID do evento' })
  @ApiResponse({ status: 200, description: 'Lista de setores do evento' })
  findByEventId(@Param('eventId', ParseUUIDPipe) eventId: string) {
    return this.sectorsService.findByEventId(eventId);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Obter detalhes de um setor' })
  @ApiParam({ name: 'id', description: 'UUID do setor' })
  @ApiResponse({ status: 200, description: 'Detalhes do setor' })
  @ApiResponse({ status: 404, description: 'Setor não encontrado' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.sectorsService.findById(id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ORGANIZER, Role.ADMIN)
  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar setor' })
  @ApiParam({ name: 'id', description: 'UUID do setor' })
  @ApiResponse({ status: 200, description: 'Setor atualizado' })
  @ApiResponse({ status: 403, description: 'Tentativa de alterar setor de evento de terceiro' })
  @ApiResponse({ status: 409, description: 'Nova capacidade menor que a soma dos lotes já criados' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateSectorDto: UpdateSectorDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.sectorsService.update(id, updateSectorDto, user);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ORGANIZER, Role.ADMIN)
  @Delete(':id')
  @ApiOperation({ summary: 'Excluir setor' })
  @ApiParam({ name: 'id', description: 'UUID do setor' })
  @ApiResponse({ status: 200, description: 'Setor excluído' })
  @ApiResponse({ status: 403, description: 'Tentativa de excluir setor de terceiro' })
  @ApiResponse({ status: 409, description: 'Setor possui ingressos vendidos' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.sectorsService.remove(id, user);
  }
}
