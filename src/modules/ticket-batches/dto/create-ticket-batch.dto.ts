import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsString,
  Min,
} from 'class-validator';

export class CreateTicketBatchDto {
  @ApiProperty({ example: '1º Lote Promocional' })
  @IsString({ message: 'O nome do lote deve ser um texto' })
  @IsNotEmpty({ message: 'O nome do lote é obrigatório' })
  name: string;

  @ApiProperty({ example: 120.5, description: 'Preço unitário do ingresso' })
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'O preço deve ser um valor numérico válido' })
  @IsPositive({ message: 'O preço deve ser maior que zero' })
  @IsNotEmpty({ message: 'O preço é obrigatório' })
  price: number;

  @ApiProperty({ example: 200, description: 'Quantidade total de ingressos do lote' })
  @IsInt({ message: 'A quantidade total deve ser um número inteiro' })
  @Min(1, { message: 'A quantidade total deve ser de no mínimo 1 ingresso' })
  @IsNotEmpty({ message: 'A quantidade total é obrigatória' })
  totalQuantity: number;

  @ApiProperty({ example: '2026-10-01T00:00:00.000Z' })
  @IsDateString({}, { message: 'Data de início de vendas inválida' })
  @IsNotEmpty({ message: 'A data de início das vendas é obrigatória' })
  startSaleDate: string;

  @ApiProperty({ example: '2026-12-01T23:59:59.000Z' })
  @IsDateString({}, { message: 'Data de fim de vendas inválida' })
  @IsNotEmpty({ message: 'A data de fim das vendas é obrigatória' })
  endSaleDate: string;

  @ApiProperty({ example: 1, description: 'ID numérico do setor' })
  @IsInt({ message: 'O ID do setor deve ser um número inteiro' })
  @IsNotEmpty({ message: 'O ID do setor é obrigatório' })
  sectorId: number;
}
