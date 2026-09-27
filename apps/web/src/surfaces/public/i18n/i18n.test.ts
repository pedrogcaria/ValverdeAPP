import { describe, expect, it } from 'vitest';
import { localeFromPath, pathForLocale } from './locale';
import { messages } from './messages';
import { translateServerError } from './server-errors';

describe('língua do site público', () => {
  it('usa inglês por omissão e português em /pt', () => {
    expect(localeFromPath('/')).toBe('en');
    expect(localeFromPath('/qualquer')).toBe('en');
    expect(localeFromPath('/pt')).toBe('pt');
    expect(localeFromPath('/PT/')).toBe('pt');
    expect(localeFromPath('/ptx')).toBe('en');
  });

  it('gera o caminho de cada língua', () => {
    expect(pathForLocale('en')).toBe('/');
    expect(pathForLocale('pt')).toBe('/pt');
  });

  it('tem os mesmos textos nas duas línguas', () => {
    const keys = (value: object, prefix = ''): string[] => Object.entries(value).flatMap(([key, entry]) =>
      entry && typeof entry === 'object' ? keys(entry, `${prefix}${key}.`) : [`${prefix}${key}`]);
    expect(keys(messages.pt).sort()).toEqual(keys(messages.en).sort());
  });

  it('traduz as mensagens de erro do servidor para inglês', () => {
    expect(translateServerError('O código de desconto não é válido.', 'en')).toBe('The discount code is not valid.');
    expect(translateServerError('A estadia mínima é de 7 noites.', 'en')).toBe('The minimum stay is 7 nights.');
    expect(translateServerError('A estadia mínima é de 7 noites.', 'pt')).toBe('A estadia mínima é de 7 noites.');
    expect(translateServerError('Mensagem desconhecida', 'en')).toBe('Mensagem desconhecida');
  });
});
