import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';

export enum BatchStatusDto {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SOLD_OUT = 'SOLD_OUT',
}

export class UpdateTicketBatchDto {
  @ApiPropertyOptional({ example: '1º Lote Especial' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 150.0 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  price?: number;

  @ApiPropertyOptional({ example: '2026-10-01T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  startSaleDate?: string;

  @ApiPropertyOptional({ example: '2026-12-05T23:59:59.000Z' })
  @IsOptional()
  @IsDateString()
  endSaleDate?: string;

  @ApiPropertyOptional({ enum: BatchStatusDto, example: BatchStatusDto.ACTIVE })
  @IsOptional()
  @IsEnum(BatchStatusDto)
  status?: BatchStatusDto;
}
