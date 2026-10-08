export function emailError(value: string): string {
  if (!value.trim()) return 'Introduce tu correo electrónico.';
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
    ? ''
    : 'Escribe un correo electrónico válido.';
}
export function passwordError(value: string): string {
  if (!value) return 'Introduce una contraseña.';
  return value.length >= 8 ? '' : 'La contraseña debe tener al menos 8 caracteres.';
}
export function registrationErrors(
  fullName: string,
  email: string,
  password: string,
  confirm: string,
) {
  return {
    fullName:
      fullName.trim().length >= 2 ? '' : 'Escribe tu nombre completo (al menos 2 caracteres).',
    email: emailError(email),
    password: passwordError(password),
    confirm: !confirm
      ? 'Confirma tu contraseña.'
      : confirm !== password
        ? 'Las contraseñas no coinciden.'
        : '',
  };
}
