import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsPositive, IsString } from 'class-validator';

export class UpdateSectorDto {
  @ApiPropertyOptional({ example: 'Pista Premium VIP' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 600 })
  @IsOptional()
  @IsInt()
  @IsPositive()
  capacity?: number;
}
