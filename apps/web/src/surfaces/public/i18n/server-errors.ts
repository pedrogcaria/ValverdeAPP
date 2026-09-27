import type { Locale } from './locale';

// As Edge Functions respondem sempre em português. Enquanto o backend não
// souber a língua do visitante, as mensagens conhecidas traduzem-se aqui.
const exact: Record<string, string> = {
  'Origem não permitida.': 'Origin not allowed.',
  'Método não permitido.': 'Method not allowed.',
  'A verificação de segurança expirou. Tente novamente.': 'The security check has expired. Please try again.',
  'Essas datas já não estão disponíveis. Escolha outras datas.': 'Those dates are no longer available. Please choose other dates.',
  'Já recebemos um pedido igual recentemente. Aguarde a resposta do gestor.': 'We recently received an identical request. Please wait for the manager’s reply.',
  'Não foi possível enviar o pedido. Tente novamente.': 'We could not send your request. Please try again.',
  'Não foi possível validar pedidos repetidos.': 'We could not check for duplicate requests.',
  'Não foi possível guardar o pedido.': 'We could not save your request.',
  'A configuração da villa ainda não está disponível.': 'The villa configuration is not available yet.',
  'Não foi possível consultar os preços públicos.': 'We could not load the current prices.',
  'Não foi possível consultar os preços atuais.': 'We could not load the current prices.',
  'As datas têm de usar o formato AAAA-MM-DD.': 'Dates must use the YYYY-MM-DD format.',
  'Uma das datas não é válida.': 'One of the dates is not valid.',
  'Indique entre 1 e 9 hóspedes.': 'Please choose between 1 and 9 guests.',
  'A estadia tem de ter entre 1 e 90 noites.': 'The stay must be between 1 and 90 nights.',
  'Não foi possível validar o código de desconto.': 'We could not validate the discount code.',
  'O código de desconto não é válido.': 'The discount code is not valid.',
  'Não foi possível verificar a disponibilidade.': 'We could not check availability.',
  'Foram feitas demasiadas tentativas. Aguarde alguns minutos antes de tentar novamente.': 'Too many attempts. Please wait a few minutes before trying again.',
  'A proteção contra abuso ainda não está configurada. Tente mais tarde.': 'Abuse protection is not configured yet. Please try again later.',
  'A Edge Function não tem as credenciais Supabase necessárias.': 'The server is not configured correctly.',
  'Indique uma data válida.': 'Please enter a valid date.',
  'O código de desconto é demasiado longo.': 'The discount code is too long.',
  'O código de desconto tem caracteres inválidos.': 'The discount code contains invalid characters.',
  'Indique um número inteiro de hóspedes.': 'Please enter a whole number of guests.',
  'O check-out tem de ser posterior ao check-in.': 'Check-out must be after check-in.',
  'Indique o nome completo.': 'Please enter your full name.',
  'O nome é demasiado longo.': 'The name is too long.',
  'Indique um email válido.': 'Please enter a valid email address.',
  'O email é demasiado longo.': 'The email address is too long.',
  'Indique um telefone válido.': 'Please enter a valid phone number.',
  'O telefone é demasiado longo.': 'The phone number is too long.',
  'O telefone tem caracteres inválidos.': 'The phone number contains invalid characters.',
  'A mensagem é demasiado longa.': 'The message is too long.',
  'Conclua a verificação de segurança.': 'Please complete the security check.',
  'Os dados enviados não são válidos.': 'The submitted data is not valid.',
  'O pedido tem de usar JSON.': 'The request must use JSON.',
  'O pedido é demasiado grande.': 'The request is too large.',
  'O pedido JSON não é válido.': 'The JSON request is not valid.',
  'Não foi possível contactar o servidor.': 'We could not reach the server.',
  'A resposta do servidor está vazia.': 'The server response was empty.',
  'Faltam as variáveis públicas da ligação ao Supabase.': 'The booking service is not configured.'
};

const patterns: Array<[RegExp, (match: RegExpMatchArray) => string]> = [
  [/^A estadia mínima é de (\d+) noites\.$/, (match) => `The minimum stay is ${match[1]} nights.`],
  [/^Ainda não existe um preço definido para (\d{4}-\d{2}-\d{2})\.$/, (match) => `There is no price set yet for ${match[1]}.`]
];

export function translateServerError(message: string, locale: Locale): string {
  if (locale === 'pt') return message;
  if (exact[message]) return exact[message];
  for (const [pattern, format] of patterns) {
    const match = message.match(pattern);
    if (match) return format(match);
  }
  return message;
}
