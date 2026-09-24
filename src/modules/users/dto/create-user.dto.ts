import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { Role } from '../../../common/enums/role.enum';

export class CreateUserDto {
  @ApiProperty({ example: 'Marlon Massucato', description: 'Nome completo' })
  @IsString({ message: 'O nome deve ser um texto' })
  @IsNotEmpty({ message: 'O nome é obrigatório' })
  name: string;

  @ApiProperty({ example: 'marlon@exemplo.com', description: 'E-mail do usuário' })
  @IsEmail({}, { message: 'Forneça um e-mail válido' })
  @IsNotEmpty({ message: 'O e-mail é obrigatório' })
  email: string;

  @ApiProperty({ example: 'SenhaForte@123', minLength: 6, description: 'Senha de acesso' })
  @IsString({ message: 'A senha deve ser um texto' })
  @MinLength(6, { message: 'A senha deve conter no mínimo 6 caracteres' })
  @IsNotEmpty({ message: 'A senha é obrigatória' })
  password: string;

  @ApiPropertyOptional({ enum: Role, default: Role.CUSTOMER, description: 'Perfil de acesso' })
  @IsOptional()
  @IsEnum(Role, { message: 'Perfil inválido. Deve ser CUSTOMER, ORGANIZER ou ADMIN' })
  role?: Role;

  @ApiPropertyOptional({ example: '11999999999', description: 'Telefone de contato' })
  @IsOptional()
  @IsString({ message: 'O telefone deve ser um texto' })
  phone?: string;
}
