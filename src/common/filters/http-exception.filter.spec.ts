import { AllExceptionsFilter } from './http-exception.filter';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException, UnauthorizedException } from '@nestjs/common';

describe('AllExceptionsFilter (Tratamento de 400, 401, 403, 404 e 409)', () => {
  let filter: AllExceptionsFilter;

  beforeEach(() => {
    filter = new AllExceptionsFilter();
  });

  const createMockHost = () => {
    const jsonMock = jest.fn();
    const statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    const responseMock = { status: statusMock };
    const requestMock = { url: '/test', method: 'POST' };

    const hostMock: any = {
      switchToHttp: () => ({
        getResponse: () => responseMock,
        getRequest: () => requestMock,
      }),
    };

    return { hostMock, statusMock, jsonMock };
  };

  it('1. Deve formatar erro 400 Bad Request', () => {
    const { hostMock, statusMock, jsonMock } = createMockHost();
    filter.catch(new BadRequestException('Dados inválidos'), hostMock);

    expect(statusMock).toHaveBeenCalledWith(400);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        message: 'Dados inválidos',
      }),
    );
  });

  it('2. Deve formatar erro 401 Unauthorized', () => {
    const { hostMock, statusMock, jsonMock } = createMockHost();
    filter.catch(new UnauthorizedException('Token inválido'), hostMock);

    expect(statusMock).toHaveBeenCalledWith(401);
  });

  it('3. Deve formatar erro 403 Forbidden', () => {
    const { hostMock, statusMock, jsonMock } = createMockHost();
    filter.catch(new ForbiddenException('Acesso negado'), hostMock);

    expect(statusMock).toHaveBeenCalledWith(403);
  });

  it('4. Deve formatar erro 404 Not Found', () => {
    const { hostMock, statusMock, jsonMock } = createMockHost();
    filter.catch(new NotFoundException('Recurso não encontrado'), hostMock);

    expect(statusMock).toHaveBeenCalledWith(404);
  });

  it('5. Deve formatar erro 409 Conflict', () => {
    const { hostMock, statusMock, jsonMock } = createMockHost();
    filter.catch(new ConflictException('Conflito de regra de negócio'), hostMock);

    expect(statusMock).toHaveBeenCalledWith(409);
  });
});
