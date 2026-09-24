import { CreateUserDto } from '../../users/dto/create-user.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { Role } from '../../../common/enums/role.enum';

export class RegisterDto extends CreateUserDto {
  @ApiPropertyOptional({ enum: [Role.CUSTOMER, Role.ORGANIZER] })
  @IsOptional()
  @IsIn([Role.CUSTOMER, Role.ORGANIZER], {
    message: 'O cadastro público permite apenas CUSTOMER ou ORGANIZER',
  })
  role?: Role;
}
