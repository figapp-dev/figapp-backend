import type { FastifyReply, FastifyRequest } from "fastify";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createUserClient } from "../lib/supabase.js";
import { unauthorized } from "../lib/errors.js";
import { ErrorMessages } from "../constants/error-messages.js";

declare module "fastify" {
  interface FastifyRequest {
    user: User;
    supabase: SupabaseClient;
  }
}

export async function requireAuth(
  request: FastifyRequest,
  _reply: FastifyReply,
) {
  const header = request.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    throw unauthorized(ErrorMessages.MISSING_AUTH_HEADER);
  }

  const accessToken = header.slice("Bearer ".length).trim();

  if (!accessToken) {
    throw unauthorized(ErrorMessages.MISSING_ACCESS_TOKEN);
  }

  const supabase = createUserClient(accessToken);
  const { data, error } = await supabase.auth.getUser(accessToken);

  if (error || !data.user) {
    throw unauthorized(ErrorMessages.INVALID_ACCESS_TOKEN);
  }

  request.user = data.user;
  request.supabase = supabase;
}
