import { Test, TestingModule } from '@nestjs/testing';
import { PurchasesService } from './purchases.service';
import { PrismaService } from '../../database/prisma.service';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Role } from '../../common/enums/role.enum';
import { BatchStatus, EventStatus, PaymentMethod, PurchaseStatus, TicketStatus } from '@prisma/client';
import { PaymentMethodDto } from './dto/create-purchase.dto';

describe('PurchasesService (Regras de Compra, Estoque e Período)', () => {
  let service: PurchasesService;
  let prisma: any;

  const mockPrisma = {
    ticketBatch: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    purchase: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    ticket: {
      create: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback(mockPrisma)),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PurchasesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<PurchasesService>(PurchasesService);
    prisma = module.get(PrismaService);
    jest.clearAllMocks();
  });

  it('1. Deve realizar compra com sucesso decrementando estoque e emitindo ingressos', async () => {
    const now = new Date();
    const batch = {
      id: 'batch-1',
      price: 100,
      totalQuantity: 50,
      availableQuantity: 10,
      startSaleDate: new Date(now.getTime() - 24 * 60 * 60 * 1000), // Ontem
      endSaleDate: new Date(now.getTime() + 24 * 60 * 60 * 1000), // Amanhã
      status: BatchStatus.ACTIVE,
      sector: {
        event: { status: EventStatus.PUBLISHED },
      },
    };

    prisma.ticketBatch.findUnique.mockResolvedValue(batch);
    prisma.ticketBatch.update.mockResolvedValue({ ...batch, availableQuantity: 8 });
    prisma.purchase.create.mockResolvedValue({
      id: 'pur-1',
      userId: 'user-1',
      totalAmount: 200,
      status: PurchaseStatus.PAID,
      paymentMethod: PaymentMethod.PIX,
    });
    prisma.ticket.create.mockResolvedValue({
      id: 'tkt-1',
      code: 'TKT-TEST1',
      status: TicketStatus.VALID,
    });

    const result = await service.create(
      {
        ticketBatchId: 'batch-1',
        quantity: 2,
        paymentMethod: PaymentMethodDto.PIX,
      },
      'user-1',
    );

    expect(result.id).toBe('pur-1');
    expect(result.tickets.length).toBe(2);
  });

  it('2. Deve lançar 409 Conflict se o evento não estiver publicado', async () => {
    const now = new Date();
    prisma.ticketBatch.findUnique.mockResolvedValue({
      id: 'batch-1',
      price: 100,
      startSaleDate: new Date(now.getTime() - 1000),
      endSaleDate: new Date(now.getTime() + 1000),
      status: BatchStatus.ACTIVE,
      sector: {
        event: { status: EventStatus.DRAFT }, // Não publicado!
      },
    });

    await expect(
      service.create(
        { ticketBatchId: 'batch-1', quantity: 1, paymentMethod: PaymentMethodDto.PIX },
        'user-1',
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('3. Deve lançar 409 Conflict se a venda for realizada antes ou depois do período permitido', async () => {
    const now = new Date();
    // Lote expirado
    prisma.ticketBatch.findUnique.mockResolvedValue({
      id: 'batch-1',
      price: 100,
      availableQuantity: 10,
      startSaleDate: new Date(now.getTime() - 20 * 60 * 1000),
      endSaleDate: new Date(now.getTime() - 10 * 60 * 1000), // Expirou há 10 minutos
      status: BatchStatus.ACTIVE,
      sector: {
        event: { status: EventStatus.PUBLISHED },
      },
    });

    await expect(
      service.create(
        { ticketBatchId: 'batch-1', quantity: 1, paymentMethod: PaymentMethodDto.PIX },
        'user-1',
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('4. Deve lançar 409 Conflict se a quantidade solicitada for maior que o saldo do lote', async () => {
    const now = new Date();
    prisma.ticketBatch.findUnique.mockResolvedValue({
      id: 'batch-1',
      price: 100,
      availableQuantity: 2, // Apenas 2 disponíveis
      startSaleDate: new Date(now.getTime() - 1000),
      endSaleDate: new Date(now.getTime() + 1000),
      status: BatchStatus.ACTIVE,
      sector: {
        event: { status: EventStatus.PUBLISHED },
      },
    });

    await expect(
      service.create(
        { ticketBatchId: 'batch-1', quantity: 5, paymentMethod: PaymentMethodDto.PIX }, // Solicitou 5!
        'user-1',
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('5. Deve lançar 403 Forbidden se um usuário tentar visualizar compra de outro', async () => {
    prisma.purchase.findUnique.mockResolvedValue({
      id: 'pur-1',
      userId: 'user-dono',
    });

    await expect(
      service.findById('pur-1', { id: 'user-curioso', role: Role.CUSTOMER }),
    ).rejects.toThrow(ForbiddenException);
  });
});
