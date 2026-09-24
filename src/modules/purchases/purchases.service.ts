import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { Role } from '../../common/enums/role.enum';
import {
  BatchStatus,
  EventStatus,
  PaymentMethod,
  PurchaseStatus,
  TicketStatus,
} from '@prisma/client';

@Injectable()
export class PurchasesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePurchaseDto, userId: string) {
    const batch = await this.prisma.ticketBatch.findUnique({
      where: { id: dto.ticketBatchId },
      include: {
        sector: {
          include: {
            event: true,
          },
        },
      },
    });

    if (!batch) {
      throw new NotFoundException(
        `Lote de ingressos com ID ${dto.ticketBatchId} não encontrado.`,
      );
    }

    // Validação de estado do evento
    if (batch.sector.event.status !== EventStatus.PUBLISHED) {
      throw new ConflictException(
        `Vendas não permitidas. O evento encontra-se no estado ${batch.sector.event.status}.`,
      );
    }

    // Validação de estado do lote
    if (batch.status !== BatchStatus.ACTIVE) {
      throw new ConflictException(
        `Este lote não está ativo para vendas (Status atual: ${batch.status}).`,
      );
    }

    // Regra: Venda somente no período
    const now = new Date();
    if (now < batch.startSaleDate) {
      throw new ConflictException(
        `As vendas para este lote iniciam apenas em ${batch.startSaleDate.toISOString()}.`,
      );
    }

    if (now > batch.endSaleDate) {
      throw new ConflictException(
        `O período de vendas deste lote expirou em ${batch.endSaleDate.toISOString()}.`,
      );
    }

    // Regra: Capacidade disponível
    if (batch.availableQuantity < dto.quantity) {
      throw new ConflictException(
        `Quantidade solicitada (${dto.quantity}) indisponível. Restam apenas ${batch.availableQuantity} ingressos disponíveis neste lote.`,
      );
    }

    const unitPrice = Number(batch.price);
    const totalAmount = unitPrice * dto.quantity;

    // Transação Atômica: decremento de estoque e emissão dos ingressos
    return this.prisma.$transaction(async (tx) => {
      // Revalida estoque dentro da transação para prevenir race conditions
      const currentBatch = await tx.ticketBatch.findUnique({
        where: { id: dto.ticketBatchId },
      });

      if (!currentBatch || currentBatch.availableQuantity < dto.quantity) {
        throw new ConflictException(
          'Conflito de concorrência: os ingressos foram esgotados durante a finalização do seu pedido.',
        );
      }

      const newAvailable = currentBatch.availableQuantity - dto.quantity;
      const newStatus = newAvailable === 0 ? BatchStatus.SOLD_OUT : currentBatch.status;

      await tx.ticketBatch.update({
        where: { id: dto.ticketBatchId },
        data: {
          availableQuantity: newAvailable,
          status: newStatus,
        },
      });

      const purchase = await tx.purchase.create({
        data: {
          userId,
          totalAmount,
          status: PurchaseStatus.PAID,
          paymentMethod: dto.paymentMethod as PaymentMethod,
        },
      });

      // Geração de ingressos individuais com códigos únicos
      const ticketPromises = [];
      for (let i = 0; i < dto.quantity; i++) {
        const uniqueCode = `TKT-${randomBytes(6).toString('hex').toUpperCase()}`;
        ticketPromises.push(
          tx.ticket.create({
            data: {
              code: uniqueCode,
              ticketBatchId: dto.ticketBatchId,
              purchaseId: purchase.id,
              userId,
              status: TicketStatus.VALID,
            },
          }),
        );
      }

      const tickets = await Promise.all(ticketPromises);

      return {
        ...purchase,
        tickets,
      };
    });
  }

  async findAll(currentUser: { id: string; role: Role }) {
    // Se for ADMIN, pode listar todas as compras. Se for CUSTOMER/ORGANIZER, apenas as suas
    const where = currentUser.role === Role.ADMIN ? {} : { userId: currentUser.id };

    return this.prisma.purchase.findMany({
      where,
      include: {
        tickets: {
          include: {
            batch: {
              include: {
                sector: {
                  include: {
                    event: {
                      select: { id: true, title: true, startsAt: true, locationAddress: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string, currentUser: { id: string; role: Role }) {
    const purchase = await this.prisma.purchase.findUnique({
      where: { id },
      include: {
        tickets: {
          include: {
            batch: {
              include: {
                sector: {
                  include: {
                    event: true,
                  },
                },
              },
            },
          },
        },
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!purchase) {
      throw new NotFoundException(`Compra com ID ${id} não encontrada.`);
    }

    if (purchase.userId !== currentUser.id && currentUser.role !== Role.ADMIN) {
      throw new ForbiddenException(
        'Você não tem permissão para visualizar compras de terceiros.',
      );
    }

    return purchase;
  }
}
