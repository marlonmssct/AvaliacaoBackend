import { Test, TestingModule } from '@nestjs/testing';
import { ExternalService } from './external.service';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { of, throwError } from 'rxjs';
import { BadRequestException, GatewayTimeoutException, NotFoundException } from '@nestjs/common';

describe('ExternalService (HttpService, Integração Externa e Resiliência)', () => {
  let service: ExternalService;
  let httpService: any;

  const mockHttpService = {
    get: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'VIACEP_URL') return 'https://viacep.com.br/ws';
      if (key === 'FERIADOS_API_URL') return 'https://brasilapi.com.br/api/feriados/v1';
      if (key === 'EXTERNAL_API_TIMEOUT') return 1000;
      return null;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExternalService,
        { provide: HttpService, useValue: mockHttpService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<ExternalService>(ExternalService);
    httpService = module.get(HttpService);
    jest.clearAllMocks();
  });

  it('1. Deve consultar CEP válido com sucesso através do HttpService', async () => {
    const apiResponse = {
      data: {
        cep: '01001-000',
        logradouro: 'Praça da Sé',
        complemento: 'lado ímpar',
        bairro: 'Sé',
        localidade: 'São Paulo',
        uf: 'SP',
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any,
    };

    httpService.get.mockReturnValue(of(apiResponse));

    const result = await service.consultarCep('01001000');
    expect(result.localidade).toBe('São Paulo');
    expect(result.uf).toBe('SP');
  });

  it('2. Deve lançar 400 Bad Request se o formato do CEP for inválido', async () => {
    await expect(service.consultarCep('123')).rejects.toThrow(BadRequestException);
  });

  it('3. Deve lançar 404 Not Found se o CEP não for encontrado pelo serviço externo', async () => {
    const apiResponse = {
      data: { erro: true },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any,
    };

    httpService.get.mockReturnValue(of(apiResponse));

    await expect(service.consultarCep('99999999')).rejects.toThrow(NotFoundException);
  });

  it('4. Deve falhar de forma controlada tratando timeout na integração externa', async () => {
    const timeoutErr = new Error('ECONNABORTED');
    (timeoutErr as any).code = 'ECONNABORTED';

    httpService.get.mockReturnValue(throwError(() => timeoutErr));

    await expect(service.consultarCep('01001000')).rejects.toThrow(GatewayTimeoutException);
  });
});
