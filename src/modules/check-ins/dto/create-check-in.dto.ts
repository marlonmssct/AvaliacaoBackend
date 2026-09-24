import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateCheckInDto {
  @ApiProperty({ example: 'TKT-9A8B7C6D5E', description: 'Código do ingresso ou UUID do ingresso' })
  @IsString({ message: 'O código ou ID do ingresso deve ser uma string' })
  @IsNotEmpty({ message: 'O código ou ID do ingresso é obrigatório' })
  ticketIdentifier: string;

  @ApiPropertyOptional({ example: 'Entrada Portão A - VIP', description: 'Observações do operador' })
  @IsOptional()
  @IsString()
  notes?: string;
}
