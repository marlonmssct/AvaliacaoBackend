import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { PurchasesService } from './purchases.service';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';

@ApiTags('Compras e Pagamentos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('purchases')
export class PurchasesController {
  constructor(private readonly purchasesService: PurchasesService) {}

  @Post()
  @ApiOperation({ summary: 'Realizar compra de ingressos (Qualquer usuário autenticado)' })
  @ApiResponse({ status: 201, description: 'Compra aprovada e ingressos emitidos' })
  @ApiResponse({ status: 400, description: 'Parâmetros inválidos' })
  @ApiResponse({ status: 404, description: 'Lote não encontrado' })
  @ApiResponse({ status: 409, description: 'Fora do período de venda, lote esgotado ou evento não publicado' })
  create(
    @Body() createPurchaseDto: CreatePurchaseDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.purchasesService.create(createPurchaseDto, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Listar histórico de compras do usuário logado' })
  @ApiResponse({ status: 200, description: 'Lista de compras' })
  findAll(@CurrentUser() user: CurrentUserPayload) {
    return this.purchasesService.findAll(user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obter detalhes de uma compra' })
  @ApiParam({ name: 'id', description: 'UUID da compra' })
  @ApiResponse({ status: 200, description: 'Detalhes da compra' })
  @ApiResponse({ status: 403, description: 'Tentativa de acessar compra de terceiro' })
  @ApiResponse({ status: 404, description: 'Compra não encontrada' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.purchasesService.findById(id, user);
  }
}
