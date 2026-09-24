# 🎟️ Plataforma de Eventos e Ingressos — API Backend Completa

Backend profissional e escalável desenvolvido em **NestJS** e **TypeScript** com persistência relacional via **Prisma ORM** e **PostgreSQL**, arquitetura modular, controle de acesso baseado em papéis (**RBAC**), upload validado de banners, integração externa com **HttpService**, interceptors de performance/logging e validação estrita de integridade e regras de negócio.

---

## 🚀 Sumário

- [Tecnologias Utilizadas](#-tecnologias-utilizadas)
- [Arquitetura e Estrutura do Projeto](#-arquitetura-e-estrutura-do-projeto)
- [Matriz de Perfis e Permissões (RBAC)](#-matriz-de-perfis-e-permissões-rbac)
- [Regras de Negócio e Conflitos Tratados](#-regras-de-negócio-e-conflitos-tratados)
- [Segurança e Performance](#-segurança-e-performance)
- [Interceptors e Filtros Globais](#-interceptors-e-filtros-globais)
- [Integração Externa (HttpService)](#-integração-externa-httpservice)
- [Instalação e Execução](#-instalação-e-execução)
- [Documentação Completa dos Endpoints](#-documentação-completa-dos-endpoints)
- [Exemplos de Requisição (cURL)](#-exemplos-de-requisição-curl)
- [Testes Automatizados](#-testes-automatizados)

---

## 🛠 Tecnologias Utilizadas

- **Framework**: [NestJS](https://nestjs.com/) v10+ (Node.js runtime v24)
- **Linguagem**: [TypeScript](https://www.typescriptlang.org/)
- **ORM**: [Prisma](https://www.prisma.io/) v7.10.0 com `@prisma/adapter-pg`
- **Banco de Dados**: PostgreSQL 16
- **Autenticação**: Passport JWT, Bcrypt
- **Validação de Dados**: Class-Validator, Class-Transformer
- **Upload de Arquivos**: Multer, ParseFilePipe
- **Segurança & Otimização**: Helmet, Compression
- **Integração HTTP Externa**: `@nestjs/axios` (Axios + RxJS)
- **Documentação de API**: Swagger / OpenAPI 3.0
- **Testes**: Jest, Supertest

---

## 📁 Arquitetura e Estrutura do Projeto

```
projeto_Backend/
├── prisma/
│   ├── migrations/              # Histórico versionado de migrações SQL
│   ├── schema.prisma            # Modelagem relacional e enums
│   └── seed.ts                  # Script de população do banco de dados
├── src/
│   ├── common/                  # Recursos transversais e reutilizáveis
│   │   ├── decorators/          # @CurrentUser(), @Roles(), @Public()
│   │   ├── enums/               # Role (CUSTOMER, ORGANIZER, ADMIN)
│   │   ├── filters/             # AllExceptionsFilter (400, 401, 403, 404, 409)
│   │   ├── guards/              # JwtAuthGuard, RolesGuard
│   │   └── interceptors/        # LoggingInterceptor (latência e auditoria)
│   ├── database/                # Conexão e ciclo de vida do Prisma Client
│   ├── modules/
│   │   ├── auth/                # Registro, login e emissão de tokens JWT
│   │   ├── users/               # Gestão de usuários e proteção de dados pessoais
│   │   ├── events/              # Gestão de eventos e upload de banners
│   │   ├── sectors/             # Setores físicos e capacidade
│   │   ├── ticket-batches/      # Lotes de ingressos, datas de vigência e preços
│   │   ├── purchases/           # Compras atômicas com controle de estoque
│   │   ├── tickets/             # Consulta e emissão de QR Codes
│   │   ├── check-ins/           # Validação única de entrada no evento
│   │   └── external/            # Integração com ViaCEP e Feriados via HttpService
│   ├── app.module.ts            # Módulo raiz
│   └── main.ts                  # Ponto de entrada (Helmet, Compression, Swagger)
├── uploads/                     # Armazenamento estático de banners
├── test/                        # Suíte de testes E2E e regras de negócio
├── docker-compose.yml           # Subida rápida de PostgreSQL
└── README.md
```

---

## 👥 Matriz de Perfis e Permissões (RBAC)

A plataforma possui três perfis de usuário com restrições explícitas:

| Recurso / Ação | CUSTOMER | ORGANIZER | ADMIN |
|---|:---:|:---:|:---:|
| Registro público / Login | ✅ / ✅ | ✅ / ✅ | ❌ / ✅ |
| Consultar Eventos Públicos | ✅ | ✅ | ✅ |
| Criar Eventos e Gerenciar Setores/Lotes | ❌ | ✅ (Apenas próprios) | ✅ (Todos) |
| Upload de Banner do Evento | ❌ | ✅ (Apenas próprios) | ✅ (Todos) |
| Comprar Ingressos | ✅ | ✅ | ✅ |
| Visualizar Ingressos e Compras | Próprios | Próprios | Todos |
| Realizar Check-in de Ingressos | ❌ | ✅ (Apenas seus eventos) | ✅ (Todos) |
| Listagem e Gestão Geral de Usuários | ❌ | ❌ | ✅ |

> **Proteção contra IDOR (Insecure Direct Object Reference):** Usuários não podem manipular nem visualizar dados de terceiros alterando identificadores numéricos na URL ou no corpo da requisição. Tentativas disparam `403 Forbidden`.

---

## ⚖️ Regras de Negócio e Conflitos Tratados

1. **Capacidade por Setor e Lote**:
   - A soma do total de ingressos de todos os lotes de um setor não pode ultrapassar a capacidade máxima definida para o setor físico. Caso ultrapasse, retorna `409 Conflict`.
2. **Venda Somente no Período de Vigência**:
   - Ingressos só podem ser comprados se o evento estiver publicado (`PUBLISHED`), o lote estiver ativo (`ACTIVE`) e o momento da compra estiver estritamente entre `startSaleDate` e `endSaleDate`. Fora disso, retorna `409 Conflict`.
3. **Controle Atômico de Estoque**:
   - A compra reserva o saldo por atualização condicional dentro de `$transaction`. Se outra compra consumir o último ingresso, a operação responde `409 Conflict`.
4. **Check-in Único**:
   - Cada ingresso possui status `VALID`. Ao realizar a entrada, o status é alterado para `USED` e o registro de auditoria é gravado com data, hora e operador. Qualquer tentativa subsequente de reutilização é rejeitada com `409 Conflict`.
5. **Transições de Estado do Evento**:
   - Para ser publicado (`PUBLISHED`), o evento rascunho (`DRAFT`) deve possuir obrigatoriamente pelo menos 1 setor e 1 lote de ingressos cadastrado.
   - Eventos cancelados (`CANCELLED`) não podem ser reativados e bloqueiam compras e check-ins.
6. **Dados Sensíveis**:
   - Hashes de senha (`passwordHash`) e segredos nunca são retornados em nenhuma resposta da API.

---

## 🛡️ Segurança e Performance

- **Helmet**: Cabeçalhos HTTP seguros habilitados para proteção contra ataques comuns (XSS, clickjacking, MIME sniffing).
- **Compression**: Compressão gzip ativada globalmente para reduzir tráfego e latência de payload.
- **ValidationPipe Global**: Configurado com `whitelist: true` e `forbidNonWhitelisted: true`, rejeitando campos não declarados nos DTOs (`400 Bad Request`).
- **Senhas Seguras**: Criptografia de senhas com `bcrypt` utilizando 10 rounds de salt.
- **Variáveis de Ambiente**: `.env` mantido fora do Git, com `.env.example` versionado como template de configuração.

---

## ⚡ Interceptors e Filtros Globais

### LoggingInterceptor
Registrado globalmente no `main.ts`, monitora o ciclo de vida de cada requisição registrando de forma estruturada:
- Método HTTP e rota acessada;
- Status code da resposta;
- Tempo de resposta em milissegundos (`duration ms`);
- Identificador e papel do usuário autenticado (ou `[Anonymous]`);
- Endereço IP de origem;
- Mascaramento e proteção de dados confidenciais nos logs.

### AllExceptionsFilter
Centraliza o tratamento de exceções garantindo payload uniforme:
```json
{
  "statusCode": 409,
  "timestamp": "2026-09-21T14:40:00.000Z",
  "path": "/ticket-batches",
  "method": "POST",
  "error": "Conflict",
  "message": "A capacidade total do setor é de 500 ingressos. Quantidade solicitada excede a capacidade."
}
```

---

## 🌐 Integração Externa (HttpService)

A aplicação utiliza o `@nestjs/axios` para integrar serviços externos:
- **ViaCEP (`https://viacep.com.br/ws/${cep}/json/`)**: Consulta de endereços e validação automática de localização para os eventos.
- **Feriados Nacionais (`https://brasilapi.com.br/api/feriados/v1/${ano}`)**: Identificação de feriados no calendário de eventos.
- **Resiliência**:
  - Timeout configurado via `.env` (`EXTERNAL_API_TIMEOUT`);
  - Tratamento controlado de erros com timeout (`504 Gateway Timeout`), CEP inválido (`400 Bad Request`) e CEP não encontrado (`404 Not Found`).

---

## 🚀 Instalação e Execução

### Pré-requisitos
- Node.js v18+ (testado no v24)
- PostgreSQL (ou Docker)

### 1. Clonar e Instalar Dependências
```bash
cd C:\Projetos\projeto_Backend
npm install
```

### 2. Configurar o Ambiente
Copie o arquivo de exemplo e ajuste as variáveis caso necessário:
```bash
cp .env.example .env
```

Defina `DATABASE_URL`, `JWT_SECRET` e `API_KEY` no `.env` antes de iniciar. Os dois segredos estão vazios no exemplo por segurança; gere valores aleatórios exclusivos para o seu ambiente. Em PowerShell, use `Copy-Item .env.example .env` para copiar o arquivo. A aplicação falha na inicialização se uma dessas variáveis estiver ausente.

### 3. Subir o Banco de Dados (Docker - Opcional)
```bash
docker compose up -d
```

### 4. Executar Migrações e Seed
```bash
# Executa migrações do Prisma
npx prisma migrate deploy

# Opcional: popula o banco com usuários e eventos de demonstração.
# Atenção: o seed remove os dados atuais antes de inserir os exemplos.
npm run seed
```

Esta migration inicial foi corrigida para IDs inteiros e exclusões que preservam compras/ingressos. Para um banco novo, use `migrate deploy`. Se outro ambiente já aplicou a versão antiga da migration, faça backup e planeje a conversão dos IDs e o histórico de migrations antes de atualizar; não reaplique a migration inicial sobre dados existentes. Bancos de desenvolvimento criados com `prisma db push` precisam ser comparados ao schema antes de registrar a migration como baseline.

### 5. Executar a Aplicação
```bash
# Modo de desenvolvimento
npm run start:dev

# Build e execução em produção
npm run build
npm run start:prod
```

A API estará disponível em: `http://localhost:3000`  
Documentação Swagger interativa: `http://localhost:3000/api/docs`

---

## 📋 Documentação Completa dos Endpoints

### 🔐 Autenticação (`/auth`)

| Método | Endpoint | Permissão | Body / Parâmetros | Descrição | Status Sucesso | Principais Erros |
|---|---|---|---|---|:---:|:---:|
| `POST` | `/auth/register` | Pública | `{ name, email, password, role?, phone? }` | Cadastrar novo usuário | `201 Created` | `400`, `409` |
| `POST` | `/auth/login` | Pública | `{ email, password }` | Autenticar e obter JWT | `200 OK` | `400`, `401` |

### 👤 Usuários (`/users`)

| Método | Endpoint | Permissão | Body / Parâmetros | Descrição | Status Sucesso | Principais Erros |
|---|---|---|---|---|:---:|:---:|
| `GET` | `/users/me` | Autenticado | N/A | Dados do próprio perfil | `200 OK` | `401` |
| `GET` | `/users` | `ADMIN` | N/A | Listar todos os usuários | `200 OK` | `401`, `403` |
| `GET` | `/users/:id` | `ADMIN` | `:id` (Int) | Buscar usuário por ID | `200 OK` | `401`, `403`, `404` |
| `PATCH` | `/users/:id` | Próprio / `ADMIN` | `{ name?, email?, password?, phone? }` | Atualizar dados | `200 OK` | `400`, `401`, `403`, `404` |
| `DELETE` | `/users/:id` | Próprio / `ADMIN` | `:id` (Int) | Excluir conta | `200 OK` | `401`, `403`, `404` |

### 🎪 Eventos (`/events`)

| Método | Endpoint | Permissão | Body / Parâmetros | Descrição | Status Sucesso | Principais Erros |
|---|---|---|---|---|:---:|:---:|
| `POST` | `/events` | `ORGANIZER`, `ADMIN` | `{ title, description, locationCep, locationAddress, locationCity, locationState, startsAt, endsAt }` | Criar evento (DRAFT) | `201 Created` | `400`, `401`, `403` |
| `GET` | `/events` | Pública | N/A | Listar eventos disponíveis | `200 OK` | - |
| `GET` | `/events/:id` | Pública | `:id` (Int) | Obter detalhes do evento | `200 OK` | `404` |
| `PATCH` | `/events/:id` | Dono / `ADMIN` | `{ title?, description?, startsAt?, endsAt?... }` | Atualizar evento | `200 OK` | `400`, `401`, `403`, `404`, `409` |
| `PATCH` | `/events/:id/status` | Dono / `ADMIN` | `{ status: "PUBLISHED" \| "CANCELLED" \| "FINISHED" }` | Alterar estado | `200 OK` | `400`, `401`, `403`, `404`, `409` |
| `POST` | `/events/:id/banner` | Dono / `ADMIN` | `multipart/form-data` (`file`) | Upload de banner (JPG/PNG/WEBP até 5MB) | `200 OK` | `400`, `401`, `403`, `404` |
| `DELETE` | `/events/:id` | Dono / `ADMIN` | `:id` (Int) | Excluir evento sem ingressos | `200 OK` | `401`, `403`, `404`, `409` |

### 🏷️ Setores (`/sectors`)

| Método | Endpoint | Permissão | Body / Parâmetros | Descrição | Status Sucesso | Principais Erros |
|---|---|---|---|---|:---:|:---:|
| `POST` | `/sectors` | Dono do evento / `ADMIN` | `{ name, capacity, eventId }` | Cadastrar setor | `201 Created` | `400`, `401`, `403`, `404` |
| `GET` | `/sectors/event/:eventId` | Pública | `:eventId` (Int) | Setores de um evento | `200 OK` | `404` |
| `GET` | `/sectors/:id` | Pública | `:id` (Int) | Detalhes do setor | `200 OK` | `404` |
| `PATCH` | `/sectors/:id` | Dono / `ADMIN` | `{ name?, capacity? }` | Atualizar setor | `200 OK` | `400`, `401`, `403`, `404`, `409` |
| `DELETE` | `/sectors/:id` | Dono / `ADMIN` | `:id` (Int) | Excluir setor | `200 OK` | `401`, `403`, `404`, `409` |

### 🎟️ Lotes de Ingressos (`/ticket-batches`)

| Método | Endpoint | Permissão | Body / Parâmetros | Descrição | Status Sucesso | Principais Erros |
|---|---|---|---|---|:---:|:---:|
| `POST` | `/ticket-batches` | Dono do evento / `ADMIN` | `{ name, price, totalQuantity, startSaleDate, endSaleDate, sectorId }` | Criar lote | `201 Created` | `400`, `401`, `403`, `404`, `409` |
| `GET` | `/ticket-batches/sector/:sectorId` | Pública | `:sectorId` (Int) | Lotes do setor | `200 OK` | `404` |
| `GET` | `/ticket-batches/:id` | Pública | `:id` (Int) | Detalhes do lote | `200 OK` | `404` |
| `PATCH` | `/ticket-batches/:id` | Dono / `ADMIN` | `{ name?, price?, startSaleDate?, endSaleDate?, status? }` | Atualizar lote | `200 OK` | `400`, `401`, `403`, `404` |
| `DELETE` | `/ticket-batches/:id` | Dono / `ADMIN` | `:id` (Int) | Excluir lote sem vendas | `200 OK` | `401`, `403`, `404`, `409` |

### 💳 Compras e Ingressos (`/purchases` e `/tickets`)

| Método | Endpoint | Permissão | Body / Parâmetros | Descrição | Status Sucesso | Principais Erros |
|---|---|---|---|---|:---:|:---:|
| `POST` | `/purchases` | Autenticado | `{ ticketBatchId, quantity, paymentMethod }` | Compra atômica | `201 Created` | `400`, `401`, `404`, `409` |
| `GET` | `/purchases` | Autenticado | N/A | Minhas compras (`ADMIN` vê todas) | `200 OK` | `401` |
| `GET` | `/purchases/:id` | Próprio / `ADMIN` | `:id` (Int) | Detalhes da compra | `200 OK` | `401`, `403`, `404` |
| `GET` | `/tickets/my-tickets` | Autenticado | N/A | Meus ingressos emitidos | `200 OK` | `401` |
| `GET` | `/tickets/code/:code` | Titular / Dono / `ADMIN` | `:code` (ex: `TKT-...`) | Detalhes por código | `200 OK` | `401`, `403`, `404` |

### 🚪 Controle de Entrada (Check-In) (`/check-ins`)

| Método | Endpoint | Permissão | Body / Parâmetros | Descrição | Status Sucesso | Principais Erros |
|---|---|---|---|---|:---:|:---:|
| `POST` | `/check-ins` | Dono do evento / `ADMIN` | `{ ticketIdentifier, notes? }` | Validar entrada única (aceita ID ou código) | `201 Created` | `400`, `401`, `403`, `404`, `409` |
| `GET` | `/check-ins/event/:eventId` | Dono / `ADMIN` | `:eventId` (Int) | Relatório de entradas | `200 OK` | `401`, `403`, `404` |

### 🌍 Integrações Externas (`/external`)

| Método | Endpoint | Permissão | Body / Parâmetros | Descrição | Status Sucesso | Principais Erros |
|---|---|---|---|---|:---:|:---:|
| `GET` | `/external/cep/:cep` | Pública | `:cep` (8 dígitos) | Consultar ViaCEP | `200 OK` | `400`, `404`, `504` |
| `GET` | `/external/feriados` | Pública | `?ano=2026` | Consultar feriados | `200 OK` | `504` |

---

## 💻 Exemplos de Requisição (cURL)

### 1. Registrar Usuário Organizador
```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Produtora Alpha",
    "email": "produtora@exemplo.com",
    "password": "SenhaForte@123",
    "role": "ORGANIZER",
    "phone": "11988887777"
  }'
```

### 2. Login
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "produtora@exemplo.com",
    "password": "SenhaForte@123"
  }'
```

### 3. Criar Evento
```bash
curl -X POST http://localhost:3000/events \
  -H "Authorization: Bearer SEU_TOKEN_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Festival de Inverno 2026",
    "description": "Festival de música ao ar livre",
    "locationCep": "01001000",
    "locationAddress": "Praça da Sé, 100",
    "locationCity": "São Paulo",
    "locationState": "SP",
    "startsAt": "2026-11-20T19:00:00.000Z",
    "endsAt": "2026-11-20T23:59:00.000Z"
  }'
```

### 4. Upload de Banner do Evento
```bash
curl -X POST http://localhost:3000/events/1/banner \
  -H "Authorization: Bearer SEU_TOKEN_JWT" \
  -F "file=@/caminho/para/banner.jpg"
```

### 5. Compra de Ingresso
```bash
curl -X POST http://localhost:3000/purchases \
  -H "Authorization: Bearer SEU_TOKEN_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "ticketBatchId": 1,
    "quantity": 2,
    "paymentMethod": "PIX"
  }'
```

### 6. Check-in de Ingresso
```bash
curl -X POST http://localhost:3000/check-ins \
  -H "Authorization: Bearer SEU_TOKEN_ORGANIZADOR" \
  -H "Content-Type: application/json" \
  -d '{
    "ticketIdentifier": "TKT-DEMO-VIP-001",
    "notes": "Entrada Portão A"
  }'
```

---

## 🧪 Testes Automatizados

A aplicação inclui testes unitários e testes HTTP com Prisma mockado. Eles validam rotas e regras isoladas, mas não substituem uma verificação com PostgreSQL real para migrations e concorrência:

```bash
# Executar todos os testes
npm test

# Executar com relatório de cobertura
npm run test:cov

# Testes HTTP com Prisma mockado
npm run test:e2e

# Integração real: requer PostgreSQL e permissão para criar banco descartável
npm run test:db
```
# AvaliacaoBackend
