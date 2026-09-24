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
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { basename, extname, join, resolve } from 'path';
import { randomUUID } from 'crypto';
import { mkdir, unlink, writeFile } from 'fs/promises';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { UpdateEventStatusDto } from './dto/update-event-status.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Eventos')
@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ORGANIZER, Role.ADMIN)
  @Post()
  @ApiOperation({ summary: 'Criar novo evento (Apenas ORGANIZER ou ADMIN)' })
  @ApiResponse({ status: 201, description: 'Evento criado como rascunho (DRAFT)' })
  @ApiResponse({ status: 400, description: 'Datas ou campos inválidos' })
  @ApiResponse({ status: 403, description: 'Usuário sem perfil de organizador' })
  create(
    @Body() createEventDto: CreateEventDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.eventsService.create(createEventDto, user.id);
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get()
  @ApiOperation({ summary: 'Listar eventos públicos e visíveis' })
  @ApiResponse({ status: 200, description: 'Lista de eventos retornada' })
  findAll(@CurrentUser() user?: CurrentUserPayload) {
    return this.eventsService.findAll(user);
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id')
  @ApiOperation({ summary: 'Obter detalhes de um evento por ID' })
  @ApiParam({ name: 'id', description: 'ID numérico do evento' })
  @ApiResponse({ status: 200, description: 'Detalhes completos do evento e seus setores' })
  @ApiResponse({ status: 404, description: 'Evento não encontrado' })
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user?: CurrentUserPayload,
  ) {
    return this.eventsService.findVisibleById(id, user);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ORGANIZER, Role.ADMIN)
  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar dados de um evento (Apenas o organizador dono ou ADMIN)' })
  @ApiParam({ name: 'id', description: 'ID numérico do evento' })
  @ApiResponse({ status: 200, description: 'Evento atualizado' })
  @ApiResponse({ status: 403, description: 'Não autorizado a alterar evento de terceiro' })
  @ApiResponse({ status: 404, description: 'Evento não encontrado' })
  @ApiResponse({ status: 409, description: 'Evento já cancelado ou finalizado' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateEventDto: UpdateEventDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.eventsService.update(id, updateEventDto, user);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ORGANIZER, Role.ADMIN)
  @Patch(':id/status')
  @ApiOperation({ summary: 'Alterar status do evento (DRAFT -> PUBLISHED -> CANCELLED/FINISHED)' })
  @ApiParam({ name: 'id', description: 'ID numérico do evento' })
  @ApiResponse({ status: 200, description: 'Status atualizado com sucesso' })
  @ApiResponse({ status: 403, description: 'Não autorizado a gerenciar o evento' })
  @ApiResponse({ status: 409, description: 'Regra violada (ex: publicar sem setor ou reativar cancelado)' })
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateStatusDto: UpdateEventStatusDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.eventsService.updateStatus(id, updateStatusDto, user);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ORGANIZER, Role.ADMIN)
  @Post(':id/banner')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
      },
    }),
  )
  @ApiOperation({ summary: 'Fazer upload do banner/imagem do evento (Até 5MB, JPG/PNG/WEBP)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Banner enviado e vinculado ao evento com sucesso' })
  @ApiResponse({ status: 400, description: 'Arquivo inválido (tamanho excedido ou formato incorreto)' })
  @ApiResponse({ status: 403, description: 'Tentativa de alterar evento de terceiro' })
  async uploadBanner(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }),
        ],
      }),
    )
    file: Express.Multer.File,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    if (!file) {
      throw new BadRequestException('Nenhum arquivo enviado');
    }

    const acceptedTypes: Record<string, string[]> = {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp'],
    };
    const extension = extname(file.originalname).toLowerCase();
    const bytes = file.buffer;
    const detectedType =
      bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        ? 'image/png'
        : bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
          ? 'image/jpeg'
          : bytes.toString('ascii', 0, 4) === 'RIFF' &&
              bytes.toString('ascii', 8, 12) === 'WEBP'
            ? 'image/webp'
            : null;
    if (
      !acceptedTypes[file.mimetype]?.includes(extension) ||
      detectedType !== file.mimetype ||
      file.size === 0
    ) {
      throw new BadRequestException('Tipo ou extensão da imagem inválidos.');
    }

    await this.eventsService.assertCanManageBanner(id, user);
    const filename = `${randomUUID()}${extension}`;
    const destination = resolve(process.env.UPLOAD_DEST || './uploads/banners');
    const filepath = join(destination, filename);
    await mkdir(destination, { recursive: true });
    await writeFile(filepath, file.buffer);
    try {
      return await this.eventsService.updateBanner(
        id,
        `/uploads/${basename(destination)}/${filename}`,
        user,
      );
    } catch (error) {
      await unlink(filepath);
      throw error;
    }
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ORGANIZER, Role.ADMIN)
  @Delete(':id')
  @ApiOperation({ summary: 'Excluir evento (Sem ingressos emitidos)' })
  @ApiParam({ name: 'id', description: 'ID numérico do evento' })
  @ApiResponse({ status: 200, description: 'Evento excluído' })
  @ApiResponse({ status: 403, description: 'Tentativa de excluir evento de terceiro' })
  @ApiResponse({ status: 409, description: 'Evento já possui ingressos e não pode ser excluído' })
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.eventsService.remove(id, user);
  }
}
