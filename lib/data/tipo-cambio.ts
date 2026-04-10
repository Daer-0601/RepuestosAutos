import "server-only";

import { pool } from "@/lib/db";
import { sqlInt } from "@/lib/data/sql-utils";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

export type TipoCambioRow = {
  id: number;
  valor_bs_por_usd: string;
  usuario_id: number | null;
  nota: string | null;
  vigente_desde: Date;
};

export async function listTipoCambio(limit = 100): Promise<TipoCambioRow[]> {
  const lim = sqlInt(limit, 500);
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, valor_bs_por_usd, usuario_id, nota, vigente_desde
     FROM tipo_cambio
     ORDER BY vigente_desde DESC, id DESC
     LIMIT ${lim}`
  );
  return rows as TipoCambioRow[];
}

export async function insertTipoCambio(input: {
  valor_bs_por_usd: number;
  usuario_id: number | null;
  nota: string | null;
}): Promise<number> {
  const [res] = await pool.execute<ResultSetHeader>(
    `INSERT INTO tipo_cambio (valor_bs_por_usd, usuario_id, nota)
     VALUES (?, ?, ?)`,
    [input.valor_bs_por_usd, input.usuario_id, input.nota]
  );
  return res.insertId;
}

/** Cotización más reciente (para compras / snapshot). */
export async function getUltimoTipoCambio(): Promise<{
  id: number;
  valor_bs_por_usd: number;
} | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, valor_bs_por_usd
     FROM tipo_cambio
     ORDER BY vigente_desde DESC, id DESC
     LIMIT 1`
  );
  const r = rows[0] as { id: number; valor_bs_por_usd: string } | undefined;
  if (!r) return null;
  const v = Number(r.valor_bs_por_usd);
  if (!Number.isFinite(v) || v <= 0) return null;
  return { id: r.id, valor_bs_por_usd: v };
}
