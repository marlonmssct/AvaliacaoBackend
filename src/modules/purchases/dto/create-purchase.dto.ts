import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsPositive,
  IsUUID,
  Max,
} from 'class-validator';

export enum PaymentMethodDto {
  CREDIT_CARD = 'CREDIT_CARD',
  PIX = 'PIX',
  BOLETO = 'BOLETO',
}

export class CreatePurchaseDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-1234-56789abcdef0' })
  @IsUUID(undefined, { message: 'O ID do lote de ingressos deve ser um UUID válido' })
  @IsNotEmpty({ message: 'O ID do lote é obrigatório' })
  ticketBatchId: string;

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
