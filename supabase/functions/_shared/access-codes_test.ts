import { keyName } from './access-codes.ts';

function assertEquals(actual: unknown, expected: unknown, message: string) {
  if (actual !== expected) throw new Error(`${message}: esperado ${expected}, obtido ${actual}`);
}

Deno.test('O nome da chave no SwitchBot leva o nome do hóspede e o dia de entrada', () => {
  assertEquals(keyName('Maria Silva', '2026-07-10', 'a1b2'), 'Maria Silva 10-07 a1b2', 'Nome simples');
  assertEquals(keyName('João Conceição', '2026-07-10', 'a1b2'), 'Joao Conceicao 10-07 a1b2', 'Acentos removidos');
  assertEquals(keyName('Anne-Marie O\'Brien Smithson', '2026-12-01', 'ffff'), 'Anne Marie O Bri 01-12 ffff', 'Nome longo cortado');
  assertEquals(keyName(null, '2026-07-10', 'a1b2'), 'Hospede 10-07 a1b2', 'Sem hóspede');
  assertEquals(keyName('张伟', '2026-07-10', 'a1b2'), 'Hospede 10-07 a1b2', 'Só caracteres não latinos');
});

Deno.test('O sufixo aleatório torna os nomes distintos', () => {
  const names = new Set(Array.from({ length: 20 }, () => keyName('Maria', '2026-07-10')));
  if (names.size < 15) throw new Error('Sufixos repetidos demasiadas vezes.');
});
