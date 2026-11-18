import type { NextFunction, Request, Response } from "express";
import type { AuthIdentity } from "../shared/auth.js";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createSupabaseClient, getAuthIdentity } from "./supabase.js";

declare global {
  namespace Express {
    interface Request {
      auth?: AuthIdentity;
      supabaseClient?: SupabaseClient;
      supabaseUser?: User;
    }
  }
}

export async function requireAuthenticated(req: Request, res: Response, next: NextFunction) {
  const authorization = req.get("authorization") ?? "";
  const token = /^Bearer\s+(.+)$/i.exec(authorization)?.[1];
  if (!token) {
    res.status(401).json({ message: "Inicia sesión para continuar." });
    return;
  }

  try {
    const verifier = createSupabaseClient();
    const { data: { user }, error } = await verifier.auth.getUser(token);
    if (error || !user) {
      res.status(401).json({ message: "La sesión expiró. Inicia sesión de nuevo." });
      return;
    }
    const client = createSupabaseClient(token);
    const requestedCompanyId = req.get("x-klimatka-company-id");
    req.supabaseClient = client;
    req.supabaseUser = user;
    req.auth = await getAuthIdentity(client, user, requestedCompanyId);
    next();
  } catch {
    res.status(503).json({ message: "El acceso seguro aún no está disponible." });
  }
}

export function requireCompany(req: Request, res: Response, next: NextFunction) {
  if (!req.auth?.company) {
    res.status(409).json({ message: "Crea o selecciona una empresa para continuar." });
    return;
  }
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.auth?.role !== "admin") {
    res.status(403).json({ message: "Esta acción requiere permisos de administrador de la empresa." });
    return;
  }
  next();
}

export function requirePlatformAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.auth?.isPlatformAdmin) {
    res.status(403).json({ message: "Esta acción requiere permisos de administración de Klimatka." });
    return;
  }
  next();
}
