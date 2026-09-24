import { PrismaClient, Role, EventStatus, BatchStatus, PurchaseStatus, PaymentMethod, TicketStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando Seed do banco de dados...');

  // Limpa dados anteriores se existirem (ordem respeitando FKs)
  await prisma.checkIn.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.purchase.deleteMany();
  await prisma.ticketBatch.deleteMany();
  await prisma.sector.deleteMany();
  await prisma.event.deleteMany();
  await prisma.user.deleteMany();

  const salt = await bcrypt.genSalt(10);
  const adminPass = await bcrypt.hash('Admin@123456', salt);
  const orgPass = await bcrypt.hash('Org@123456', salt);
  const userPass = await bcrypt.hash('User@123456', salt);

  // 1. Criação de Usuários
  const admin = await prisma.user.create({
    data: {
      name: 'Administrador da Plataforma',
      email: 'admin@eventos.com',
      passwordHash: adminPass,
      role: Role.ADMIN,
      phone: '11999990000',
    },
  });

  const organizer1 = await prisma.user.create({
    data: {
      name: 'Produtora Alpha Eventos',
      email: 'organizador@eventos.com',
      passwordHash: orgPass,
      role: Role.ORGANIZER,
      phone: '11988881111',
    },
  });

  const organizer2 = await prisma.user.create({
    data: {
      name: 'Beta Entretenimento',
      email: 'organizador2@eventos.com',
      passwordHash: orgPass,
      role: Role.ORGANIZER,
      phone: '11977772222',
    },
  });

  const customer = await prisma.user.create({
    data: {
      name: 'Marlon Cliente',
      email: 'cliente@eventos.com',
      passwordHash: userPass,
      role: Role.CUSTOMER,
      phone: '11966663333',
    },
  });

  console.log('✅ Usuários criados: ADMIN, ORGANIZERS e CUSTOMER.');

  // 2. Evento 1 (PUBLISHED) do Organizador 1
  const now = new Date();
  const nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const nextMonthEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000);

  const event1 = await prisma.event.create({
    data: {
      title: 'Mega Festival de Inovação e Tecnologia 2026',
      description: 'O maior evento de tecnologia, música e inovação do Brasil.',
      locationCep: '01001000',
      locationAddress: 'Praça da Sé, s/n',
      locationCity: 'São Paulo',
      locationState: 'SP',
      startsAt: nextMonth,
      endsAt: nextMonthEnd,
      status: EventStatus.PUBLISHED,
      organizerId: organizer1.id,
      bannerUrl: '/uploads/banners/default-tech-banner.jpg',
    },
  });

  // Setores do Evento 1
  const sectorVip = await prisma.sector.create({
    data: {
      name: 'Área VIP & Open Bar',
      capacity: 200,
      eventId: event1.id,
    },
  });

  const sectorPista = await prisma.sector.create({
    data: {
      name: 'Pista Geral',
      capacity: 800,
      eventId: event1.id,
    },
  });

  // Lotes do Evento 1
  const batchVip1 = await prisma.ticketBatch.create({
    data: {
      name: '1º Lote VIP Promocional',
      price: 250.0,
      totalQuantity: 100,
      availableQuantity: 99,
      startSaleDate: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000), // Iniciou há 2 dias
      endSaleDate: new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000), // Termina em 15 dias
      sectorId: sectorVip.id,
      status: BatchStatus.ACTIVE,
    },
  });

  const batchPista1 = await prisma.ticketBatch.create({
    data: {
      name: '1º Lote Pista Geral',
      price: 120.0,
      totalQuantity: 400,
      availableQuantity: 400,
      startSaleDate: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
      endSaleDate: new Date(now.getTime() + 20 * 24 * 60 * 60 * 1000),
      sectorId: sectorPista.id,
      status: BatchStatus.ACTIVE,
    },
  });

  // 3. Compra e Ingresso de Teste já emitido para o Customer
  const purchase = await prisma.purchase.create({
    data: {
      userId: customer.id,
      totalAmount: 250.0,
      status: PurchaseStatus.PAID,
      paymentMethod: PaymentMethod.PIX,
    },
  });

  const ticket1 = await prisma.ticket.create({
    data: {
      code: 'TKT-DEMO-VIP-001',
      ticketBatchId: batchVip1.id,
      purchaseId: purchase.id,
      userId: customer.id,
      status: TicketStatus.VALID,
    },
  });

  console.log('✅ Evento, Setores, Lotes e Compra de demonstração criados com sucesso!');
  console.log(`🎫 Ingresso de teste pronto para check-in: ${ticket1.code}`);
}

main()
  .catch((e) => {
    console.error('❌ Erro no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
