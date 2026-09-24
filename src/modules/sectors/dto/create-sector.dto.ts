import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsPositive, IsString, IsUUID } from 'class-validator';

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

  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-1234-56789abcdef0' })
  @IsUUID(undefined, { message: 'O ID do evento deve ser um UUID válido' })
  @IsNotEmpty({ message: 'O ID do evento é obrigatório' })
  eventId: string;
}
