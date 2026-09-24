import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateTicketBatchDto } from './dto/create-ticket-batch.dto';
import { UpdateTicketBatchDto } from './dto/update-ticket-batch.dto';
import { Role } from '../../common/enums/role.enum';
import { BatchStatus } from '@prisma/client';

@Injectable()
export class TicketBatchesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    dto: CreateTicketBatchDto,
    currentUser: { id: string; role: Role },
  ) {
    const sector = await this.prisma.sector.findUnique({
      where: { id: dto.sectorId },
      include: {
        event: true,
        batches: true,
      },
    });

    if (!sector) {
      throw new NotFoundException(`Setor com ID ${dto.sectorId} não encontrado.`);
    }

    // Validação de permissão: apenas dono do evento ou ADMIN
    if (
      sector.event.organizerId !== currentUser.id &&
      currentUser.role !== Role.ADMIN
    ) {
      throw new ForbiddenException(
        'Você não tem permissão para cadastrar lotes de ingressos em eventos de terceiros.',
      );
    }

    const startSale = new Date(dto.startSaleDate);
    const endSale = new Date(dto.endSaleDate);

    if (endSale <= startSale) {
      throw new BadRequestException(
        'A data de término das vendas deve ser posterior à data de início das vendas.',
      );
    }

    // Regra de ouro: Capacidade por setor/lote
    const currentBatchesTotal = sector.batches.reduce(
      (sum, b) => sum + b.totalQuantity,
      0,
    );

    const availableSectorCapacity = sector.capacity - currentBatchesTotal;

    if (dto.totalQuantity > availableSectorCapacity) {
      throw new ConflictException(
        `A capacidade total do setor é de ${sector.capacity} ingressos. Ingressos já alocados em outros lotes: ${currentBatchesTotal}. Capacidade restante: ${availableSectorCapacity}. Quantidade solicitada para o novo lote: ${dto.totalQuantity}.`,
      );
    }

    return this.prisma.ticketBatch.create({
      data: {
        name: dto.name,
        price: dto.price,
        totalQuantity: dto.totalQuantity,
        availableQuantity: dto.totalQuantity,
        startSaleDate: startSale,
        endSaleDate: endSale,
        sectorId: dto.sectorId,
        status: BatchStatus.ACTIVE,
      },
    });
  }

  async findBySectorId(sectorId: string) {
    const sector = await this.prisma.sector.findUnique({ where: { id: sectorId } });
    if (!sector) {
      throw new NotFoundException(`Setor com ID ${sectorId} não encontrado.`);
    }

    return this.prisma.ticketBatch.findMany({
      where: { sectorId },
      orderBy: { startSaleDate: 'asc' },
    });
  }

  async findById(id: string) {
    const batch = await this.prisma.ticketBatch.findUnique({
      where: { id },
      include: {
        sector: {
          include: {
            event: true,
          },
        },
      },
    });

    if (!batch) {
      throw new NotFoundException(`Lote de ingressos com ID ${id} não encontrado.`);
    }

    return batch;
  }

  async update(
    id: string,
    dto: UpdateTicketBatchDto,
    currentUser: { id: string; role: Role },
  ) {
    const batch = await this.findById(id);

    if (
      batch.sector.event.organizerId !== currentUser.id &&
      currentUser.role !== Role.ADMIN
    ) {
      throw new ForbiddenException(
        'Você não tem permissão para alterar lotes de eventos de terceiros.',
      );
    }

    const data: any = { ...dto };
    if (dto.startSaleDate) data.startSaleDate = new Date(dto.startSaleDate);
    if (dto.endSaleDate) data.endSaleDate = new Date(dto.endSaleDate);

    if (data.startSaleDate && data.endSaleDate && data.endSaleDate <= data.startSaleDate) {
      throw new BadRequestException(
        'A data de término das vendas deve ser posterior à data de início.',
      );
    }

    if (dto.status) {
      data.status = dto.status as BatchStatus;
    }

    return this.prisma.ticketBatch.update({
      where: { id },
      data,
    });
  }

  async remove(id: string, currentUser: { id: string; role: Role }) {
    const batch = await this.findById(id);

    if (
      batch.sector.event.organizerId !== currentUser.id &&
      currentUser.role !== Role.ADMIN
    ) {
      throw new ForbiddenException(
        'Você não tem permissão para excluir lotes de eventos de terceiros.',
      );
    }

    const soldCount = await this.prisma.ticket.count({
      where: { ticketBatchId: id },
    });

    if (soldCount > 0) {
      throw new ConflictException(
        'Não é possível excluir um lote que já possui ingressos vendidos. Desative o lote alterando seu status para INACTIVE.',
      );
    }

    await this.prisma.ticketBatch.delete({ where: { id } });
    return { message: 'Lote de ingressos excluído com sucesso.' };
  }
}
