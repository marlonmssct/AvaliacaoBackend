import {
  PrismaClient,
  Role,
  EventStatus,
  BatchStatus,
  PurchaseStatus,
  PaymentMethod,
  TicketStatus,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';

const connectionString =
  process.env.DATABASE_URL ||
  'postgresql://postgres:12345@localhost:5432/eventos_db?schema=public';
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 [SEED] Limpando dados anteriores...');

  // Limpa tabelas na ordem correta de integridade referencial
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

  console.log('🌱 [SEED] Criando Usuários (Admin, Organizadores e Clientes)...');

  // 1. ADMIN (ID 1)
  const admin = await prisma.user.create({
    data: {
      name: 'Administrador da Plataforma',
      email: 'admin@eventos.com',
      passwordHash: adminPass,
      role: Role.ADMIN,
      phone: '11999990000',
    },
  });

  // 2. ORGANIZADOR 1 (ID 2)
  const organizer1 = await prisma.user.create({
    data: {
      name: 'Produtora Alpha Eventos',
      email: 'organizador@eventos.com',
      passwordHash: orgPass,
      role: Role.ORGANIZER,
      phone: '11988881111',
    },
  });

  // 3. ORGANIZADOR 2 (ID 3)
  const organizer2 = await prisma.user.create({
    data: {
      name: 'Beta Entretenimento & Shows',
      email: 'organizador2@eventos.com',
      passwordHash: orgPass,
      role: Role.ORGANIZER,
      phone: '11977772222',
    },
  });

  // 4. ORGANIZADOR 3 (ID 4)
  const organizer3 = await prisma.user.create({
    data: {
      name: 'Tech & Inovação Brasil Produções',
      email: 'organizador3@eventos.com',
      passwordHash: orgPass,
      role: Role.ORGANIZER,
      phone: '11966663333',
    },
  });

  // 5. CLIENTE 1 (ID 5) - Marlon
  const customer1 = await prisma.user.create({
    data: {
      name: 'Marlon Massucato (Cliente)',
      email: 'cliente@eventos.com',
      passwordHash: userPass,
      role: Role.CUSTOMER,
      phone: '11955554444',
    },
  });

  // 6. CLIENTE 2 (ID 6) - Ana
  const customer2 = await prisma.user.create({
    data: {
      name: 'Ana Beatriz Souza',
      email: 'ana@eventos.com',
      passwordHash: userPass,
      role: Role.CUSTOMER,
      phone: '11944445555',
    },
  });

  // 7. CLIENTE 3 (ID 7) - Lucas
  const customer3 = await prisma.user.create({
    data: {
      name: 'Lucas Ferreira Lima',
      email: 'lucas@eventos.com',
      passwordHash: userPass,
      role: Role.CUSTOMER,
      phone: '11933336666',
    },
  });

  console.log('✅ Usuários criados: IDs 1 a 7');

  const now = new Date();
  const nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const nextMonthEnd = new Date(nextMonth.getTime() + 6 * 60 * 60 * 1000);

  const inTwoMonths = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
  const inTwoMonthsEnd = new Date(inTwoMonths.getTime() + 8 * 60 * 60 * 1000);

  const inThreeMonths = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
  const inThreeMonthsEnd = new Date(inThreeMonths.getTime() + 10 * 60 * 60 * 1000);

  console.log('🌱 [SEED] Criando Eventos em múltiplos estados (PUBLISHED, DRAFT, CANCELLED)...');

  // =========================================================================
  // EVENTO 1 (ID 1): PUBLISHED - Alpha Eventos
  // =========================================================================
  const event1 = await prisma.event.create({
    data: {
      title: 'Mega Festival de Inovação e Tecnologia 2026',
      description: 'O maior festival de tecnologia, inovação, música e inteligência artificial da América Latina.',
      locationCep: '01001000',
      locationAddress: 'Praça da Sé, 100',
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
      availableQuantity: 98,
      startSaleDate: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
      endSaleDate: new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000),
      sectorId: sectorVip.id,
      status: BatchStatus.ACTIVE,
    },
  });

  const batchVip2 = await prisma.ticketBatch.create({
    data: {
      name: '2º Lote VIP Regular',
      price: 320.0,
      totalQuantity: 100,
      availableQuantity: 100,
      startSaleDate: new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000),
      endSaleDate: nextMonth,
      sectorId: sectorVip.id,
      status: BatchStatus.ACTIVE,
    },
  });

  const batchPista1 = await prisma.ticketBatch.create({
    data: {
      name: '1º Lote Pista Geral',
      price: 120.0,
      totalQuantity: 400,
      availableQuantity: 399,
      startSaleDate: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
      endSaleDate: new Date(now.getTime() + 20 * 24 * 60 * 60 * 1000),
      sectorId: sectorPista.id,
      status: BatchStatus.ACTIVE,
    },
  });

  const batchPista2 = await prisma.ticketBatch.create({
    data: {
      name: '2º Lote Pista Geral',
      price: 160.0,
      totalQuantity: 400,
      availableQuantity: 400,
      startSaleDate: new Date(now.getTime() + 20 * 24 * 60 * 60 * 1000),
      endSaleDate: nextMonth,
      sectorId: sectorPista.id,
      status: BatchStatus.ACTIVE,
    },
  });

  // =========================================================================
  // EVENTO 2 (ID 2): PUBLISHED - Beta Entretenimento
  // =========================================================================
  const event2 = await prisma.event.create({
    data: {
      title: 'Rock Arena Festival Brasil 2026',
      description: 'Grandes nomes do Rock nacional e internacional reunidos em um final de semana épico.',
      locationCep: '20040002',
      locationAddress: 'Av. Rio Branco, 156',
      locationCity: 'Rio de Janeiro',
      locationState: 'RJ',
      startsAt: inTwoMonths,
      endsAt: inTwoMonthsEnd,
      status: EventStatus.PUBLISHED,
      organizerId: organizer2.id,
      bannerUrl: '/uploads/banners/default-tech-banner.jpg',
    },
  });

  const sectorCamarote = await prisma.sector.create({
    data: {
      name: 'Camarote Rocker Prime',
      capacity: 150,
      eventId: event2.id,
    },
  });

  const sectorPistaPremium = await prisma.sector.create({
    data: {
      name: 'Pista Premium Front Stage',
      capacity: 500,
      eventId: event2.id,
    },
  });

  const batchCamarote1 = await prisma.ticketBatch.create({
    data: {
      name: 'Lote Exclusivo Camarote',
      price: 350.0,
      totalQuantity: 150,
      availableQuantity: 149,
      startSaleDate: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
      endSaleDate: inTwoMonths,
      sectorId: sectorCamarote.id,
      status: BatchStatus.ACTIVE,
    },
  });

  const batchPremium1 = await prisma.ticketBatch.create({
    data: {
      name: '1º Lote Front Stage',
      price: 220.0,
      totalQuantity: 500,
      availableQuantity: 500,
      startSaleDate: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
      endSaleDate: inTwoMonths,
      sectorId: sectorPistaPremium.id,
      status: BatchStatus.ACTIVE,
    },
  });

  // =========================================================================
  // EVENTO 3 (ID 3): PUBLISHED - Tech & Inovação Brasil
  // =========================================================================
  const event3 = await prisma.event.create({
    data: {
      title: 'Congresso Internacional de IA & Cloud Computing',
      description: 'Painéis com especialistas de Big Techs, arquitetura em nuvem, machine learning e cases reais.',
      locationCep: '30130010',
      locationAddress: 'Av. Afonso Pena, 1500',
      locationCity: 'Belo Horizonte',
      locationState: 'MG',
      startsAt: inThreeMonths,
      endsAt: inThreeMonthsEnd,
      status: EventStatus.PUBLISHED,
      organizerId: organizer3.id,
      bannerUrl: '/uploads/banners/default-tech-banner.jpg',
    },
  });

  const sectorAuditorio = await prisma.sector.create({
    data: {
      name: 'Auditório Principal & Workshops',
      capacity: 600,
      eventId: event3.id,
    },
  });

  const batchFullPass = await prisma.ticketBatch.create({
    data: {
      name: 'Ingresso Profissional Full Pass',
      price: 450.0,
      totalQuantity: 400,
      availableQuantity: 400,
      startSaleDate: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
      endSaleDate: inThreeMonths,
      sectorId: sectorAuditorio.id,
      status: BatchStatus.ACTIVE,
    },
  });

  const batchMeia = await prisma.ticketBatch.create({
    data: {
      name: 'Ingresso Meia-Entrada Estudante',
      price: 225.0,
      totalQuantity: 200,
      availableQuantity: 200,
      startSaleDate: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
      endSaleDate: inThreeMonths,
      sectorId: sectorAuditorio.id,
      status: BatchStatus.ACTIVE,
    },
  });

  // =========================================================================
  // EVENTO 4 (ID 4): DRAFT (Rascunho - visível apenas pelo Organizador 1 e Admin)
  // =========================================================================
  const event4 = await prisma.event.create({
    data: {
      title: 'Masterclass Avançada: JavaScript, NestJS e Prisma (Rascunho)',
      description: 'Treinamento intensivo de arquitetura backend para desenvolvedores.',
      locationCep: '01310100',
      locationAddress: 'Av. Paulista, 1000',
      locationCity: 'São Paulo',
      locationState: 'SP',
      startsAt: inThreeMonths,
      endsAt: inThreeMonthsEnd,
      status: EventStatus.DRAFT,
      organizerId: organizer1.id,
    },
  });

  const sectorLab = await prisma.sector.create({
    data: {
      name: 'Laboratório de Informática',
      capacity: 40,
      eventId: event4.id,
    },
  });

  const batchLab = await prisma.ticketBatch.create({
    data: {
      name: 'Lote Único Intensivo',
      price: 180.0,
      totalQuantity: 40,
      availableQuantity: 40,
      startSaleDate: inTwoMonths,
      endSaleDate: inThreeMonths,
      sectorId: sectorLab.id,
      status: BatchStatus.INACTIVE,
    },
  });

  // =========================================================================
  // EVENTO 5 (ID 5): CANCELLED (Cancelado - para testar 409 em compras e check-in)
  // =========================================================================
  const event5 = await prisma.event.create({
    data: {
      title: 'Stand-Up Comedy Noite dos Risos (Cancelado)',
      description: 'Apresentação especial cancelada por motivos de força maior.',
      locationCep: '80010010',
      locationAddress: 'Rua XV de Novembro, 50',
      locationCity: 'Curitiba',
      locationState: 'PR',
      startsAt: inTwoMonths,
      endsAt: inTwoMonthsEnd,
      status: EventStatus.CANCELLED,
      organizerId: organizer2.id,
    },
  });

  const sectorTeatro = await prisma.sector.create({
    data: {
      name: 'Plateia Central',
      capacity: 300,
      eventId: event5.id,
    },
  });

  const batchTeatro = await prisma.ticketBatch.create({
    data: {
      name: 'Lote Promocional Teatro',
      price: 80.0,
      totalQuantity: 300,
      availableQuantity: 300,
      startSaleDate: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
      endSaleDate: inTwoMonths,
      sectorId: sectorTeatro.id,
      status: BatchStatus.INACTIVE,
    },
  });

  console.log('✅ Eventos criados: IDs 1 a 5 (PUBLISHED, DRAFT e CANCELLED).');

  // =========================================================================
  // COMPRAS E INGRESSOS DEMO PARA APRESENTAÇÃO
  // =========================================================================
  console.log('🌱 [SEED] Gerando Compras e Ingressos com cenários de teste...');

  // Compra 1: Marlon compra 1 VIP do Evento 1
  const purchase1 = await prisma.purchase.create({
    data: {
      userId: customer1.id,
      totalAmount: 250.0,
      status: PurchaseStatus.PAID,
      paymentMethod: PaymentMethod.PIX,
    },
  });

  const ticketVip1 = await prisma.ticket.create({
    data: {
      code: 'TKT-DEMO-VIP-001',
      ticketBatchId: batchVip1.id,
      purchaseId: purchase1.id,
      userId: customer1.id,
      status: TicketStatus.VALID,
    },
  });

  // Compra 2: Marlon compra 1 Pista do Evento 1
  const purchase2 = await prisma.purchase.create({
    data: {
      userId: customer1.id,
      totalAmount: 120.0,
      status: PurchaseStatus.PAID,
      paymentMethod: PaymentMethod.CREDIT_CARD,
    },
  });

  const ticketPista1 = await prisma.ticket.create({
    data: {
      code: 'TKT-DEMO-PISTA-002',
      ticketBatchId: batchPista1.id,
      purchaseId: purchase2.id,
      userId: customer1.id,
      status: TicketStatus.VALID,
    },
  });

  // Compra 3: Ana compra 1 Camarote do Evento 2
  const purchase3 = await prisma.purchase.create({
    data: {
      userId: customer2.id,
      totalAmount: 350.0,
      status: PurchaseStatus.PAID,
      paymentMethod: PaymentMethod.BOLETO,
    },
  });

  const ticketRock = await prisma.ticket.create({
    data: {
      code: 'TKT-ROCK-PRIME-003',
      ticketBatchId: batchCamarote1.id,
      purchaseId: purchase3.id,
      userId: customer2.id,
      status: TicketStatus.VALID,
    },
  });

  // Compra 4: Lucas compra 1 VIP e esse ingresso JÁ FOI UTILIZADO (Check-in conduzido)
  const purchase4 = await prisma.purchase.create({
    data: {
      userId: customer3.id,
      totalAmount: 250.0,
      status: PurchaseStatus.PAID,
      paymentMethod: PaymentMethod.PIX,
    },
  });

  const ticketJaUsado = await prisma.ticket.create({
    data: {
      code: 'TKT-JA-UTILIZADO-004',
      ticketBatchId: batchVip1.id,
      purchaseId: purchase4.id,
      userId: customer3.id,
      status: TicketStatus.USED,
    },
  });

  // Registro de Check-in já efetuado para o ingresso 4
  const checkInDemo = await prisma.checkIn.create({
    data: {
      ticketId: ticketJaUsado.id,
      checkedInByUserId: organizer1.id,
      notes: 'Entrada VIP - Portão A (Validado antecipadamente)',
      checkedInAt: new Date(now.getTime() - 2 * 60 * 60 * 1000), // Usado há 2 horas
    },
  });

  console.log('✅ Compras, Ingressos e Check-ins criados com sucesso!');
  console.log('------------------------------------------------------------');
  console.log('🎉 BANCO DE DADOS POPULADO COM SUCESSO!');
  console.log('------------------------------------------------------------');
  console.log('🎟️ Ingressos prontos para teste:');
  console.log(`   1. [VÁLIDO] ID: ${ticketVip1.id} | Código: ${ticketVip1.code} (VIP Evento 1)`);
  console.log(`   2. [VÁLIDO] ID: ${ticketPista1.id} | Código: ${ticketPista1.code} (Pista Evento 1)`);
  console.log(`   3. [VÁLIDO] ID: ${ticketRock.id} | Código: ${ticketRock.code} (Camarote Evento 2)`);
  console.log(`   4. [JÁ USADO] ID: ${ticketJaUsado.id} | Código: ${ticketJaUsado.code} (Para testar 409)`);
  console.log('------------------------------------------------------------');
}

main()
  .catch((e) => {
    console.error('❌ Erro no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
