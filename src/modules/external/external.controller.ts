import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { ExternalService } from './external.service';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Integrações Externas')
@Controller('external')
export class ExternalController {
  constructor(private readonly externalService: ExternalService) {}

  @Public()
  @Get('cep/:cep')
  @ApiOperation({ summary: 'Consultar endereço por CEP através de serviço externo' })
  @ApiParam({ name: 'cep', example: '01001000', description: 'CEP com 8 dígitos' })
  @ApiResponse({ status: 200, description: 'Dados de endereço encontrados com sucesso' })
  @ApiResponse({ status: 400, description: 'Formato de CEP inválido' })
  @ApiResponse({ status: 404, description: 'CEP não encontrado' })
  @ApiResponse({ status: 504, description: 'Timeout ao consultar serviço externo' })
  async getCep(@Param('cep') cep: string) {
    return this.externalService.consultarCep(cep);
  }

  @Public()
  @Get('feriados')
  @ApiOperation({ summary: 'Consultar feriados nacionais por ano' })
  @ApiQuery({ name: 'ano', required: false, example: 2026 })
  async getFeriados(@Query('ano') ano?: string) {
    const targetYear = ano ? parseInt(ano, 10) : new Date().getFullYear();
    return this.externalService.consultarFeriados(targetYear);
  }
}
