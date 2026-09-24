import { Test, TestingModule } from '@nestjs/testing';
import { CheckInsService } from './check-ins.service';
import { PrismaService } from '../../database/prisma.service';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Role } from '../../common/enums/role.enum';
import { EventStatus, TicketStatus } from '@prisma/client';

describe('CheckInsService (Regra de Check-In Único e Permissões)', () => {
  let service: CheckInsService;
  let prisma: any;

  const mockPrisma = {
    ticket: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    checkIn: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback(mockPrisma)),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CheckInsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<CheckInsService>(CheckInsService);
    prisma = module.get(PrismaService);
    jest.clearAllMocks();
  });

  it('1. Deve validar e realizar check-in com sucesso na primeira tentativa', async () => {
    const ticket = {
      id: 'tkt-1',
      code: 'TKT-VALIDO-01',
      status: TicketStatus.VALID,
      checkIn: null, // Ainda não foi utilizado!
      user: { name: 'Marlon', email: 'marlon@exemplo.com' },
      batch: {
        name: 'Lote 1',
        sector: {
          name: 'Pista',
          event: {
            title: 'Festival',
            status: EventStatus.PUBLISHED,
            organizerId: 'org-dono',
          },
        },
      },
    };

    prisma.ticket.findFirst.mockResolvedValue(ticket);
    prisma.checkIn.create.mockResolvedValue({
      id: 'chk-1',
      ticketId: 'tkt-1',
      checkedInByUserId: 'org-dono',
      checkedInAt: new Date(),
    });

    const result = await service.performCheckIn(
      { ticketIdentifier: 'TKT-VALIDO-01', notes: 'Portão 1' },
      { id: 'org-dono', role: Role.ORGANIZER },
    );

    expect(result.message).toContain('sucesso');
    expect(result.ticket.code).toBe('TKT-VALIDO-01');
  });

  it('2. Deve lançar 409 Conflict ao tentar realizar check-in duplicado no mesmo ingresso', async () => {
    const ticketJaUsado = {
      id: 'tkt-1',
      code: 'TKT-USADO-01',
      status: TicketStatus.USED,
      checkIn: {
        id: 'chk-anterior',
        checkedInAt: new Date(),
        checkedInBy: { name: 'Operador Antigo' },
      },
      user: { name: 'Marlon', email: 'marlon@exemplo.com' },
      batch: {
        sector: {
          event: {
            organizerId: 'org-dono',
            status: EventStatus.PUBLISHED,
          },
        },
      },
    };

    prisma.ticket.findFirst.mockResolvedValue(ticketJaUsado);

    await expect(
      service.performCheckIn(
        { ticketIdentifier: 'TKT-USADO-01' },
        { id: 'org-dono', role: Role.ORGANIZER },
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('3. Deve lançar 403 Forbidden se organizador tentar realizar check-in em evento de outro organizador', async () => {
    const ticket = {
      id: 'tkt-1',
      code: 'TKT-123',
      status: TicketStatus.VALID,
      batch: {
        sector: {
          event: {
            organizerId: 'org-outro', // Evento pertence a outro organizador
          },
        },
      },
    };

    prisma.ticket.findFirst.mockResolvedValue(ticket);

    await expect(
      service.performCheckIn(
        { ticketIdentifier: 'TKT-123' },
        { id: 'org-invasor', role: Role.ORGANIZER },
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('4. Deve lançar 404 Not Found se o código do ingresso não existir', async () => {
    prisma.ticket.findFirst.mockResolvedValue(null);

    await expect(
      service.performCheckIn(
        { ticketIdentifier: 'TKT-INEXISTENTE' },
        { id: 'org-1', role: Role.ORGANIZER },
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('5. Deve lançar 409 Conflict se o evento estiver cancelado', async () => {
    const ticket = {
      id: 'tkt-1',
      code: 'TKT-123',
      status: TicketStatus.VALID,
      batch: {
        sector: {
          event: {
            organizerId: 'org-1',
            status: EventStatus.CANCELLED, // Cancelado!
          },
        },
      },
    };

    prisma.ticket.findFirst.mockResolvedValue(ticket);

    await expect(
      service.performCheckIn(
        { ticketIdentifier: 'TKT-123' },
        { id: 'org-1', role: Role.ORGANIZER },
      ),
    ).rejects.toThrow(ConflictException);
  });
});
