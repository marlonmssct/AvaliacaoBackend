import { Module } from '@nestjs/common';
import { TicketBatchesService } from './ticket-batches.service';
import { TicketBatchesController } from './ticket-batches.controller';

@Module({
  controllers: [TicketBatchesController],
  providers: [TicketBatchesService],
  exports: [TicketBatchesService],
})
export class TicketBatchesModule {}
