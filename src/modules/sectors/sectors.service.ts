import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateSectorDto } from './dto/create-sector.dto';
import { UpdateSectorDto } from './dto/update-sector.dto';
import { Role } from '../../common/enums/role.enum';

@Injectable()
export class SectorsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createSectorDto: CreateSectorDto, currentUser: { id: string; role: Role }) {
    const event = await this.prisma.event.findUnique({
      where: { id: createSectorDto.eventId },
    });

    if (!event) {
      throw new NotFoundException(
        `Evento com ID ${createSectorDto.eventId} não encontrado.`,
      );
    }

    if (event.organizerId !== currentUser.id && currentUser.role !== Role.ADMIN) {
      throw new ForbiddenException(
        'Você não tem permissão para cadastrar setores em eventos de terceiros.',
      );
    }

    return this.prisma.sector.create({
      data: {
        name: createSectorDto.name,
        capacity: createSectorDto.capacity,
        eventId: createSectorDto.eventId,
      },
    });
  }

  async findByEventId(eventId: string) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) {
      throw new NotFoundException(`Evento com ID ${eventId} não encontrado.`);
    }

    return this.prisma.sector.findMany({
      where: { eventId },
      include: { batches: true },
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: string) {
    const sector = await this.prisma.sector.findUnique({
      where: { id },
      include: {
        event: true,
        batches: true,
      },
    });

    if (!sector) {
      throw new NotFoundException(`Setor com ID ${id} não encontrado.`);
    }

    return sector;
  }

  async update(
    id: string,
    updateSectorDto: UpdateSectorDto,
    currentUser: { id: string; role: Role },
  ) {
    const sector = await this.findById(id);

    if (
      sector.event.organizerId !== currentUser.id &&
      currentUser.role !== Role.ADMIN
    ) {
      throw new ForbiddenException(
        'Você não tem permissão para alterar setores de eventos de terceiros.',
      );
    }

    // Se estiver diminuindo a capacidade, validar se a soma dos lotes já cadastrados não ultrapassa
    if (updateSectorDto.capacity) {
      const currentBatchesTotal = sector.batches.reduce(
        (sum, b) => sum + b.totalQuantity,
        0,
      );

      if (updateSectorDto.capacity < currentBatchesTotal) {
        throw new ConflictException(
          `A nova capacidade (${updateSectorDto.capacity}) não pode ser inferior ao total de ingressos já alocados em lotes (${currentBatchesTotal}).`,
        );
      }
    }

    return this.prisma.sector.update({
      where: { id },
      data: updateSectorDto,
    });
  }

  async remove(id: string, currentUser: { id: string; role: Role }) {
    const sector = await this.findById(id);

    if (
      sector.event.organizerId !== currentUser.id &&
      currentUser.role !== Role.ADMIN
    ) {
      throw new ForbiddenException(
        'Você não tem permissão para excluir setores de eventos de terceiros.',
      );
    }

    const soldTickets = await this.prisma.ticket.count({
      where: {
        batch: {
          sectorId: id,
        },
      },
    });

    if (soldTickets > 0) {
      throw new ConflictException(
        'Não é possível excluir um setor que já possui ingressos vendidos.',
      );
    }

    await this.prisma.sector.delete({ where: { id } });
    return { message: 'Setor excluído com sucesso.' };
  }
}
