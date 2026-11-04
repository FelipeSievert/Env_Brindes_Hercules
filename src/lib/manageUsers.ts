import { FunctionsFetchError, FunctionsHttpError } from "@supabase/supabase-js";
import type { SystemUser } from "../auth/AuthGate";
import { supabase } from "./supabase";

type ManageUsersAction = "list" | "invite" | "activate" | "setRole" | "setStatus";
const functionName = import.meta.env.VITE_MANAGE_USERS_FUNCTION || "manage-users";

export async function callManageUsers(action: ManageUsersAction, params: Record<string, unknown> = {}) {
  if (!["manage-users", "manage-users-preview"].includes(functionName)) {
    throw new Error("O serviço de usuários não está configurado corretamente. Avise o administrador.");
  }
  const { data, error } = await supabase.functions.invoke(functionName, { body: { ...params, action } });
  if (error instanceof FunctionsHttpError) {
    const payload = await error.context.json().catch(() => null);
    throw new Error(payload?.error || "Não foi possível processar a solicitação de usuários.");
  }
  if (error instanceof FunctionsFetchError) {
    throw new Error("Não foi possível conectar ao serviço de usuários. Tente novamente ou avise o administrador.");
  }
  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
  return data as { users?: SystemUser[]; ok?: boolean };
}
