import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsPositive,
  Max,
} from 'class-validator';

export enum PaymentMethodDto {
  CREDIT_CARD = 'CREDIT_CARD',
  PIX = 'PIX',
  BOLETO = 'BOLETO',
}

export class CreatePurchaseDto {
  @ApiProperty({ example: 1, description: 'ID numérico do lote de ingressos' })
  @IsInt({ message: 'O ID do lote de ingressos deve ser um número inteiro' })
  @IsNotEmpty({ message: 'O ID do lote é obrigatório' })
  ticketBatchId: number;

  @ApiProperty({ example: 2, description: 'Quantidade de ingressos a adquirir (entre 1 e 10)' })
  @IsInt({ message: 'A quantidade deve ser um número inteiro' })
  @IsPositive({ message: 'A quantidade deve ser maior que zero' })
  @Max(10, { message: 'Limite máximo de 10 ingressos por compra' })
  @IsNotEmpty({ message: 'A quantidade é obrigatória' })
  quantity: number;

  @ApiProperty({ enum: PaymentMethodDto, example: PaymentMethodDto.PIX })
  @IsEnum(PaymentMethodDto, {
    message: 'Método de pagamento inválido. Opções: CREDIT_CARD, PIX, BOLETO',
  })
  @IsNotEmpty({ message: 'O método de pagamento é obrigatório' })
  paymentMethod: PaymentMethodDto;
}
