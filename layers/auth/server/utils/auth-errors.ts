import type { AuthError } from '@supabase/supabase-js'

/**
 * Maps Supabase auth errors to safe, user-facing Portuguese messages.
 * Never forwards the raw Supabase error message to the client.
 */
export function toFriendlyAuthMessage(error: AuthError): string {
  const message = error.message.toLowerCase()

  if (message.includes('already registered') || message.includes('already exists')) {
    return 'Este e-mail já está cadastrado.'
  }
  if (message.includes('invalid login credentials')) {
    return 'E-mail ou senha incorretos.'
  }
  if (message.includes('email not confirmed')) {
    return 'Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada.'
  }
  if (message.includes('password') && message.includes('character')) {
    return 'A senha deve ter pelo menos 8 caracteres.'
  }
  if (message.includes('rate limit') || message.includes('too many')) {
    return 'Muitas tentativas. Aguarde um instante e tente novamente.'
  }

  return 'Não foi possível concluir a operação. Verifique os dados e tente novamente.'
}
