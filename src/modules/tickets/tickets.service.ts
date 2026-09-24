import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Role } from '../../common/enums/role.enum';

@Injectable()
export class TicketsService {
  constructor(private readonly prisma: PrismaService) {}

  async findMyTickets(userId: string) {
    return this.prisma.ticket.findMany({
      where: { userId },
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
        checkIn: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string, currentUser: { id: string; role: Role }) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
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
        user: {
          select: { id: true, name: true, email: true },
        },
        checkIn: {
          include: {
            checkedInBy: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
    });

    if (!ticket) {
      throw new NotFoundException(`Ingresso com ID ${id} não encontrado.`);
    }

    // Permissão: Titular do ingresso, Dono do evento ou ADMIN
    const isOwner = ticket.userId === currentUser.id;
    const isEventOrganizer =
      ticket.batch.sector.event.organizerId === currentUser.id;
    const isAdmin = currentUser.role === Role.ADMIN;

    if (!isOwner && !isEventOrganizer && !isAdmin) {
      throw new ForbiddenException(
        'Você não tem permissão para visualizar este ingresso.',
      );
    }

    return ticket;
  }

  async findByCode(code: string, currentUser: { id: string; role: Role }) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { code },
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
        user: {
          select: { id: true, name: true, email: true },
        },
        checkIn: true,
      },
    });

    if (!ticket) {
      throw new NotFoundException(`Ingresso com código ${code} não encontrado.`);
    }

    const isOwner = ticket.userId === currentUser.id;
    const isEventOrganizer =
      ticket.batch.sector.event.organizerId === currentUser.id;
    const isAdmin = currentUser.role === Role.ADMIN;

    if (!isOwner && !isEventOrganizer && !isAdmin) {
      throw new ForbiddenException(
        'Você não tem permissão para visualizar este ingresso.',
      );
    }

    return ticket;
  }
}
