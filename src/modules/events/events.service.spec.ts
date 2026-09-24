import { Test, TestingModule } from '@nestjs/testing';
import { EventsService } from './events.service';
import { PrismaService } from '../../database/prisma.service';
import { ExternalService } from '../external/external.service';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Role } from '../../common/enums/role.enum';
import { EventStatus } from '@prisma/client';

describe('EventsService (Regras de Domínio e Permissões)', () => {
  let service: EventsService;
  let prisma: any;
  let externalService: any;

  const mockPrisma = {
    event: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    sector: {
      findMany: jest.fn(),
    },
    ticket: {
      count: jest.fn(),
    },
  };

  const mockExternalService = {
    consultarCep: jest.fn().mockResolvedValue({
      localidade: 'São Paulo',
      uf: 'SP',
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ExternalService, useValue: mockExternalService },
      ],
    }).compile();

    service = module.get<EventsService>(EventsService);
    prisma = module.get(PrismaService);
    externalService = module.get(ExternalService);
    jest.clearAllMocks();
  });

  it('1. Deve criar evento com status inicial DRAFT com sucesso', async () => {
    const dto = {
      title: 'Show Musical',
      description: 'Festival de Jazz',
      locationCep: '01001000',
      locationAddress: 'Rua das Flores, 100',
      locationCity: 'São Paulo',
      locationState: 'SP',
      startsAt: '2026-11-01T20:00:00.000Z',
      endsAt: '2026-11-01T23:00:00.000Z',
    };

    prisma.event.create.mockResolvedValue({
      id: 'event-uuid-1',
      ...dto,
      status: EventStatus.DRAFT,
      organizerId: 'org-1',
    });

    const result = await service.create(dto, 'org-1');
    expect(result.status).toBe(EventStatus.DRAFT);
    expect(prisma.event.create).toHaveBeenCalled();
  });

  it('2. Deve rejeitar evento com data final anterior ou igual à data inicial (400)', async () => {
    const dto = {
      title: 'Show Musical',
      description: 'Festival',
      locationCep: '01001000',
      locationAddress: 'Rua A',
      locationCity: 'SP',
      locationState: 'SP',
      startsAt: '2026-11-01T20:00:00.000Z',
      endsAt: '2026-11-01T19:00:00.000Z', // Data anterior!
    };

    await expect(service.create(dto, 'org-1')).rejects.toThrow(BadRequestException);
  });

  it('3. Deve lançar 403 Forbidden ao tentar alterar evento de terceiro', async () => {
    prisma.event.findUnique.mockResolvedValue({
      id: 'event-uuid-1',
      organizerId: 'org-dono',
      status: EventStatus.DRAFT,
    });

    await expect(
      service.update('event-uuid-1', { title: 'Novo Titulo' }, { id: 'org-hacker', role: Role.ORGANIZER }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('4. Deve lançar 404 quando o evento não existir', async () => {
    prisma.event.findUnique.mockResolvedValue(null);
    await expect(service.findById('uuid-inexistente')).rejects.toThrow(NotFoundException);
  });

  it('5. Deve lançar 409 Conflict ao tentar publicar evento sem setores ou sem lotes cadastrados', async () => {
    prisma.event.findUnique.mockResolvedValue({
      id: 'event-1',
      organizerId: 'org-1',
      status: EventStatus.DRAFT,
    });

    prisma.sector.findMany.mockResolvedValue([]); // Nenhum setor!

    await expect(
      service.updateStatus('event-1', { status: 'PUBLISHED' as any }, { id: 'org-1', role: Role.ORGANIZER }),
    ).rejects.toThrow(ConflictException);
  });

  it('6. Deve lançar 409 Conflict ao tentar alterar evento já cancelado', async () => {
    prisma.event.findUnique.mockResolvedValue({
      id: 'event-1',
      organizerId: 'org-1',
      status: EventStatus.CANCELLED,
    });

    await expect(
      service.update('event-1', { title: 'Tentativa' }, { id: 'org-1', role: Role.ORGANIZER }),
    ).rejects.toThrow(ConflictException);
  });
});
