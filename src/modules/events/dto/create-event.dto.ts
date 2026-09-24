import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';

export class CreateEventDto {
  @ApiProperty({ example: 'Festival de Música de Verão 2026' })
  @IsString({ message: 'O título do evento deve ser um texto' })
  @IsNotEmpty({ message: 'O título do evento é obrigatório' })
  title: string;

  @ApiProperty({ example: 'O maior festival de música e tecnologia do ano' })
  @IsString({ message: 'A descrição deve ser um texto' })
  @IsNotEmpty({ message: 'A descrição é obrigatória' })
  description: string;

  @ApiProperty({ example: '01001000', description: 'CEP do local (8 dígitos)' })
  @IsString()
  @Length(8, 9, { message: 'O CEP deve ter 8 dígitos' })
  @IsNotEmpty({ message: 'O CEP é obrigatório' })
  locationCep: string;

  @ApiProperty({ example: 'Praça da Sé' })
  @IsString()
  @IsNotEmpty({ message: 'O endereço do evento é obrigatório' })
  locationAddress: string;

  @ApiProperty({ example: 'São Paulo' })
  @IsString()
  @IsNotEmpty({ message: 'A cidade é obrigatória' })
  locationCity: string;

  @ApiProperty({ example: 'SP' })
  @IsString()
  @Length(2, 2, { message: 'O estado (UF) deve ter 2 caracteres' })
  @IsNotEmpty({ message: 'O estado (UF) é obrigatório' })
  locationState: string;

  @ApiProperty({ example: '2026-12-15T18:00:00.000Z' })
  @IsDateString({}, { message: 'Data de início inválida. Use formato ISO-8601' })
  @IsNotEmpty({ message: 'A data de início é obrigatória' })
  startsAt: string;

  @ApiProperty({ example: '2026-12-15T23:59:00.000Z' })
  @IsDateString({}, { message: 'Data de término inválida. Use formato ISO-8601' })
  @IsNotEmpty({ message: 'A data de término é obrigatória' })
  endsAt: string;

  @ApiPropertyOptional({ example: 'https://exemplo.com/banner.jpg' })
  @IsOptional()
  @IsString()
  bannerUrl?: string;
}
