import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Role } from '../../common/enums/role.enum';

describe('AuthService (Autenticação, Hashing e JWT)', () => {
  let service: AuthService;
  let usersService: any;
  let jwtService: any;

  const mockUsersService = {
    create: jest.fn(),
    findByEmailWithPassword: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn().mockReturnValue('mocked.jwt.token'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get(UsersService);
    jwtService = module.get(JwtService);
    jest.clearAllMocks();
  });

  it('1. Deve registrar novo usuário e emitir token JWT', async () => {
    const userDto = {
      name: 'Marlon Teste',
      email: 'marlon@teste.com',
      password: 'Password@123',
      role: Role.CUSTOMER,
    };

    usersService.create.mockResolvedValue({
      id: 'user-1',
      name: userDto.name,
      email: userDto.email,
      role: userDto.role,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await service.register(userDto);
    expect(result.accessToken).toBe('mocked.jwt.token');
    expect(result.user.email).toBe(userDto.email);
  });

  it('2. Deve autenticar com credenciais corretas', async () => {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('Password@123', salt);

    usersService.findByEmailWithPassword.mockResolvedValue({
      id: 'user-1',
      name: 'Marlon Teste',
      email: 'marlon@teste.com',
      passwordHash,
      role: Role.CUSTOMER,
    });

    const result = await service.login({
      email: 'marlon@teste.com',
      password: 'Password@123',
    });

    expect(result.accessToken).toBe('mocked.jwt.token');
    expect(result.user).not.toHaveProperty('passwordHash');
  });

  it('3. Deve lançar 401 Unauthorized com senha incorreta', async () => {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('SenhaCorreta@123', salt);

    usersService.findByEmailWithPassword.mockResolvedValue({
      id: 'user-1',
      email: 'marlon@teste.com',
      passwordHash,
      role: Role.CUSTOMER,
    });

    await expect(
      service.login({
        email: 'marlon@teste.com',
        password: 'SenhaErrada@123',
      }),
    ).rejects.toThrow(UnauthorizedException);
  });
});
