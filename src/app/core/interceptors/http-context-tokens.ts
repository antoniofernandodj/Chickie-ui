import { HttpContextToken } from '@angular/common/http';

/**
 * Quando passado como `true` numa requisição HTTP, o errorInterceptor
 * suprime o toast automático de erro (4xx/5xx).
 *
 * Uso:
 *   this.http.get(url, {
 *     context: new HttpContext().set(SILENT_ERROR, true),
 *   })
 */
export const SILENT_ERROR = new HttpContextToken<boolean>(() => false);
