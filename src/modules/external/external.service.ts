import {
  Injectable,
  BadRequestException,
  GatewayTimeoutException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom, timeout, catchError, TimeoutError } from 'rxjs';
import { CepResponseDto } from './dto/cep-response.dto';

@Injectable()
export class ExternalService {
  private readonly logger = new Logger(ExternalService.name);
  private readonly viacepUrl: string;
  private readonly feriadosUrl: string;
  private readonly timeoutMs: number;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.viacepUrl =
      this.configService.get<string>('VIACEP_URL') || 'https://viacep.com.br/ws';
    this.feriadosUrl =
      this.configService.get<string>('FERIADOS_API_URL') ||
      'https://brasilapi.com.br/api/feriados/v1';
    this.timeoutMs = Number(
      this.configService.get<number>('EXTERNAL_API_TIMEOUT') || 5000,
    );
  }

  async consultarCep(cep: string): Promise<CepResponseDto> {
    const cleanCep = cep.replace(/\D/g, '');
    if (cleanCep.length !== 8) {
      throw new BadRequestException(
        'CEP inválido. O CEP deve conter exatamente 8 dígitos numéricos.',
      );
    }

    const url = `${this.viacepUrl}/${cleanCep}/json/`;

    try {
      const response = await firstValueFrom(
        this.httpService.get(url).pipe(
          timeout(this.timeoutMs),
          catchError((err) => {
            if (err instanceof TimeoutError || err.code === 'ECONNABORTED') {
              this.logger.error(`Timeout ao consultar o CEP ${cleanCep} na URL: ${url}`);
              throw new GatewayTimeoutException(
                'Tempo limite excedido ao consultar o serviço externo de CEP.',
              );
            }
            this.logger.error(`Falha na requisição externa de CEP: ${err.message}`);
            throw err;
          }),
        ),
      );

      if (response.data && response.data.erro) {
        throw new NotFoundException(`O CEP ${cleanCep} não foi encontrado.`);
      }

      return response.data;
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException ||
        error instanceof GatewayTimeoutException
      ) {
        throw error;
      }

      this.logger.warn(
        `Erro ao acessar API externa de CEP: ${error.message}. Retornando fallback.`,
      );
      throw new BadRequestException(
        `Não foi possível validar o CEP ${cleanCep} externamente.`,
      );
    }
  }

  async consultarFeriados(ano: number): Promise<any[]> {
    const url = `${this.feriadosUrl}/${ano}`;
    try {
      const response = await firstValueFrom(
        this.httpService.get(url).pipe(
          timeout(this.timeoutMs),
          catchError((err) => {
            if (err instanceof TimeoutError || err.code === 'ECONNABORTED') {
              throw new GatewayTimeoutException(
                'Tempo limite excedido ao consultar feriados nacionais.',
              );
            }
            throw err;
          }),
        ),
      );
      return response.data;
    } catch (error) {
      this.logger.warn(`Erro ao consultar feriados: ${error.message}`);
      return [];
    }
  }
}
