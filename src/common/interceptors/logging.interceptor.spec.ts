import { LoggingInterceptor } from './logging.interceptor';
import { of, throwError } from 'rxjs';

describe('LoggingInterceptor (Interceptor Obrigatório)', () => {
  let interceptor: LoggingInterceptor;

  beforeEach(() => {
    interceptor = new LoggingInterceptor();
  });

  it('1. Deve registrar log de requisição com sucesso e calcular tempo de execução', (done) => {
    const mockRequest = {
      method: 'GET',
      originalUrl: '/events',
      ip: '127.0.0.1',
      user: { id: 'usr-1', role: 'ADMIN' },
    };

    const mockResponse = {
      statusCode: 200,
    };

    const mockExecutionContext: any = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
        getResponse: () => mockResponse,
      }),
    };

    const mockCallHandler: any = {
      handle: () => of({ success: true }),
    };

    interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
      next: (val) => {
        expect(val).toEqual({ success: true });
        done();
      },
    });
  });

  it('2. Deve interceptar e registrar erros sem afetar o fluxo de exceção', (done) => {
    const mockRequest = {
      method: 'POST',
      originalUrl: '/auth/login',
      ip: '127.0.0.1',
    };

    const mockResponse = {
      statusCode: 401,
    };

    const mockExecutionContext: any = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
        getResponse: () => mockResponse,
      }),
    };

    const mockCallHandler: any = {
      handle: () => throwError(() => new Error('Credenciais inválidas')),
    };

    interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
      error: (err) => {
        expect(err.message).toBe('Credenciais inválidas');
        done();
      },
    });
  });
});
