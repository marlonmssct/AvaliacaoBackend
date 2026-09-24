import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ExternalService } from '../external/external.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { UpdateEventStatusDto } from './dto/update-event-status.dto';
import { Role } from '../../common/enums/role.enum';
import { EventStatus } from '@prisma/client';

@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly externalService: ExternalService,
  ) {}

  async create(createEventDto: CreateEventDto, organizerId: number) {
    const startsAt = new Date(createEventDto.startsAt);
    const endsAt = new Date(createEventDto.endsAt);

    if (endsAt <= startsAt) {
      throw new BadRequestException(
        'A data/hora de término do evento deve ser posterior à data/hora de início.',
      );
    }

    // Validação opcional / enriquecimento de dados via CEP
    try {
      const cepData = await this.externalService.consultarCep(createEventDto.locationCep);
      if (cepData && !createEventDto.locationCity) {
        createEventDto.locationCity = cepData.localidade;
        createEventDto.locationState = cepData.uf;
      }
    } catch {
      // Caso a API de CEP falhe, não interrompe se os campos manuais foram fornecidos
    }

    return this.prisma.event.create({
      data: {
        title: createEventDto.title,
        description: createEventDto.description,
        bannerUrl: createEventDto.bannerUrl,
        locationCep: createEventDto.locationCep,
        locationAddress: createEventDto.locationAddress,
        locationCity: createEventDto.locationCity,
        locationState: createEventDto.locationState,
        startsAt,
        endsAt,
        status: EventStatus.DRAFT,
        organizerId,
      },
      include: {
        organizer: {
          select: { id: true, name: true, email: true },
        },
      },
    });
  }

  async findAll(user?: { id: number; role: Role }) {
    // Regra: Público ou CUSTOMER vê apenas PUBLISHED.
    // ORGANIZER vê PUBLISHED + seus próprios DRAFTs.
    // ADMIN vê todos.
    if (!user || user.role === Role.CUSTOMER) {
      return this.prisma.event.findMany({
        where: { status: EventStatus.PUBLISHED },
        include: {
          sectors: {
            include: { batches: true },
          },
          organizer: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { startsAt: 'asc' },
      });
    }

    if (user.role === Role.ORGANIZER) {
      return this.prisma.event.findMany({
        where: {
          OR: [
            { status: EventStatus.PUBLISHED },
            { organizerId: user.id },
          ],
        },
        include: {
          sectors: {
            include: { batches: true },
          },
          organizer: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { startsAt: 'asc' },
      });
    }

    // ADMIN vê todos
    return this.prisma.event.findMany({
      include: {
        sectors: {
          include: { batches: true },
        },
        organizer: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: number) {
    const event = await this.prisma.event.findUnique({
      where: { id },
      include: {
        organizer: {
          select: { id: true, name: true, email: true },
        },
        sectors: {
          include: {
            batches: true,
          },
        },
      },
    });

    if (!event) {
      throw new NotFoundException(`Evento com ID ${id} não encontrado.`);
    }

    return event;
  }

  async update(
    id: number,
    updateEventDto: UpdateEventDto,
    currentUser: { id: number; role: Role },
  ) {
    const event = await this.findById(id);

    // Prevenção de IDOR: Organizador só pode alterar seus próprios eventos
    if (event.organizerId !== currentUser.id && currentUser.role !== Role.ADMIN) {
      throw new ForbiddenException(
        'Você não tem permissão para alterar eventos de outros organizadores.',
      );
    }

    if (
      event.status === EventStatus.CANCELLED ||
      event.status === EventStatus.FINISHED
    ) {
      throw new ConflictException(
        `Não é possível alterar um evento no estado ${event.status}.`,
      );
    }

    const data: any = { ...updateEventDto };
    if (updateEventDto.startsAt) data.startsAt = new Date(updateEventDto.startsAt);
    if (updateEventDto.endsAt) data.endsAt = new Date(updateEventDto.endsAt);

    return this.prisma.event.update({
      where: { id },
      data,
      include: {
        organizer: {
          select: { id: true, name: true, email: true },
        },
      },
    });
  }

  async updateStatus(
    id: number,
    updateStatusDto: UpdateEventStatusDto,
    currentUser: { id: number; role: Role },
  ) {
    const event = await this.findById(id);

    if (event.organizerId !== currentUser.id && currentUser.role !== Role.ADMIN) {
      throw new ForbiddenException(
        'Você não tem permissão para alterar o status deste evento.',
      );
    }

    const targetStatus = updateStatusDto.status as unknown as EventStatus;

    if (event.status === EventStatus.CANCELLED) {
      throw new ConflictException('Eventos cancelados não podem ser reativados.');
    }

    // Regra de transição: Para publicar, deve ter ao menos 1 setor e 1 lote
    if (targetStatus === EventStatus.PUBLISHED) {
      const sectors = await this.prisma.sector.findMany({
        where: { eventId: id },
        include: { batches: true },
      });

      if (sectors.length === 0) {
        throw new ConflictException(
          'O evento deve possuir pelo menos um setor cadastrado antes de ser publicado.',
        );
      }

      const totalBatches = sectors.reduce(
        (acc, s) => acc + s.batches.length,
        0,
      );

      if (totalBatches === 0) {
        throw new ConflictException(
          'O evento deve possuir pelo menos um lote de ingressos cadastrado antes de ser publicado.',
        );
      }
    }

    return this.prisma.event.update({
      where: { id },
      data: { status: targetStatus },
    });
  }

  async updateBanner(
    id: number,
    bannerUrl: string,
    currentUser: { id: number; role: Role },
  ) {
    const event = await this.findById(id);

    if (event.organizerId !== currentUser.id && currentUser.role !== Role.ADMIN) {
      throw new ForbiddenException(
        'Você não tem permissão para atualizar a imagem de eventos de terceiros.',
      );
    }

    return this.prisma.event.update({
      where: { id },
      data: { bannerUrl },
    });
  }

  async remove(id: number, currentUser: { id: number; role: Role }) {
    const event = await this.findById(id);

    if (event.organizerId !== currentUser.id && currentUser.role !== Role.ADMIN) {
      throw new ForbiddenException(
        'Você não tem permissão para excluir eventos de terceiros.',
      );
    }

    // Verifica se já existem ingressos vinculados aos lotes deste evento
    const ticketCount = await this.prisma.ticket.count({
      where: {
        batch: {
          sector: {
            eventId: id,
          },
        },
      },
    });

    if (ticketCount > 0) {
      throw new ConflictException(
        'Não é possível excluir um evento que já possui ingressos emitidos. Cancele o evento em vez de excluí-lo.',
      );
    }

    await this.prisma.event.delete({ where: { id } });
    return { message: 'Evento excluído com sucesso.' };
  }
}
