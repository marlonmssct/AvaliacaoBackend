import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { AllExceptionsFilter } from '../src/common/filters/http-exception.filter';
import { Role } from '../src/common/enums/role.enum';
import {
  BatchStatus,
  EventStatus,
  PaymentMethod,
  PurchaseStatus,
  TicketStatus,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';

describe('Suíte Completa de Rotas - Testes de Sucesso (200/201) e Erros (400, 401, 403, 404, 409)', () => {
  let app: INestApplication;
  let mockPrisma: any;

  const validApiKey = '12345';
  let adminToken: string;
  let org1Token: string;
  let org2Token: string;
  let customerToken: string;
  let customer2Token: string;

  const adminId = 1;
  const org1Id = 2;
  const org2Id = 3;
  const customerId = 4;
  const customer2Id = 5;

  const event1Id = 10;
  const sector1Id = 20;
  const batch1Id = 30;
  const purchase1Id = 40;
  const ticket1Id = 50;
  const ticketUsedId = 51;
  const batchAlmostSoldOutId = 31;

  const adminUser = {
    id: adminId,
    name: 'Admin Global',
    email: 'admin.routes@eventos.com',
    role: Role.ADMIN,
  };

  const org1User = {
    id: org1Id,
    name: 'Organizador 1',
    email: 'org1.routes@eventos.com',
    role: Role.ORGANIZER,
  };

  const org2User = {
    id: org2Id,
    name: 'Organizador 2',
    email: 'org2.routes@eventos.com',
    role: Role.ORGANIZER,
  };

  const customerUser = {
    id: customerId,
    name: 'Cliente 1',
    email: 'cliente1.routes@eventos.com',
    role: Role.CUSTOMER,
  };

  const customer2User = {
    id: customer2Id,
    name: 'Cliente 2',
    email: 'cliente2.routes@eventos.com',
    role: Role.CUSTOMER,
  };

  // Helper para validar o schema padronizado de erro retornado pelo AllExceptionsFilter
  const expectStandardErrorResponse = (res: any, expectedStatus: number) => {
    expect(res.status).toBe(expectedStatus);
    expect(res.body).toHaveProperty('statusCode', expectedStatus);
    expect(res.body).toHaveProperty('message');
    expect(res.body).toHaveProperty('error');
    expect(res.body).toHaveProperty('timestamp');
    expect(res.body).toHaveProperty('path');
    expect(res.body).toHaveProperty('method');
  };

  beforeAll(async () => {
    const salt = await bcrypt.genSalt(10);
    const passHash = await bcrypt.hash('SenhaForte@123', salt);

    mockPrisma = {
      user: {
        findUnique: jest.fn(async ({ where }) => {
          if (where.email === adminUser.email) return { ...adminUser, passwordHash: passHash };
          if (where.email === org1User.email) return { ...org1User, passwordHash: passHash };
          if (where.email === org2User.email) return { ...org2User, passwordHash: passHash };
          if (where.email === customerUser.email) return { ...customerUser, passwordHash: passHash };
          if (where.email === customer2User.email) return { ...customer2User, passwordHash: passHash };
          if (where.id === adminId) return adminUser;
          if (where.id === org1Id) return org1User;
          if (where.id === org2Id) return org2User;
          if (where.id === customerId) return customerUser;
          if (where.id === customer2Id) return customer2User;
          if (where.email === 'existente@eventos.com') return { id: 998, email: where.email };
          return null;
        }),
        create: jest.fn(async ({ data }) => ({
          id: 999,
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
        findMany: jest.fn().mockResolvedValue([adminUser, org1User, org2User, customerUser]),
        update: jest.fn(async ({ where, data }) => ({
          id: where.id,
          ...data,
        })),
        delete: jest.fn(async ({ where }) => ({ id: where.id })),
      },
      event: {
        create: jest.fn(async ({ data }) => ({
          id: event1Id,
          ...data,
          status: EventStatus.DRAFT,
          createdAt: new Date(),
          updatedAt: new Date(),
          organizer: org1User,
        })),
        findUnique: jest.fn(async ({ where }) => {
          if (where.id === event1Id) {
            return {
              id: event1Id,
              title: 'Festival da Música 2026',
              description: 'Grande festival ao vivo',
              organizerId: org1Id,
              status: EventStatus.PUBLISHED,
              startsAt: new Date('2026-11-20T20:00:00.000Z'),
              endsAt: new Date('2026-11-20T23:59:00.000Z'),
              locationCep: '01001000',
              locationAddress: 'Praça da Sé',
              locationCity: 'São Paulo',
              locationState: 'SP',
              sectors: [],
              organizer: org1User,
            };
          }
          return null;
        }),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn(async ({ where, data }) => ({
          id: where.id,
          ...data,
          organizer: org1User,
        })),
        delete: jest.fn().mockResolvedValue({ id: event1Id }),
      },
      sector: {
        create: jest.fn(async ({ data }) => ({
          id: sector1Id,
          ...data,
          batches: [],
        })),
        findUnique: jest.fn(async ({ where }) => {
          if (where.id === sector1Id) {
            return {
              id: sector1Id,
              name: 'Área VIP',
              capacity: 500,
              eventId: event1Id,
              event: { id: event1Id, organizerId: org1Id, status: EventStatus.PUBLISHED },
              batches: [],
            };
          }
          return null;
        }),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn(async ({ where, data }) => ({ id: where.id, ...data })),
        delete: jest.fn().mockResolvedValue({ id: sector1Id }),
      },
      ticketBatch: {
        create: jest.fn(async ({ data }) => ({
          id: batch1Id,
          ...data,
          availableQuantity: data.totalQuantity,
          status: BatchStatus.ACTIVE,
        })),
        findUnique: jest.fn(async ({ where }) => {
          if (where.id === batchAlmostSoldOutId) {
            return {
              id: batchAlmostSoldOutId,
              name: 'Lote Quase Esgotado',
              price: 150,
              totalQuantity: 10,
              availableQuantity: 1, // Apenas 1 disponível
              startSaleDate: new Date('2026-01-01T00:00:00.000Z'),
              endSaleDate: new Date('2026-11-19T23:59:00.000Z'),
              status: BatchStatus.ACTIVE,
              sector: {
                id: sector1Id,
                capacity: 500,
                event: {
                  id: event1Id,
                  organizerId: org1Id,
                  status: EventStatus.PUBLISHED,
                },
              },
            };
          }
          if (where.id === batch1Id) {
            return {
              id: batch1Id,
              name: 'Lote Promocional',
              price: 150,
              totalQuantity: 300,
              availableQuantity: 200,
              startSaleDate: new Date('2026-01-01T00:00:00.000Z'),
              endSaleDate: new Date('2026-11-19T23:59:00.000Z'),
              status: BatchStatus.ACTIVE,
              sector: {
                id: sector1Id,
                capacity: 500,
                event: {
                  id: event1Id,
                  organizerId: org1Id,
                  status: EventStatus.PUBLISHED,
                },
              },
            };
          }
          return null;
        }),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn(async ({ where, data }) => ({ id: where.id, ...data })),
        delete: jest.fn().mockResolvedValue({ id: batch1Id }),
      },
      purchase: {
        create: jest.fn(async ({ data }) => ({
          id: purchase1Id,
          ...data,
          status: PurchaseStatus.PAID,
          createdAt: new Date(),
        })),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(async ({ where }) => {
          if (where.id === purchase1Id) {
            return {
              id: purchase1Id,
              userId: customerId,
              totalAmount: 150,
              paymentMethod: PaymentMethod.PIX,
              status: PurchaseStatus.PAID,
              user: customerUser,
              tickets: [],
              batch: { name: 'Lote Promocional', sector: { name: 'Área VIP', event: { title: 'Festival 2026' } } },
            };
          }
          return null;
        }),
      },
      ticket: {
        create: jest.fn(async ({ data }) => ({
          id: ticket1Id,
          code: data.code,
          status: TicketStatus.VALID,
          ticketBatchId: data.ticketBatchId,
          purchaseId: data.purchaseId,
          userId: data.userId,
        })),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findFirst: jest.fn(async ({ where }) => {
          const codeMatch = where?.OR?.find((c: any) => c.code)?.code || where?.code;
          const idMatch = where?.OR?.find((c: any) => c.id !== undefined && c.id !== -1)?.id || where?.id;
          const identifier = codeMatch || idMatch;
          if (identifier === ticketUsedId || identifier === 'TKT-JA-UTILIZADO') {
            return {
              id: ticketUsedId,
              code: 'TKT-JA-UTILIZADO',
              status: TicketStatus.USED,
              checkIn: {
                checkedInAt: new Date(),
                checkedInBy: { name: 'Porteiro Carlos' },
              },
              userId: customerId,
              user: customerUser,
              batch: {
                sector: {
                  event: {
                    id: event1Id,
                    organizerId: org1Id,
                    status: EventStatus.PUBLISHED,
                  },
                },
              },
            };
          }
          if (identifier === ticket1Id || identifier === 'TKT-VALIDO-TESTE' || where?.code === 'TKT-VALIDO-TESTE') {
            return {
              id: ticket1Id,
              code: 'TKT-VALIDO-TESTE',
              status: TicketStatus.VALID,
              checkIn: null,
              userId: customerId,
              user: customerUser,
              batch: {
                sector: {
                  event: {
                    id: event1Id,
                    organizerId: org1Id,
                    status: EventStatus.PUBLISHED,
                  },
                },
              },
            };
          }
          return null;
        }),
        findUnique: jest.fn(async ({ where }) => {
          if (where.id === ticket1Id || where.code === 'TKT-VALIDO-TESTE') {
            return {
              id: ticket1Id,
              code: 'TKT-VALIDO-TESTE',
              userId: customerId,
              status: TicketStatus.VALID,
              batch: { sector: { event: { organizerId: org1Id } } },
            };
          }
          return null;
        }),
        update: jest.fn(),
      },
      checkIn: {
        create: jest.fn(async ({ data }) => ({
          id: 888,
          ...data,
          checkedInAt: new Date(),
          checkedInBy: org1User,
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

    // Obter tokens de teste para os diferentes papéis
    const login = async (email: string) => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .set('x-api-key', validApiKey)
        .send({ email, password: 'SenhaForte@123' });
      return res.body.accessToken;
    };

    adminToken = await login(adminUser.email);
    org1Token = await login(org1User.email);
    org2Token = await login(org2User.email);
    customerToken = await login(customerUser.email);
    customer2Token = await login(customer2User.email);
  });

  afterAll(async () => {
    await app.close();
  });

  // =========================================================================
  // GRUPO 1: VALIDAÇÃO GLOBAL DE API KEY (401)
  // =========================================================================
  describe('1. Segurança Global de API Key', () => {
    it('Erro 401: Deve recusar requisição sem cabeçalho x-api-key', async () => {
      const res = await request(app.getHttpServer()).get('/events');
      expectStandardErrorResponse(res, 401);
      expect(res.body.message).toContain('API Key ausente ou inválida');
    });

    it('Erro 401: Deve recusar requisição com x-api-key incorreta', async () => {
      const res = await request(app.getHttpServer())
        .get('/events')
        .set('x-api-key', 'chave-invalida-999');
      expectStandardErrorResponse(res, 401);
      expect(res.body.message).toContain('API Key ausente ou inválida');
    });
  });

  // =========================================================================
  // GRUPO 2: ROTAS DE AUTENTICAÇÃO (/auth)
  // =========================================================================
  describe('2. Módulo de Autenticação (/auth)', () => {
    it('Acerto 201: POST /auth/register - Cadastro de novo usuário com sucesso', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .set('x-api-key', validApiKey)
        .send({
          name: 'Novo Aluno',
          email: 'novo.aluno@eventos.com',
          password: 'SenhaForte@123',
          role: 'CUSTOMER',
        });
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('user');
      expect(res.body.user).not.toHaveProperty('passwordHash');
    });

    it('Erro 400: POST /auth/register - Falha com dados inválidos (class-validator)', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .set('x-api-key', validApiKey)
        .send({
          email: 'email_invalido_sem_arroba',
          password: '123', // Senha fraca < 6 chars
        });
      expectStandardErrorResponse(res, 400);
      expect(Array.isArray(res.body.message)).toBe(true);
    });

    it('Erro 409: POST /auth/register - Conflito de e-mail duplicado', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .set('x-api-key', validApiKey)
        .send({
          name: 'Usuário Duplicado',
          email: 'existente@eventos.com',
          password: 'SenhaForte@123',
        });
      expectStandardErrorResponse(res, 409);
      expect(res.body.message).toContain('Já existe um usuário cadastrado');
    });

    it('Acerto 200: POST /auth/login - Login com credenciais válidas', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .set('x-api-key', validApiKey)
        .send({
          email: customerUser.email,
          password: 'SenhaForte@123',
        });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body.user.email).toBe(customerUser.email);
    });

    it('Erro 401: POST /auth/login - Credenciais incorretas', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .set('x-api-key', validApiKey)
        .send({
          email: customerUser.email,
          password: 'SenhaErrada@999',
        });
      expectStandardErrorResponse(res, 401);
      expect(res.body.message).toContain('Credenciais inválidas');
    });
  });

  // =========================================================================
  // GRUPO 3: ROTAS DE USUÁRIOS (/users)
  // =========================================================================
  describe('3. Módulo de Usuários (/users)', () => {
    it('Acerto 200: GET /users/me - Dados do próprio usuário autenticado', async () => {
      const res = await request(app.getHttpServer())
        .get('/users/me')
        .set('x-api-key', validApiKey)
        .set('Authorization', `Bearer ${customerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(customerId);
      expect(res.body).not.toHaveProperty('passwordHash');
    });

    it('Erro 401: GET /users/me - Requisição sem Token JWT', async () => {
      const res = await request(app.getHttpServer())
        .get('/users/me')
        .set('x-api-key', validApiKey);
      expectStandardErrorResponse(res, 401);
    });

    it('Acerto 200: GET /users - ADMIN lista todos os usuários', async () => {
      const res = await request(app.getHttpServer())
        .get('/users')
        .set('x-api-key', validApiKey)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('Erro 403: GET /users - CUSTOMER sem permissão para listar usuários', async () => {
      const res = await request(app.getHttpServer())
        .get('/users')
        .set('x-api-key', validApiKey)
        .set('Authorization', `Bearer ${customerToken}`);
      expectStandardErrorResponse(res, 403);
      expect(res.body.message).toContain('Acesso negado');
    });

    it('Acerto 200: GET /users/:id - ADMIN busca usuário existente por ID', async () => {
      const res = await request(app.getHttpServer())
        .get(`/users/${customerId}`)
        .set('x-api-key', validApiKey)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(customerId);
    });

    it('Erro 404: GET /users/:id - Usuário inexistente', async () => {
      const res = await request(app.getHttpServer())
        .get('/users/999999')
        .set('x-api-key', validApiKey)
        .set('Authorization', `Bearer ${adminToken}`);
      expectStandardErrorResponse(res, 404);
      expect(res.body.message).toContain('não encontrado');
    });

    it('Erro 403: GET /users/:id - CUSTOMER sem permissão para acessar usuários por ID', async () => {
      const res = await request(app.getHttpServer())
        .get(`/users/${customer2Id}`)
        .set('x-api-key', validApiKey)
        .set('Authorization', `Bearer ${customerToken}`);
      expectStandardErrorResponse(res, 403);
      expect(res.body.message).toContain('Acesso negado');
    });

    it('Acerto 200: PATCH /users/:id - Atualizar dados do próprio usuário', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/users/${customerId}`)
        .set('x-api-key', validApiKey)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ name: 'Nome Atualizado' });
      expect(res.status).toBe(200);
    });

    it('Erro 403: PATCH /users/:id - Usuário tentando atualizar dados de outro', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/users/${customer2Id}`)
        .set('x-api-key', validApiKey)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ name: 'Nome Invasor' });
      expectStandardErrorResponse(res, 403);
      expect(res.body.message).toContain('permissão');
    });

    it('Acerto 200: DELETE /users/:id - ADMIN exclui usuário', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/users/${customerId}`)
        .set('x-api-key', validApiKey)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
    });

    it('Erro 403: DELETE /users/:id - CUSTOMER tentando excluir usuário', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/users/${customer2Id}`)
        .set('x-api-key', validApiKey)
        .set('Authorization', `Bearer ${customerToken}`);
      expectStandardErrorResponse(res, 403);
    });
  });

  // =========================================================================
  // GRUPO 4: ROTAS DE EVENTOS (/events)
  // =========================================================================
  describe('4. Módulo de Eventos (/events)', () => {
    it('Acerto 200: GET /events - Listagem pública de eventos', async () => {
      const res = await request(app.getHttpServer())
        .get('/events')
        .set('x-api-key', validApiKey);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('Acerto 200: GET /events/:id - Consulta de evento por ID', async () => {
      const res = await request(app.getHttpServer())
        .get(`/events/${event1Id}`)
        .set('x-api-key', validApiKey);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(event1Id);
    });

    it('Erro 404: GET /events/:id - Evento inexistente', async () => {
      const res = await request(app.getHttpServer())
        .get('/events/999999')
        .set('x-api-key', validApiKey);
      expectStandardErrorResponse(res, 404);
      expect(res.body.message).toContain('não encontrado');
    });

    it('Acerto 201: POST /events - ORGANIZER cria evento com sucesso', async () => {
      const res = await request(app.getHttpServer())
        .post('/events')
        .set('x-api-key', validApiKey)
        .set('Authorization', `Bearer ${org1Token}`)
        .send({
          title: 'Summit de Tecnologia 2026',
          description: 'Maior conferência de TI',
          locationCep: '01001000',
          locationAddress: 'Av Paulista, 1000',
          locationCity: 'São Paulo',
          locationState: 'SP',
          startsAt: '2026-12-10T10:00:00.000Z',
          endsAt: '2026-12-10T18:00:00.000Z',
        });
      expect(res.status).toBe(201);
      expect(res.body.id).toBe(event1Id);
    });

    it('Erro 400: POST /events - Data de término anterior à de início', async () => {
      const res = await request(app.getHttpServer())
        .post('/events')
        .set('x-api-key', validApiKey)
        .set('Authorization', `Bearer ${org1Token}`)
        .send({
          title: 'Evento Data Invertida',
          description: 'Descrição de teste',
          locationCep: '01001000',
          locationAddress: 'Rua das Flores',
          locationCity: 'São Paulo',
          locationState: 'SP',
          startsAt: '2026-12-10T18:00:00.000Z',
          endsAt: '2026-12-10T10:00:00.000Z', // Invertido!
        });
      expectStandardErrorResponse(res, 400);
      expect(res.body.message).toContain('posterior à data/hora de início');
    });

    it('Erro 403: POST /events - CUSTOMER sem permissão para criar evento', async () => {
      const res = await request(app.getHttpServer())
        .post('/events')
        .set('x-api-key', validApiKey)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          title: 'Tentativa Proibida',
          description: 'Teste',
          locationCep: '01001000',
          locationAddress: 'Rua',
          locationCity: 'SP',
          locationState: 'SP',
          startsAt: '2026-11-20T20:00:00.000Z',
          endsAt: '2026-11-20T23:59:00.000Z',
        });
      expectStandardErrorResponse(res, 403);
      expect(res.body.message).toContain('Acesso negado');
    });

    it('Acerto 200: PATCH /events/:id - ORGANIZER atualiza seu próprio evento', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/events/${event1Id}`)
        .set('x-api-key', validApiKey)
        .set('Authorization', `Bearer ${org1Token}`)
        .send({ title: 'Festival 2026 - Edição Especial' });
      expect(res.status).toBe(200);
    });

    it('Erro 403: PATCH /events/:id - ORGANIZER 2 tentando alterar evento do ORGANIZER 1 (IDOR)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/events/${event1Id}`)
        .set('x-api-key', validApiKey)
        .set('Authorization', `Bearer ${org2Token}`)
        .send({ title: 'Tentativa Invasora' });
      expectStandardErrorResponse(res, 403);
      expect(res.body.message).toContain('outros organizadores');
    });

    it('Erro 409: PATCH /events/:id/status - Não permite publicar evento sem setores', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/events/${event1Id}/status`)
        .set('x-api-key', validApiKey)
        .set('Authorization', `Bearer ${org1Token}`)
        .send({ status: 'PUBLISHED' });
      expectStandardErrorResponse(res, 409);
      expect(res.body.message).toContain('pelo menos um setor');
    });

    it('Erro 400: POST /events/:id/banner - Rejeitar upload de arquivo de texto (.txt)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/events/${event1Id}/banner`)
        .set('x-api-key', validApiKey)
        .set('Authorization', `Bearer ${org1Token}`)
        .attach('file', Buffer.from('conteúdo texto'), 'arquivo.txt');
      expectStandardErrorResponse(res, 400);
    });
  });

  // =========================================================================
  // GRUPO 5: ROTAS DE SETORES (/sectors)
  // =========================================================================
  describe('5. Módulo de Setores (/sectors)', () => {
    it('Acerto 201: POST /sectors - Criar setor com sucesso', async () => {
      const res = await request(app.getHttpServer())
        .post('/sectors')
        .set('x-api-key', validApiKey)
        .set('Authorization', `Bearer ${org1Token}`)
        .send({
          name: 'Camarote Prime',
          capacity: 250,
          eventId: event1Id,
        });
      expect(res.status).toBe(201);
      expect(res.body.id).toBe(sector1Id);
    });

    it('Erro 400: POST /sectors - Capacidade inválida (não numérica ou zero)', async () => {
      const res = await request(app.getHttpServer())
        .post('/sectors')
        .set('x-api-key', validApiKey)
        .set('Authorization', `Bearer ${org1Token}`)
        .send({
          name: 'Setor Inválido',
          capacity: -10, // Inválido
          eventId: event1Id,
        });
      expectStandardErrorResponse(res, 400);
    });

    it('Erro 403: POST /sectors - ORGANIZER 2 tentando criar setor no evento 1', async () => {
      const res = await request(app.getHttpServer())
        .post('/sectors')
        .set('x-api-key', validApiKey)
        .set('Authorization', `Bearer ${org2Token}`)
        .send({
          name: 'Setor Invasor',
          capacity: 100,
          eventId: event1Id,
        });
      expectStandardErrorResponse(res, 403);
      expect(res.body.message).toContain('terceiros');
    });

    it('Acerto 200: GET /sectors/event/:eventId - Listar setores de um evento', async () => {
      const res = await request(app.getHttpServer())
        .get(`/sectors/event/${event1Id}`)
        .set('x-api-key', validApiKey);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('Acerto 200: GET /sectors/:id - Buscar setor por ID', async () => {
      const res = await request(app.getHttpServer())
        .get(`/sectors/${sector1Id}`)
        .set('x-api-key', validApiKey);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(sector1Id);
    });

    it('Erro 404: GET /sectors/:id - Setor inexistente', async () => {
      const res = await request(app.getHttpServer())
        .get('/sectors/999999')
        .set('x-api-key', validApiKey);
      expectStandardErrorResponse(res, 404);
      expect(res.body.message).toContain('não encontrado');
    });

    it('Acerto 200: PATCH /sectors/:id - Atualizar dados do setor', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/sectors/${sector1Id}`)
        .set('x-api-key', validApiKey)
        .set('Authorization', `Bearer ${org1Token}`)
        .send({ name: 'Área VIP Gold' });
      expect(res.status).toBe(200);
    });

    it('Erro 403: PATCH /sectors/:id - ORGANIZER 2 tentando alterar setor do evento 1', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/sectors/${sector1Id}`)
        .set('x-api-key', validApiKey)
        .set('Authorization', `Bearer ${org2Token}`)
        .send({ name: 'Área Modificada' });
      expectStandardErrorResponse(res, 403);
    });

    it('Acerto 200: DELETE /sectors/:id - Excluir setor pelo dono', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/sectors/${sector1Id}`)
        .set('x-api-key', validApiKey)
        .set('Authorization', `Bearer ${org1Token}`);
      expect(res.status).toBe(200);
    });
  });

  // =========================================================================
  // GRUPO 6: ROTAS DE LOTES DE INGRESSOS (/ticket-batches)
  // =========================================================================
  describe('6. Módulo de Lotes de Ingressos (/ticket-batches)', () => {
    it('Acerto 201: POST /ticket-batches - Criar lote válido', async () => {
      const res = await request(app.getHttpServer())
        .post('/ticket-batches')
        .set('x-api-key', validApiKey)
        .set('Authorization', `Bearer ${org1Token}`)
        .send({
          name: 'Lote Oficial',
          price: 150,
          totalQuantity: 200,
          startSaleDate: '2026-01-01T00:00:00.000Z',
          endSaleDate: '2026-11-19T23:59:00.000Z',
          sectorId: sector1Id,
        });
      expect(res.status).toBe(201);
      expect(res.body.id).toBe(batch1Id);
    });

    it('Erro 409: POST /ticket-batches - Capacidade do setor excedida', async () => {
      const res = await request(app.getHttpServer())
        .post('/ticket-batches')
        .set('x-api-key', validApiKey)
        .set('Authorization', `Bearer ${org1Token}`)
        .send({
          name: 'Lote Gigante',
          price: 150,
          totalQuantity: 800, // Maior que os 500 do setor
          startSaleDate: '2026-01-01T00:00:00.000Z',
          endSaleDate: '2026-11-19T23:59:00.000Z',
          sectorId: sector1Id,
        });
      expectStandardErrorResponse(res, 409);
      expect(res.body.message).toContain('Capacidade restante');
    });

    it('Acerto 200: GET /ticket-batches/sector/:sectorId - Listar lotes do setor', async () => {
      const res = await request(app.getHttpServer())
        .get(`/ticket-batches/sector/${sector1Id}`)
        .set('x-api-key', validApiKey);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('Acerto 200: GET /ticket-batches/:id - Buscar lote por ID', async () => {
      const res = await request(app.getHttpServer())
        .get(`/ticket-batches/${batch1Id}`)
        .set('x-api-key', validApiKey);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(batch1Id);
    });

    it('Erro 404: GET /ticket-batches/:id - Lote inexistente', async () => {
      const res = await request(app.getHttpServer())
        .get('/ticket-batches/999999')
        .set('x-api-key', validApiKey);
      expectStandardErrorResponse(res, 404);
      expect(res.body.message).toContain('não encontrado');
    });

    it('Acerto 200: PATCH /ticket-batches/:id - Atualizar lote', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/ticket-batches/${batch1Id}`)
        .set('x-api-key', validApiKey)
        .set('Authorization', `Bearer ${org1Token}`)
        .send({ price: 160 });
      expect(res.status).toBe(200);
    });

    it('Acerto 200: DELETE /ticket-batches/:id - Excluir lote', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/ticket-batches/${batch1Id}`)
        .set('x-api-key', validApiKey)
        .set('Authorization', `Bearer ${org1Token}`);
      expect(res.status).toBe(200);
    });
  });

  // =========================================================================
  // GRUPO 7: ROTAS DE COMPRAS (/purchases)
  // =========================================================================
  describe('7. Módulo de Compras (/purchases)', () => {
    it('Acerto 201: POST /purchases - Realizar compra com sucesso', async () => {
      const res = await request(app.getHttpServer())
        .post('/purchases')
        .set('x-api-key', validApiKey)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          ticketBatchId: batch1Id,
          quantity: 2,
          paymentMethod: 'PIX',
        });
      expect(res.status).toBe(201);
      expect(res.body.id).toBe(purchase1Id);
    });

    it('Erro 400: POST /purchases - Quantidade inválida (0 ingressos)', async () => {
      const res = await request(app.getHttpServer())
        .post('/purchases')
        .set('x-api-key', validApiKey)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          ticketBatchId: batch1Id,
          quantity: 0, // Mínimo é 1
          paymentMethod: 'PIX',
        });
      expectStandardErrorResponse(res, 400);
    });

    it('Erro 409: POST /purchases - Quantidade solicitada indisponível no lote', async () => {
      const res = await request(app.getHttpServer())
        .post('/purchases')
        .set('x-api-key', validApiKey)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          ticketBatchId: batchAlmostSoldOutId,
          quantity: 3, // Lote tem apenas 1 disponível
          paymentMethod: 'CREDIT_CARD',
        });
      expectStandardErrorResponse(res, 409);
      expect(res.body.message).toContain('indisponível');
    });

    it('Acerto 200: GET /purchases - Listar compras do usuário autenticado', async () => {
      const res = await request(app.getHttpServer())
        .get('/purchases')
        .set('x-api-key', validApiKey)
        .set('Authorization', `Bearer ${customerToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('Acerto 200: GET /purchases/:id - Detalhes da compra pelo comprador', async () => {
      const res = await request(app.getHttpServer())
        .get(`/purchases/${purchase1Id}`)
        .set('x-api-key', validApiKey)
        .set('Authorization', `Bearer ${customerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(purchase1Id);
    });

    it('Erro 403: GET /purchases/:id - Usuário tentando ver compra de outro usuário', async () => {
      const res = await request(app.getHttpServer())
        .get(`/purchases/${purchase1Id}`)
        .set('x-api-key', validApiKey)
        .set('Authorization', `Bearer ${customer2Token}`);
      expectStandardErrorResponse(res, 403);
      expect(res.body.message).toContain('terceiros');
    });

    it('Erro 404: GET /purchases/:id - Compra inexistente', async () => {
      const res = await request(app.getHttpServer())
        .get('/purchases/999999')
        .set('x-api-key', validApiKey)
        .set('Authorization', `Bearer ${customerToken}`);
      expectStandardErrorResponse(res, 404);
      expect(res.body.message).toContain('não encontrada');
    });
  });

  // =========================================================================
  // GRUPO 8: ROTAS DE INGRESSOS (/tickets)
  // =========================================================================
  describe('8. Módulo de Ingressos (/tickets)', () => {
    it('Acerto 200: GET /tickets/my-tickets - Meus ingressos', async () => {
      const res = await request(app.getHttpServer())
        .get('/tickets/my-tickets')
        .set('x-api-key', validApiKey)
        .set('Authorization', `Bearer ${customerToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('Acerto 200: GET /tickets/code/:code - Consulta de ingresso por código único', async () => {
      const res = await request(app.getHttpServer())
        .get('/tickets/code/TKT-VALIDO-TESTE')
        .set('x-api-key', validApiKey)
        .set('Authorization', `Bearer ${customerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.code).toBe('TKT-VALIDO-TESTE');
    });

    it('Erro 404: GET /tickets/code/:code - Código de ingresso não encontrado', async () => {
      const res = await request(app.getHttpServer())
        .get('/tickets/code/TKT-INEXISTENTE-999')
        .set('x-api-key', validApiKey)
        .set('Authorization', `Bearer ${customerToken}`);
      expectStandardErrorResponse(res, 404);
      expect(res.body.message).toContain('não encontrado');
    });

    it('Acerto 200: GET /tickets/:id - Consulta de ingresso por ID', async () => {
      const res = await request(app.getHttpServer())
        .get(`/tickets/${ticket1Id}`)
        .set('x-api-key', validApiKey)
        .set('Authorization', `Bearer ${customerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(ticket1Id);
    });

    it('Erro 403: GET /tickets/:id - Usuário tentando acessar ingresso de outro usuário', async () => {
      const res = await request(app.getHttpServer())
        .get(`/tickets/${ticket1Id}`)
        .set('x-api-key', validApiKey)
        .set('Authorization', `Bearer ${customer2Token}`);
      expectStandardErrorResponse(res, 403);
      expect(res.body.message).toContain('permissão');
    });
  });

  // =========================================================================
  // GRUPO 9: ROTAS DE CHECK-IN (/check-ins)
  // =========================================================================
  describe('9. Módulo de Check-in (/check-ins)', () => {
    it('Acerto 201: POST /check-ins - Realizar check-in com sucesso', async () => {
      const res = await request(app.getHttpServer())
        .post('/check-ins')
        .set('x-api-key', validApiKey)
        .set('Authorization', `Bearer ${org1Token}`)
        .send({
          ticketIdentifier: 'TKT-VALIDO-TESTE',
          notes: 'Entrada Principal',
        });
      expect(res.status).toBe(201);
      expect(res.body.message).toContain('sucesso');
    });

    it('Erro 404: POST /check-ins - Ingresso inexistente para check-in', async () => {
      const res = await request(app.getHttpServer())
        .post('/check-ins')
        .set('x-api-key', validApiKey)
        .set('Authorization', `Bearer ${org1Token}`)
        .send({
          ticketIdentifier: 'TKT-FALSO-000',
        });
      expectStandardErrorResponse(res, 404);
      expect(res.body.message).toContain('não encontrado');
    });

    it('Erro 409: POST /check-ins - Ingresso já utilizado anteriormente', async () => {
      const res = await request(app.getHttpServer())
        .post('/check-ins')
        .set('x-api-key', validApiKey)
        .set('Authorization', `Bearer ${org1Token}`)
        .send({
          ticketIdentifier: 'TKT-JA-UTILIZADO',
        });
      expectStandardErrorResponse(res, 409);
      expect(res.body.message).toContain('já foi utilizado');
    });

    it('Erro 403: POST /check-ins - ORGANIZER 2 tentando validar ingresso do evento 1', async () => {
      const res = await request(app.getHttpServer())
        .post('/check-ins')
        .set('x-api-key', validApiKey)
        .set('Authorization', `Bearer ${org2Token}`)
        .send({
          ticketIdentifier: 'TKT-VALIDO-TESTE',
        });
      expectStandardErrorResponse(res, 403);
      expect(res.body.message).toContain('outros organizadores');
    });

    it('Acerto 200: GET /check-ins/event/:eventId - Listar check-ins do evento', async () => {
      const res = await request(app.getHttpServer())
        .get(`/check-ins/event/${event1Id}`)
        .set('x-api-key', validApiKey)
        .set('Authorization', `Bearer ${org1Token}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('Erro 403: GET /check-ins/event/:eventId - ORGANIZER 2 tentando listar check-ins do evento 1', async () => {
      const res = await request(app.getHttpServer())
        .get(`/check-ins/event/${event1Id}`)
        .set('x-api-key', validApiKey)
        .set('Authorization', `Bearer ${org2Token}`);
      expectStandardErrorResponse(res, 403);
      expect(res.body.message).toContain('relatório de check-ins');
    });
  });

  // =========================================================================
  // GRUPO 10: ROTAS EXTERNAS (/external)
  // =========================================================================
  describe('10. Módulo de Serviços Externos (/external)', () => {
    it('Acerto 200: GET /external/cep/:cep - Consulta de CEP válida via ViaCEP', async () => {
      const res = await request(app.getHttpServer())
        .get('/external/cep/01001000')
        .set('x-api-key', validApiKey);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('cep');
      expect(res.body).toHaveProperty('logradouro');
      expect(res.body).toHaveProperty('localidade');
    });

    it('Erro 400: GET /external/cep/:cep - CEP com formato inválido (menos de 8 dígitos)', async () => {
      const res = await request(app.getHttpServer())
        .get('/external/cep/123')
        .set('x-api-key', validApiKey);
      expectStandardErrorResponse(res, 400);
      expect(res.body.message).toContain('CEP inválido');
    });

    it('Acerto 200: GET /external/feriados - Consulta de feriados nacionais', async () => {
      const res = await request(app.getHttpServer())
        .get('/external/feriados')
        .set('x-api-key', validApiKey);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });
});
