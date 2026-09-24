import {
  Injectable,
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../database/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { Role } from '../../common/enums/role.enum';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  private sanitizeUser(user: any): UserResponseDto {
    const { passwordHash, ...sanitized } = user;
    return sanitized as UserResponseDto;
  }

  async create(createUserDto: CreateUserDto): Promise<UserResponseDto> {
    const existing = await this.prisma.user.findUnique({
      where: { email: createUserDto.email },
    });

    if (existing) {
      throw new ConflictException(
        `Já existe um usuário cadastrado com o e-mail: ${createUserDto.email}`,
      );
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(createUserDto.password, salt);

    const user = await this.prisma.user.create({
      data: {
        name: createUserDto.name,
        email: createUserDto.email,
        passwordHash,
        role: createUserDto.role || Role.CUSTOMER,
        phone: createUserDto.phone,
      },
    });

    return this.sanitizeUser(user);
  }

  async findAll(): Promise<UserResponseDto[]> {
    const users = await this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return users.map((u) => this.sanitizeUser(u));
  }

  async findById(id: string): Promise<UserResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(`Usuário com ID ${id} não encontrado.`);
    }

    return this.sanitizeUser(user);
  }

  async findByEmailWithPassword(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async update(
    id: string,
    updateUserDto: UpdateUserDto,
    currentUser: { id: string; role: Role },
  ): Promise<UserResponseDto> {
    // Regra de segurança: Usuário só pode alterar o próprio perfil, exceto se for ADMIN
    if (currentUser.id !== id && currentUser.role !== Role.ADMIN) {
      throw new ForbiddenException(
        'Você não tem permissão para alterar os dados de outro usuário.',
      );
    }

    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException(`Usuário com ID ${id} não encontrado.`);
    }

    if (updateUserDto.email && updateUserDto.email !== user.email) {
      const emailExists = await this.prisma.user.findUnique({
        where: { email: updateUserDto.email },
      });
      if (emailExists) {
        throw new ConflictException('Este e-mail já está em uso por outro usuário.');
      }
    }

    // Apenas ADMIN pode promover/alterar perfil role
    if (updateUserDto.role && currentUser.role !== Role.ADMIN) {
      delete updateUserDto.role;
    }

    const data: any = { ...updateUserDto };
    if (updateUserDto.password) {
      const salt = await bcrypt.genSalt(10);
      data.passwordHash = await bcrypt.hash(updateUserDto.password, salt);
      delete data.password;
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data,
    });

    return this.sanitizeUser(updated);
  }

  async remove(id: string, currentUser: { id: string; role: Role }) {
    if (currentUser.id !== id && currentUser.role !== Role.ADMIN) {
      throw new ForbiddenException(
        'Você não tem permissão para excluir a conta de outro usuário.',
      );
    }

    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException(`Usuário com ID ${id} não encontrado.`);
    }

    await this.prisma.user.delete({ where: { id } });
    return { message: 'Usuário excluído com sucesso.' };
  }
}
