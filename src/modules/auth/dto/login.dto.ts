import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'marlon@exemplo.com', description: 'E-mail cadastrado' })
  @IsEmail({}, { message: 'Forneça um e-mail válido' })
  @IsNotEmpty({ message: 'O e-mail é obrigatório' })
  email: string;

  @ApiProperty({ example: 'SenhaForte@123', description: 'Senha de acesso' })
  @IsString({ message: 'A senha deve ser uma string' })
  @MinLength(6, { message: 'A senha possui no mínimo 6 caracteres' })
  @IsNotEmpty({ message: 'A senha é obrigatória' })
  password: string;
}
