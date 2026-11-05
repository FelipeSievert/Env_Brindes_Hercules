import { supabase } from "./supabase";

export async function savePersonalName(name: string): Promise<void> {
  const fullName = name.trim();
  if (fullName.length < 2 || fullName.length > 160) throw new Error("Informe um nome entre 2 e 160 caracteres.");
  const { error } = await supabase.auth.updateUser({ data: { full_name: fullName } });
  if (error) throw new Error(error.message);
}

export async function requestPersonalEmail(email: string, redirectTo: string): Promise<void> {
  const address = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) throw new Error("Informe um e-mail válido.");
  const { error } = await supabase.auth.updateUser({ email: address }, { emailRedirectTo: redirectTo });
  if (error) throw new Error(error.message);
}

export async function savePersonalPassword(current: string, password: string, confirmation: string, nonce = ""): Promise<void> {
  if (!current) throw new Error("Informe a senha atual.");
  if (password.length < 10) throw new Error("Use uma nova senha com pelo menos 10 caracteres.");
  if (password !== confirmation) throw new Error("As novas senhas não coincidem.");
  const { error } = await supabase.auth.updateUser({ password, current_password: current, ...(nonce.trim() ? { nonce: nonce.trim() } : {}) });
  if (error) throw new Error(error.message);
}

export async function requestPasswordCode(): Promise<void> {
  const { error } = await supabase.auth.reauthenticate();
  if (error) throw new Error(error.message);
}
