import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateCheckInDto } from './dto/create-check-in.dto';
import { Role } from '../../common/enums/role.enum';
import { EventStatus, TicketStatus } from '@prisma/client';

@Injectable()
export class CheckInsService {
  constructor(private readonly prisma: PrismaService) {}

  async performCheckIn(
    dto: CreateCheckInDto,
    operator: { id: number; role: Role },
  ) {
    // Busca o ingresso por ID numérico ou por código único
    const numericId = Number(dto.ticketIdentifier);
    const orConditions: any[] = [
      { id: !isNaN(numericId) && Number.isInteger(numericId) ? numericId : -1 },
      { code: dto.ticketIdentifier },
    ];

    const ticket = await this.prisma.ticket.findFirst({
      where: {
        OR: orConditions,
      },
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
        checkIn: {
          include: {
            checkedInBy: {
              select: { id: true, name: true, email: true },
            },
          },
        },
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!ticket) {
      throw new NotFoundException(
        `Ingresso não encontrado com o identificador: ${dto.ticketIdentifier}`,
      );
    }

    const event = ticket.batch.sector.event;

    // Regra: Apenas o organizador dono do evento ou ADMIN pode fazer check-in
    if (event.organizerId !== operator.id && operator.role !== Role.ADMIN) {
      throw new ForbiddenException(
        'Você não tem permissão para realizar check-in em eventos de outros organizadores.',
      );
    }

    // Regra: Evento cancelado
    if (event.status === EventStatus.CANCELLED) {
      throw new ConflictException(
        'Check-in rejeitado: o evento deste ingresso foi cancelado.',
      );
    }

    // Regra: Ingresso cancelado
    if (ticket.status === TicketStatus.CANCELLED) {
      throw new ConflictException(
        'Check-in rejeitado: este ingresso foi cancelado.',
      );
    }

    // Regra obrigatória: Check-in único!
    if (ticket.status === TicketStatus.USED || ticket.checkIn) {
      const dataUso = ticket.checkIn?.checkedInAt
        ? new Date(ticket.checkIn.checkedInAt).toLocaleString('pt-BR')
        : 'data anterior';
      throw new ConflictException(
        `Check-in rejeitado: este ingresso já foi utilizado em ${dataUso} pelo operador ${ticket.checkIn?.checkedInBy?.name || 'Desconhecido'}.`,
      );
    }

    // Realiza o check-in e atualiza o ingresso de forma atômica
    return this.prisma.$transaction(async (tx) => {
      const checkInRecord = await tx.checkIn.create({
        data: {
          ticketId: ticket.id,
          checkedInByUserId: operator.id,
          notes: dto.notes,
        },
        include: {
          checkedInBy: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      await tx.ticket.update({
        where: { id: ticket.id },
        data: { status: TicketStatus.USED },
      });

      return {
        message: 'Check-in realizado com sucesso!',
        checkIn: checkInRecord,
        ticket: {
          id: ticket.id,
          code: ticket.code,
          attendeeName: ticket.user.name,
          attendeeEmail: ticket.user.email,
          eventTitle: event.title,
          sectorName: ticket.batch.sector.name,
          batchName: ticket.batch.name,
        },
      };
    });
  }

  async getCheckInsByEvent(
    eventId: number,
    currentUser: { id: number; role: Role },
  ) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) {
      throw new NotFoundException(`Evento com ID ${eventId} não encontrado.`);
    }

    if (event.organizerId !== currentUser.id && currentUser.role !== Role.ADMIN) {
      throw new ForbiddenException(
        'Você não tem permissão para visualizar o relatório de check-ins deste evento.',
      );
    }

    return this.prisma.checkIn.findMany({
      where: {
        ticket: {
          batch: {
            sector: {
              eventId,
            },
          },
        },
      },
      include: {
        checkedInBy: {
          select: { id: true, name: true, email: true },
        },
        ticket: {
          include: {
            user: { select: { id: true, name: true, email: true } },
            batch: {
              include: {
                sector: true,
              },
            },
          },
        },
      },
      orderBy: { checkedInAt: 'desc' },
    });
  }
}
