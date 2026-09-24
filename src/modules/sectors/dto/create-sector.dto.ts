import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsPositive, IsString } from 'class-validator';

export class CreateSectorDto {
  @ApiProperty({ example: 'Pista Premium' })
  @IsString({ message: 'O nome do setor deve ser um texto' })
  @IsNotEmpty({ message: 'O nome do setor é obrigatório' })
  name: string;

  @ApiProperty({ example: 500, description: 'Capacidade máxima do setor' })
  @IsInt({ message: 'A capacidade deve ser um número inteiro' })
  @IsPositive({ message: 'A capacidade deve ser um número positivo maior que zero' })
  @IsNotEmpty({ message: 'A capacidade é obrigatória' })
  capacity: number;

  @ApiProperty({ example: 1, description: 'ID numérico do evento' })
  @IsInt({ message: 'O ID do evento deve ser um número inteiro' })
  @IsNotEmpty({ message: 'O ID do evento é obrigatório' })
  eventId: number;
}
