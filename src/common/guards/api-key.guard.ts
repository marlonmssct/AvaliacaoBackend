import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_API_KEY = 'isPublicApiKey';
export const PublicApiKey = () => SetMetadata(IS_PUBLIC_API_KEY, true);

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly configService: ConfigService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(
      IS_PUBLIC_API_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const rawApiKey =
      request.headers['x-api-key'] ||
      request.headers['api-key'] ||
      request.headers['apikey'] ||
      request.query?.['api_key'] ||
      request.query?.['apiKey'] ||
      request.query?.['x-api-key'];

    const expectedApiKey = this.configService.getOrThrow<string>('API_KEY').trim();

    const apiKey = typeof rawApiKey === 'string' ? rawApiKey.trim() : '';

    if (!apiKey || apiKey !== expectedApiKey) {
      throw new UnauthorizedException(
        'Acesso não autorizado: API Key ausente ou inválida.',
      );
    }

    return true;
  }
}
