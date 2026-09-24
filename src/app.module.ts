import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { EventsModule } from './modules/events/events.module';
import { SectorsModule } from './modules/sectors/sectors.module';
import { TicketBatchesModule } from './modules/ticket-batches/ticket-batches.module';
import { PurchasesModule } from './modules/purchases/purchases.module';
import { TicketsModule } from './modules/tickets/tickets.module';
import { CheckInsModule } from './modules/check-ins/check-ins.module';
import { ExternalModule } from './modules/external/external.module';

import { APP_GUARD } from '@nestjs/core';
import { ApiKeyGuard } from './common/guards/api-key.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validate: (config) => {
        for (const name of ['DATABASE_URL', 'JWT_SECRET', 'API_KEY']) {
          if (!config[name] || !String(config[name]).trim()) {
            throw new Error(`Variável obrigatória ausente: ${name}`);
          }
        }
        return config;
      },
    }),
    DatabaseModule,
    AuthModule,
    UsersModule,
    EventsModule,
    SectorsModule,
    TicketBatchesModule,
    PurchasesModule,
    TicketsModule,
    CheckInsModule,
    ExternalModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ApiKeyGuard,
    },
  ],
})
export class AppModule {}
