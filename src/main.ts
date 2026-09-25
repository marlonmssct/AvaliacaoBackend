import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { dirname, resolve } from 'path';
import helmet from 'helmet';
import * as compression from 'compression';

import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Servir arquivos estáticos de uploads
  app.useStaticAssets(dirname(resolve(process.env.UPLOAD_DEST || './uploads/banners')), {
    prefix: '/uploads/',
  });

  // Segurança HTTP com Helmet
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  // Compressão Gzip
  app.use(compression());

  // Habilitar CORS
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Validação estrita de DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Tratamento de exceções padronizado (400, 401, 403, 404, 409, 500)
  app.useGlobalFilters(new AllExceptionsFilter());

  // Interceptor global para logging estruturado e tempo de resposta
  app.useGlobalInterceptors(new LoggingInterceptor());

  // Configuração da Documentação Interativa OpenAPI / Swagger
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Plataforma de Eventos e Ingressos - API Backend')
    .setDescription(
      'API REST completa para gestão de eventos, setores, lotes, vendas de ingressos e check-in com RBAC.\n\n' +
      '🔐 **INSTRUÇÕES DE AUTORIZAÇÃO NO SWAGGER (Botão verde Authorize no topo)**:\n' +
      '- **Passo 1 (API Key)**: No campo `x-api-key`, digite a chave de API (Ex: `123...`) e clique em Authorize.\n\n' +

      '- **Passo 2 (JWT)**: No campo `bearer`, cole o seu token (apenas o código `eyJ...`, sem a palavra "Bearer") e clique em Authorize.',
    )
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        description: 'Insira o token JWT gerado no login (apenas o token)',
        in: 'header',
      },
      'bearer',
    )
    .addApiKey(
      {
        type: 'apiKey',
        name: 'x-api-key',
        in: 'header',
        description: 'Chave de API (Ex: 123...) configurada em API_KEY',
      },
      'x-api-key',
    )
    .addSecurityRequirements('x-api-key')
    .addTag('Autenticação', 'Registro e login com emissão de token JWT')
    .addTag('Usuários', 'Gestão de usuários, perfis (CUSTOMER, ORGANIZER, ADMIN) e dados pessoais')
    .addTag('Eventos', 'Criação, publicação, cancelamento e upload de banner de eventos')
    .addTag('Setores', 'Definição de setores físicos e capacidades')
    .addTag('Lotes de Ingressos', 'Janela de datas, preços e cotas de ingressos')
    .addTag('Compras e Pagamentos', 'Processamento atômico de pedidos de ingressos')
    .addTag('Ingressos', 'Consulta de ingressos emitidos e QR Codes')
    .addTag('Controle de Entrada (Check-in)', 'Validação única de entrada de participantes')
    .addTag('Integrações Externas', 'Consulta de CEP (ViaCEP) e feriados nacionais via HttpService')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);

  // Garante que o Swagger UI envie SIMULTANEAMENTE a x-api-key e o Bearer Token nas rotas autenticadas
  if (document.paths) {
    for (const pathItem of Object.values(document.paths)) {
      for (const operation of Object.values(pathItem as any)) {
        if (operation && typeof operation === 'object' && 'security' in operation) {
          const hasBearer = (operation as any).security?.some((s: any) => 'bearer' in s);
          if (hasBearer) {
            (operation as any).security = [
              {
                bearer: [],
                'x-api-key': [],
              },
            ];
          }
        }
      }
    }
  }

  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);

  logger.log(`🚀 Servidor rodando na porta: ${port}`);
  logger.log(`📄 Documentação Swagger disponível em: http://localhost:${port}/api/docs`);
}

bootstrap();
