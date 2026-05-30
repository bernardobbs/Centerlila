// Based on Lugo — Copyright (c) 2024 Renilson Medeiros — MIT License
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import PagamentosList from "@/modules/dashboard/PagamentosList";

export default async function PagamentosPage() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect("/login");

  // Buscar todos os inquilinos ativos com imóvel
  const { data: inquilinos } = await supabase
    .from("inquilinos")
    .select(`
      id, nome_completo, cpf, cnpj, tipo_pessoa, telefone,
      valor_aluguel, dia_vencimento, multa_percentual, juros_percentual,
      imovel_id,
      imoveis!inner (
        id, titulo, endereco_rua, endereco_numero, proprietario_id
      )
    `)
    .eq("imoveis.proprietario_id", session.user.id)
    .eq("status", "ativo")
    .order("nome_completo");

  // Buscar comprovantes dos últimos 6 meses
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const { data: comprovantes } = await supabase
    .from("comprovantes")
    .select(`
      id, inquilino_id, imovel_id, mes_referencia, valor, valor_multa,
      valor_juros, situation, data_vencimento, data_pagamento,
      forma_pagamento, pdf_url, descricao, created_at,
      imoveis!inner (proprietario_id)
    `)
    .eq("imoveis.proprietario_id", session.user.id)
    .gte("mes_referencia", sixMonthsAgo.toISOString().split("T")[0])
    .order("mes_referencia", { ascending: false });

  return (
    <PagamentosList
      initialInquilinos={(inquilinos || []).map((i: any) => ({
        ...i,
        imoveis: Array.isArray(i.imoveis) ? i.imoveis[0] : i.imoveis,
      }))}
      initialComprovantes={comprovantes || []}
      userId={session.user.id}
    />
  );
}
