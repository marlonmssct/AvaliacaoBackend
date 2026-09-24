import { Test, TestingModule } from '@nestjs/testing';
import { TicketBatchesService } from './ticket-batches.service';
import { PrismaService } from '../../database/prisma.service';
import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { Role } from '../../common/enums/role.enum';
import { BatchStatus } from '@prisma/client';

describe('TicketBatchesService (Regras de Capacidade e Vendas)', () => {
  let service: TicketBatchesService;
  let prisma: any;

  const mockPrisma = {
    sector: {
      findUnique: jest.fn(),
    },
    ticketBatch: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    ticket: {
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TicketBatchesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<TicketBatchesService>(TicketBatchesService);
    prisma = module.get(PrismaService);
    jest.clearAllMocks();
  });

  it('1. Deve criar lote com sucesso respeitando a capacidade máxima do setor', async () => {
    prisma.sector.findUnique.mockResolvedValue({
      id: 'sec-1',
      capacity: 500,
      event: { organizerId: 'org-1' },
      batches: [{ totalQuantity: 200 }], // 200 já alocados
    });

    const dto = {
      name: '2º Lote',
      price: 150,
      totalQuantity: 250, // 200 + 250 = 450 <= 500 (Válido!)
      startSaleDate: '2026-10-01T00:00:00.000Z',
      endSaleDate: '2026-11-01T00:00:00.000Z',
      sectorId: 'sec-1',
    };

    prisma.ticketBatch.create.mockResolvedValue({
      id: 'batch-2',
      ...dto,
      availableQuantity: 250,
      status: BatchStatus.ACTIVE,
    });

    const result = await service.create(dto, { id: 'org-1', role: Role.ORGANIZER });
    expect(result.id).toBe('batch-2');
  });

  it('2. Deve lançar 409 Conflict quando a soma das quantidades dos lotes exceder a capacidade do setor', async () => {
    prisma.sector.findUnique.mockResolvedValue({
      id: 'sec-1',
      capacity: 300,
      event: { organizerId: 'org-1' },
      batches: [{ totalQuantity: 200 }], // 200 já alocados. Restam apenas 100!
    });

    const dto = {
      name: 'Lote Excedente',
      price: 100,
      totalQuantity: 150, // 200 + 150 = 350 > 300 (Excede!)
      startSaleDate: '2026-10-01T00:00:00.000Z',
      endSaleDate: '2026-11-01T00:00:00.000Z',
      sectorId: 'sec-1',
    };

    await expect(
      service.create(dto, { id: 'org-1', role: Role.ORGANIZER }),
    ).rejects.toThrow(ConflictException);
  });

  it('3. Deve lançar 400 Bad Request se a data de fim de venda for anterior à data de início', async () => {
    prisma.sector.findUnique.mockResolvedValue({
      id: 'sec-1',
      capacity: 500,
      event: { organizerId: 'org-1' },
      batches: [],
    });

    const dto = {
      name: 'Lote Datas Erradas',
      price: 100,
      totalQuantity: 50,
      startSaleDate: '2026-11-01T00:00:00.000Z',
      endSaleDate: '2026-10-01T00:00:00.000Z', // Anterior!
      sectorId: 'sec-1',
    };

    await expect(
      service.create(dto, { id: 'org-1', role: Role.ORGANIZER }),
    ).rejects.toThrow(BadRequestException);
  });

  it('4. Deve lançar 403 Forbidden se organizador tentar criar lote em evento de terceiro', async () => {
    prisma.sector.findUnique.mockResolvedValue({
      id: 'sec-1',
      capacity: 500,
      event: { organizerId: 'org-dono' },
      batches: [],
    });

    const dto = {
      name: 'Lote Hacker',
      price: 100,
      totalQuantity: 50,
      startSaleDate: '2026-10-01T00:00:00.000Z',
      endSaleDate: '2026-11-01T00:00:00.000Z',
      sectorId: 'sec-1',
    };

    await expect(
      service.create(dto, { id: 'org-estranho', role: Role.ORGANIZER }),
    ).rejects.toThrow(ForbiddenException);
  });
});
