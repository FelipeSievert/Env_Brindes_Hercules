import { supabase } from "./supabase";

export type PersonalSignature = { user_id: string; image: string; version: string };
export async function loadSignature(): Promise<PersonalSignature | null> {
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) throw new Error("Sessão inválida.");
  const { data, error } = await supabase.from("personal_signatures")
    .select("user_id,image,version").eq("user_id", auth.user.id).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}
export async function saveSignature(image: string) {
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) throw new Error("Sessão inválida.");
  const { error } = await supabase.from("personal_signatures").upsert({
    user_id: auth.user.id, image, version: crypto.randomUUID()
  });
  if (error) throw new Error(error.message);
}
export async function deleteSignature() {
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) throw new Error("Sessão inválida.");
  const { error } = await supabase.from("personal_signatures").delete().eq("user_id", auth.user.id);
  if (error) throw new Error(error.message);
}
