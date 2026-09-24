import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty } from 'class-validator';

export enum EventStatusDto {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  CANCELLED = 'CANCELLED',
  FINISHED = 'FINISHED',
}

export class UpdateEventStatusDto {
  @ApiProperty({ enum: EventStatusDto, example: EventStatusDto.PUBLISHED })
  @IsEnum(EventStatusDto, {
    message: 'Status inválido. Deve ser DRAFT, PUBLISHED, CANCELLED ou FINISHED',
  })
  @IsNotEmpty({ message: 'O status é obrigatório' })
  status: EventStatusDto;
}
