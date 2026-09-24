import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { AllExceptionsFilter } from '../src/common/filters/http-exception.filter';
import { Role } from '../src/common/enums/role.enum';
import { BatchStatus, EventStatus, PaymentMethod, PurchaseStatus, TicketStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';

describe('Testes E2E Completos (10 Cenários Obrigatórios + API Key)', () => {
  let app: INestApplication;
  let mockPrisma: any;

  let adminToken: string;
  let organizerToken: string;
  let organizer2Token: string;
  let customerToken: string;

  const validApiKey = '12345';

  const adminUserId = 1;
  const orgUserId = 2;
  const org2UserId = 3;
  const customerUserId = 4;

  const testEventId = 10;
  const testSectorId = 20;
  const testBatchId = 30;
  const testPurchaseId = 40;
  const testTicketId = 50;

  const adminUser = {
    id: adminUserId,
    name: 'Admin',
    email: 'admin@eventos.com',
    role: Role.ADMIN,
  };

  const orgUser = {
    id: orgUserId,
    name: 'Org 1',
    email: 'org1@eventos.com',
    role: Role.ORGANIZER,
  };

  const org2User = {
    id: org2UserId,
    name: 'Org 2',
    email: 'org2@eventos.com',
    role: Role.ORGANIZER,
  };

  const customerUser = {
    id: customerUserId,
    name: 'Customer',
    email: 'customer@eventos.com',
    role: Role.CUSTOMER,
  };

  beforeAll(async () => {
    const salt = await bcrypt.genSalt(10);
    const passHash = await bcrypt.hash('Senha@123', salt);

    mockPrisma = {
      user: {
        findUnique: jest.fn(async ({ where }) => {
          if (where.email === adminUser.email) return { ...adminUser, passwordHash: passHash };
          if (where.email === orgUser.email) return { ...orgUser, passwordHash: passHash };
          if (where.email === org2User.email) return { ...org2User, passwordHash: passHash };
          if (where.email === customerUser.email) return { ...customerUser, passwordHash: passHash };
          if (where.id === adminUser.id) return adminUser;
          if (where.id === orgUser.id) return orgUser;
          if (where.id === org2User.id) return org2User;
          if (where.id === customerUser.id) return customerUser;
          return null;
        }),
        create: jest.fn(async ({ data }) => ({
          id: 100,
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
        findMany: jest.fn().mockResolvedValue([adminUser, orgUser, customerUser]),
      },
      event: {
        create: jest.fn(async ({ data }) => ({
          id: testEventId,
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
          organizer: { id: data.organizerId, name: 'Org 1', email: 'org1@eventos.com' },
        })),
        findUnique: jest.fn(async ({ where }) => {
          if (where.id === testEventId) {
            return {
              id: testEventId,
              title: 'Evento Org 1',
              organizerId: orgUser.id,
              status: EventStatus.PUBLISHED,
              startsAt: new Date('2026-12-01T20:00:00.000Z'),
              endsAt: new Date('2026-12-01T23:00:00.000Z'),
              sectors: [],
              organizer: orgUser,
            };
          }
          return null;
        }),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn(async ({ where, data }) => ({
          id: where.id,
          ...data,
          organizer: orgUser,
        })),
        delete: jest.fn().mockResolvedValue({ id: testEventId }),
      },
      sector: {
        create: jest.fn(async ({ data }) => ({
          id: testSectorId,
          ...data,
          batches: [],
        })),
        findUnique: jest.fn(async ({ where }) => {
          if (where.id === testSectorId) {
            return {
              id: testSectorId,
              name: 'Pista',
              capacity: 500,
              eventId: testEventId,
              event: { organizerId: orgUser.id },
              batches: [],
            };
          }
          return null;
        }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      ticketBatch: {
        create: jest.fn(async ({ data }) => ({
          id: testBatchId,
          ...data,
        })),
        findUnique: jest.fn(async ({ where }) => {
          if (where.id === testBatchId) {
            return {
              id: testBatchId,
              name: 'Lote 1',
              price: 100,
              totalQuantity: 200,
              availableQuantity: 200,
              startSaleDate: new Date(Date.now() - 100000),
              endSaleDate: new Date(Date.now() + 100000000),
              status: BatchStatus.ACTIVE,
              sector: {
                id: testSectorId,
                event: {
                  id: testEventId,
                  organizerId: orgUser.id,
                  status: EventStatus.PUBLISHED,
                },
              },
            };
          }
          return null;
        }),
        update: jest.fn(async ({ where, data }) => ({ id: where.id, ...data })),
      },
      purchase: {
        create: jest.fn(async ({ data }) => ({
          id: testPurchaseId,
          ...data,
          createdAt: new Date(),
        })),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
      },
      ticket: {
        create: jest.fn(async ({ data }) => ({
          id: testTicketId,
          code: data.code,
          status: TicketStatus.VALID,
          ticketBatchId: data.ticketBatchId,
          purchaseId: data.purchaseId,
          userId: data.userId,
        })),
        count: jest.fn().mockResolvedValue(0),
        findFirst: jest.fn(async ({ where }) => {
          return {
            id: testTicketId,
            code: 'TKT-VALIDO-TESTE',
            status: TicketStatus.VALID,
            checkIn: null,
            userId: customerUser.id,
            user: customerUser,
            batch: {
              name: 'Lote 1',
              sector: {
                name: 'Pista',
                event: {
                  title: 'Show',
                  status: EventStatus.PUBLISHED,
                  organizerId: orgUser.id,
                },
              },
            },
          };
        }),
        update: jest.fn(),
      },
      checkIn: {
        create: jest.fn(async ({ data }) => ({
          id: 200,
          ...data,
          checkedInAt: new Date(),
          checkedInBy: orgUser,
        })),
        findMany: jest.fn().mockResolvedValue([]),
      },
      $transaction: jest.fn(async (cb) => cb(mockPrisma)),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrisma)
      .compile();

    app = moduleFixture.createNestApplication();

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());

    await app.init();

    // Obter tokens JWT para cada perfil (enviando a API Key x-api-key: 12345)
    const orgLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .set('x-api-key', validApiKey)
      .send({ email: orgUser.email, password: 'Senha@123' });
    organizerToken = orgLogin.body.accessToken;

    const org2Login = await request(app.getHttpServer())
      .post('/auth/login')
      .set('x-api-key', validApiKey)
      .send({ email: org2User.email, password: 'Senha@123' });
    organizer2Token = org2Login.body.accessToken;

    const custLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .set('x-api-key', validApiKey)
      .send({ email: customerUser.email, password: 'Senha@123' });
    customerToken = custLogin.body.accessToken;

    const adminLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .set('x-api-key', validApiKey)
      .send({ email: adminUser.email, password: 'Senha@123' });
    adminToken = adminLogin.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  // Teste de API Key
  it('0. API KEY: Requisições sem cabeçalho x-api-key ou com chave incorreta devem retornar 401', async () => {
    // Sem chave
    const resNoKey = await request(app.getHttpServer()).get('/events');
    expect(resNoKey.status).toBe(401);
    expect(resNoKey.body.message).toContain('API Key');

    // Com chave incorreta
    const resWrongKey = await request(app.getHttpServer())
      .get('/events')
      .set('x-api-key', 'chave_errada');
    expect(resWrongKey.status).toBe(401);
    expect(resWrongKey.body.message).toContain('API Key');
  });

  // Cenário 1: Fluxo principal com sucesso
  it('1. FLUXO PRINCIPAL: Criar evento, setor, lote, compra e check-in com sucesso', async () => {
    // 1. Criar Evento
    const eventRes = await request(app.getHttpServer())
      .post('/events')
      .set('x-api-key', validApiKey)
      .set('Authorization', `Bearer ${organizerToken}`)
      .send({
        title: 'Festival da Primavera',
        description: 'Música ao vivo',
        locationCep: '01001000',
        locationAddress: 'Praça da Sé',
        locationCity: 'São Paulo',
        locationState: 'SP',
        startsAt: '2026-11-20T20:00:00.000Z',
        endsAt: '2026-11-20T23:59:00.000Z',
      });
    expect(eventRes.status).toBe(201);

    // 2. Criar Setor
    const sectorRes = await request(app.getHttpServer())
      .post('/sectors')
      .set('x-api-key', validApiKey)
      .set('Authorization', `Bearer ${organizerToken}`)
      .send({
        name: 'Pista',
        capacity: 500,
        eventId: testEventId,
      });
    expect(sectorRes.status).toBe(201);

    // 3. Criar Lote
    const batchRes = await request(app.getHttpServer())
      .post('/ticket-batches')
      .set('x-api-key', validApiKey)
      .set('Authorization', `Bearer ${organizerToken}`)
      .send({
        name: '1º Lote',
        price: 100,
        totalQuantity: 200,
        startSaleDate: '2026-01-01T00:00:00.000Z',
        endSaleDate: '2026-11-19T23:59:00.000Z',
        sectorId: testSectorId,
      });
    expect(batchRes.status).toBe(201);

    // 4. Compra realizada pelo Customer
    const purchaseRes = await request(app.getHttpServer())
      .post('/purchases')
      .set('x-api-key', validApiKey)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        ticketBatchId: testBatchId,
        quantity: 1,
        paymentMethod: 'PIX',
      });
    expect(purchaseRes.status).toBe(201);

    // 5. Check-in realizado pelo Organizador
    const checkInRes = await request(app.getHttpServer())
      .post('/check-ins')
      .set('x-api-key', validApiKey)
      .set('Authorization', `Bearer ${organizerToken}`)
      .send({
        ticketIdentifier: 'TKT-VALIDO-TESTE',
        notes: 'Portão Principal',
      });
    expect(checkInRes.status).toBe(201);
    expect(checkInRes.body.message).toContain('sucesso');
  });

  // Cenário 2: Body inválido → 400
  it('2. BODY INVÁLIDO: Deve retornar 400 Bad Request ao omitir campos obrigatórios', async () => {
    const res = await request(app.getHttpServer())
      .post('/events')
      .set('x-api-key', validApiKey)
      .set('Authorization', `Bearer ${organizerToken}`)
      .send({
        title: 'Evento sem descrição e sem datas',
      });
    expect(res.status).toBe(400);
    expect(res.body.statusCode).toBe(400);
  });

  // Cenário 3: Ausência ou token inválido → 401
  it('3. SEM TOKEN / TOKEN INVÁLIDO: Deve retornar 401 Unauthorized', async () => {
    const noTokenRes = await request(app.getHttpServer())
      .get('/users/me')
      .set('x-api-key', validApiKey);
    expect(noTokenRes.status).toBe(401);

    const invalidTokenRes = await request(app.getHttpServer())
      .get('/users/me')
      .set('x-api-key', validApiKey)
      .set('Authorization', 'Bearer token_completamente_invalido');
    expect(invalidTokenRes.status).toBe(401);
  });

  // Cenário 4: Usuário sem permissão → 403
  it('4. SEM PERMISSÃO: CUSTOMER tentando criar evento deve retornar 403 Forbidden', async () => {
    const res = await request(app.getHttpServer())
      .post('/events')
      .set('x-api-key', validApiKey)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        title: 'Tentativa Proibida',
        description: 'Customer não pode criar evento',
        locationCep: '01001000',
        locationAddress: 'Rua A',
        locationCity: 'SP',
        locationState: 'SP',
        startsAt: '2026-11-20T20:00:00.000Z',
        endsAt: '2026-11-20T23:59:00.000Z',
      });
    expect(res.status).toBe(403);
    expect(res.body.message).toContain('Acesso negado');
  });

  // Cenário 5: Recurso inexistente → 404
  it('5. RECURSO INEXISTENTE: Buscar evento por ID inexistente deve retornar 404 Not Found', async () => {
    const res = await request(app.getHttpServer())
      .get('/events/999999')
      .set('x-api-key', validApiKey);
    expect(res.status).toBe(404);
  });

  // Cenário 6: Conflito de regra de negócio → 409
  it('6. CONFLITO DE NEGÓCIO: Capacidade de setor excedida deve retornar 409 Conflict', async () => {
    const res = await request(app.getHttpServer())
      .post('/ticket-batches')
      .set('x-api-key', validApiKey)
      .set('Authorization', `Bearer ${organizerToken}`)
      .send({
        name: 'Lote Excedente',
        price: 100,
        totalQuantity: 600,
        startSaleDate: '2026-01-01T00:00:00.000Z',
        endSaleDate: '2026-11-19T23:59:00.000Z',
        sectorId: testSectorId,
      });
    expect(res.status).toBe(409);
    expect(res.body.message).toContain('Capacidade restante');
  });

  // Cenário 7: Acesso a recurso de terceiro → 403
  it('7. ACESSO A RECURSO DE TERCEIRO: Organizador 2 tentando alterar evento do Organizador 1 deve retornar 403', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/events/${testEventId}`)
      .set('x-api-key', validApiKey)
      .set('Authorization', `Bearer ${organizer2Token}`)
      .send({
        title: 'Titulo Invasor',
      });
    expect(res.status).toBe(403);
    expect(res.body.message).toContain('outros organizadores');
  });

  // Cenário 8: Upload válido e inválido
  it('8. UPLOAD: Upload de arquivo inválido (.txt) deve ser rejeitado', async () => {
    const res = await request(app.getHttpServer())
      .post(`/events/${testEventId}/banner`)
      .set('x-api-key', validApiKey)
      .set('Authorization', `Bearer ${organizerToken}`)
      .attach('file', Buffer.from('conteudo de texto'), 'arquivo.txt');

    expect(res.status).toBe(400);
  });

  it('8b. UPLOAD: Upload de imagem válida deve ser aceito e atualizar o banner', async () => {
    const fakeImageBuffer = Buffer.from(
      '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
      'base64',
    );

    const res = await request(app.getHttpServer())
      .post(`/events/${testEventId}/banner`)
      .set('x-api-key', validApiKey)
      .set('Authorization', `Bearer ${organizerToken}`)
      .attach('file', fakeImageBuffer, {
        filename: 'banner.jpeg',
        contentType: 'image/jpeg',
      });

    expect(res.status).toBe(200);
  });

  // Cenário 9: Integração externa com HttpService
  it('9. INTEGRAÇÃO EXTERNA: Consulta de CEP inválido deve falhar de forma controlada (400)', async () => {
    const res = await request(app.getHttpServer())
      .get('/external/cep/123')
      .set('x-api-key', validApiKey);
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('CEP inválido');
  });

  // Cenário 10: Fluxo completo de mudança de estado do domínio
  it('10. MUDANÇA DE ESTADO: Não deve permitir publicar evento sem setores (409 Conflict)', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/events/${testEventId}/status`)
      .set('x-api-key', validApiKey)
      .set('Authorization', `Bearer ${organizerToken}`)
      .send({
        status: 'PUBLISHED',
      });
    expect(res.status).toBe(409);
    expect(res.body.message).toContain('setor');
  });
});
