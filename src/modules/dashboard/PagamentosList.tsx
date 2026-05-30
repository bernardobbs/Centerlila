// Based on Lugo — Copyright (c) 2024 Renilson Medeiros — MIT License
"use client";
import { useState, useMemo, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import RegistrarPagamentoModal from "./RegistrarPagamentoModal";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import {
  ChevronLeft, ChevronRight, AlertCircle, Clock, CheckCircle2,
  Building2, FileText, MessageCircle, User, History
} from "lucide-react";

/* ─────────────── types ─────────────── */
interface Imovel { id: string; titulo: string; endereco_rua: string; endereco_numero: string; proprietario_id: string; }
interface Inquilino {
  id: string; nome_completo: string; cpf: string; cnpj: string; tipo_pessoa: string;
  telefone: string; valor_aluguel: number; dia_vencimento: number;
  multa_percentual: number; juros_percentual: number; imovel_id: string; imoveis: Imovel;
}
interface Comprovante {
  id: string; inquilino_id: string; imovel_id: string; mes_referencia: string;
  valor: number; valor_multa: number; valor_juros: number; situation: string;
  data_vencimento: string; data_pagamento: string | null; forma_pagamento: string | null;
  pdf_url: string | null; descricao: string | null; created_at: string;
}
interface Props { initialInquilinos: Inquilino[]; initialComprovantes: Comprovante[]; userId: string; }

/* ─────────────── helpers ─────────────── */
const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const MESES_SHORT = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

function toISOMonth(d: Date) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-01`; }
function fmtBRL(v: number) { return v.toLocaleString("pt-BR",{style:"currency",currency:"BRL"}); }
function fmtData(iso: string | null) {
  if (!iso) return "—";
  const [y,m,d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
function mesLabel(iso: string) {
  const [y,m] = iso.split("-");
  return `${MESES_SHORT[parseInt(m)-1]}/${y}`;
}
function calcTotal(inq: Inquilino, c: Comprovante | undefined, mes: string) {
  if (c?.situation === "billed") return (c.valor||0) + (c.valor_multa||0) + (c.valor_juros||0);
  const venc = c?.data_vencimento ? new Date(c.data_vencimento) : (() => {
    const d = new Date(mes); d.setDate(inq.dia_vencimento); return d;
  })();
  const dias = Math.max(0, Math.floor((new Date().getTime() - venc.getTime()) / 86400000));
  if (dias <= 0) return inq.valor_aluguel;
  const multa = inq.valor_aluguel * (inq.multa_percentual / 100);
  const juros = inq.valor_aluguel * (inq.juros_percentual / 100 / 30) * dias;
  return inq.valor_aluguel + multa + juros;
}
function diasAtraso(inq: Inquilino, c: Comprovante | undefined, mes: string) {
  if (c?.situation === "billed") return 0;
  const venc = c?.data_vencimento ? new Date(c.data_vencimento) : (() => {
    const d = new Date(mes); d.setDate(inq.dia_vencimento); return d;
  })();
  return Math.max(0, Math.floor((new Date().getTime() - venc.getTime()) / 86400000));
}

function getSituation(inq: Inquilino, c: Comprovante | undefined, mes: string): "billed"|"expired"|"open" {
  if (c?.situation === "billed") return "billed";
  if (c?.situation === "expired" || diasAtraso(inq, c, mes) > 0) return "expired";
  return "open";
}

function formaLabel(f: string | null) {
  const m: Record<string,string> = { pix:"Pix", dinheiro:"Dinheiro", transferencia:"Transferência", cartao:"Cartão", cheque:"Cheque" };
  return f ? (m[f] || f) : "—";
}

function whatsappLink(inq: Inquilino, total: number, mes: string, dias: number) {
  const phone = inq.telefone.replace(/\D/g,"").replace(/^0/,"55");
  const p = phone.startsWith("55") ? phone : "55"+phone;
  const msg = `Olá, *${inq.nome_completo}*! 👋\n\nIdentificamos que o aluguel de *${inq.imoveis?.titulo}* referente a *${mesLabel(mes)}* está em aberto.\n\n⏳ Dias em atraso: ${dias}\n💰 Valor atualizado: *${fmtBRL(total)}*\n_(aluguel + multa + juros pro rata)_\n\nPor favor, entre em contato para regularizar.\n\n*Borges Silva Locações*`;
  return `https://wa.me/${p}?text=${encodeURIComponent(msg)}`;
}

/* ─────────────── component ─────────────── */
export default function PagamentosList({ initialInquilinos, initialComprovantes, userId }: Props) {
  const hoje = new Date();
  const [mesAtual, setMesAtual] = useState(toISOMonth(hoje));
  const [comprovantes, setComprovantes] = useState<Comprovante[]>(initialComprovantes);
  const [filtro, setFiltro] = useState<"todos"|"open"|"expired"|"billed">("todos");
  const [aba, setAba] = useState<"mensal"|"inquilino">("mensal");
  const [inquilinoSel, setInquilinoSel] = useState<Inquilino | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalInq, setModalInq] = useState<Inquilino | null>(null);
  const [modalComp, setModalComp] = useState<Comprovante | null>(null);
  const [modalMes, setModalMes] = useState(toISOMonth(hoje));

  /* navegar mês */
  function navMes(dir: number) {
    const d = new Date(mesAtual);
    d.setMonth(d.getMonth() + dir);
    setMesAtual(toISOMonth(d));
  }

  /* abrir modal */
  function abrirModal(inq: Inquilino, comp: Comprovante | undefined, mes: string) {
    setModalInq(inq);
    setModalComp(comp || null);
    setModalMes(mes);
    setModalOpen(true);
  }

  /* recarregar comprovantes após salvar */
  const recarregar = useCallback(async () => {
    const sixAgo = new Date(); sixAgo.setMonth(sixAgo.getMonth()-6);
    const { data } = await supabase
      .from("comprovantes")
      .select(`id,inquilino_id,imovel_id,mes_referencia,valor,valor_multa,valor_juros,situation,data_vencimento,data_pagamento,forma_pagamento,pdf_url,descricao,created_at,imoveis!inner(proprietario_id)`)
      .eq("imoveis.proprietario_id", userId)
      .gte("mes_referencia", sixAgo.toISOString().split("T")[0])
      .order("mes_referencia", { ascending: false });
    setComprovantes(data || []);
  }, [userId]);

  /* comprovante do mês por inquilino */
  function compDoMes(inqId: string, mes: string) {
    return comprovantes.find(c => c.inquilino_id === inqId && c.mes_referencia.startsWith(mes.slice(0,7)));
  }

  /* sumário */
  const sumario = useMemo(() => {
    let totalReceber = 0, recebido = 0, pendente = 0, inadimplente = 0;
    initialInquilinos.forEach(inq => {
      const c = compDoMes(inq.id, mesAtual);
      const sit = getSituation(inq, c, mesAtual);
      const total = calcTotal(inq, c, mesAtual);
      totalReceber += inq.valor_aluguel;
      if (sit === "billed") recebido += (c?.valor||inq.valor_aluguel);
      else if (sit === "expired") inadimplente += total;
      else pendente += inq.valor_aluguel;
    });
    return { totalReceber, recebido, pendente, inadimplente };
  }, [initialInquilinos, comprovantes, mesAtual]);

  /* lista filtrada */
  const lista = useMemo(() => {
    return initialInquilinos.filter(inq => {
      if (filtro === "todos") return true;
      const c = compDoMes(inq.id, mesAtual);
      return getSituation(inq, c, mesAtual) === filtro;
    });
  }, [initialInquilinos, comprovantes, mesAtual, filtro]);

  /* histórico do inquilino selecionado */
  const historico = useMemo(() => {
    if (!inquilinoSel) return [];
    return comprovantes
      .filter(c => c.inquilino_id === inquilinoSel.id)
      .sort((a,b) => b.mes_referencia.localeCompare(a.mes_referencia));
  }, [comprovantes, inquilinoSel]);

  const [m,y] = [MESES[parseInt(mesAtual.split("-")[1])-1], mesAtual.split("-")[0]];

  return (
    <div className="space-y-6 p-6">
      <DashboardHeader title="Pagamentos" subtitle="Controle de recebimentos e inadimplência" />

      {/* abas */}
      <div className="flex border-b">
        {(["mensal","inquilino"] as const).map(a => (
          <button key={a} onClick={() => setAba(a)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${aba===a ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {a === "mensal" ? <><Building2 className="inline h-4 w-4 mr-1.5" />Visão mensal</> : <><User className="inline h-4 w-4 mr-1.5" />Por inquilino</>}
          </button>
        ))}
      </div>

      {/* ══════════ ABA MENSAL ══════════ */}
      {aba === "mensal" && (
        <>
          {/* cards sumário */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label:"Total a receber", val: sumario.totalReceber, cls:"text-foreground" },
              { label:"Recebido", val: sumario.recebido, cls:"text-green-600 dark:text-green-400" },
              { label:"Pendente", val: sumario.pendente, cls:"text-yellow-600 dark:text-yellow-400" },
              { label:"Inadimplente", val: sumario.inadimplente, cls:"text-red-600 dark:text-red-400" },
            ].map(({ label, val, cls }) => (
              <div key={label} className="bg-muted rounded-lg p-3">
                <p className="text-xs text-muted-foreground mb-1">{label}</p>
                <p className={`text-lg font-medium ${cls}`}>{fmtBRL(val)}</p>
              </div>
            ))}
          </div>

          {/* controles */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 border rounded-md px-3 py-1.5">
              <button onClick={() => navMes(-1)} className="text-muted-foreground hover:text-foreground"><ChevronLeft className="h-4 w-4" /></button>
              <span className="text-sm font-medium w-32 text-center">{m} / {y}</span>
              <button onClick={() => navMes(1)} className="text-muted-foreground hover:text-foreground"><ChevronRight className="h-4 w-4" /></button>
            </div>
            <div className="flex gap-1.5">
              {(["todos","open","expired","billed"] as const).map(f => (
                <button key={f} onClick={() => setFiltro(f)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${filtro===f ? "bg-primary text-primary-foreground border-primary" : "text-muted-foreground hover:text-foreground border-border"}`}>
                  {{todos:"Todos",open:"Em aberto",expired:"Vencidos",billed:"Pagos"}[f]}
                </button>
              ))}
            </div>
          </div>

          {/* lista */}
          <div className="space-y-2">
            {lista.length === 0 && (
              <div className="text-center py-12 text-muted-foreground text-sm">Nenhum inquilino encontrado para este filtro.</div>
            )}
            {lista.map(inq => {
              const comp = compDoMes(inq.id, mesAtual);
              const sit = getSituation(inq, comp, mesAtual);
              const dias = diasAtraso(inq, comp, mesAtual);
              const total = calcTotal(inq, comp, mesAtual);
              const encargos = total - inq.valor_aluguel;
              return (
                <Card key={inq.id} className={`${sit==="expired" ? "border-l-4 border-l-red-500" : ""}`}>
                  <CardContent className="p-4">
                    <div className="grid grid-cols-[2fr_1.2fr_1fr_auto] items-center gap-4">
                      <div>
                        <p className="font-medium text-sm">{inq.nome_completo}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Building2 className="h-3 w-3" />{inq.imoveis?.titulo}
                        </p>
                      </div>
                      <div>
                        {sit === "billed" && <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50 dark:bg-green-950"><CheckCircle2 className="h-3 w-3 mr-1" />Pago {fmtData(comp?.data_pagamento||null)}</Badge>}
                        {sit === "expired" && <Badge variant="outline" className="text-red-600 border-red-300 bg-red-50 dark:bg-red-950"><AlertCircle className="h-3 w-3 mr-1" />Vencido — {dias}d</Badge>}
                        {sit === "open" && <Badge variant="outline" className="text-blue-600 border-blue-300 bg-blue-50 dark:bg-blue-950"><Clock className="h-3 w-3 mr-1" />A vencer dia {inq.dia_vencimento}</Badge>}
                      </div>
                      <div>
                        <p className={`text-sm font-medium ${sit==="expired" ? "text-red-600" : ""}`}>{fmtBRL(total)}</p>
                        {sit==="expired" && encargos > 0 && <p className="text-xs text-red-500">+{fmtBRL(encargos)} enc.</p>}
                        {sit==="billed" && comp?.forma_pagamento && <p className="text-xs text-muted-foreground">{formaLabel(comp.forma_pagamento)}</p>}
                      </div>
                      <div className="flex gap-2">
                        {sit !== "billed" && (
                          <>
                            {sit === "expired" && (
                              <a href={whatsappLink(inq,total,mesAtual,dias)} target="_blank" rel="noreferrer">
                                <Button size="sm" variant="outline" className="text-green-600 border-green-400 px-2">
                                  <MessageCircle className="h-4 w-4" />
                                </Button>
                              </a>
                            )}
                            <Button size="sm" onClick={() => abrirModal(inq, comp, mesAtual)}>Registrar pagamento</Button>
                          </>
                        )}
                        {sit === "billed" && comp?.pdf_url && (
                          <a href={comp.pdf_url} target="_blank" rel="noreferrer">
                            <Button size="sm" variant="outline"><FileText className="h-4 w-4 mr-1" />Comprovante</Button>
                          </a>
                        )}
                        {sit === "billed" && !comp?.pdf_url && (
                          <Button size="sm" variant="outline" onClick={() => abrirModal(inq, comp, mesAtual)}>
                            <FileText className="h-4 w-4 mr-1" />Gerar PDF
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {/* ══════════ ABA POR INQUILINO ══════════ */}
      {aba === "inquilino" && (
        <div className="grid md:grid-cols-[280px_1fr] gap-6">
          {/* lista inquilinos */}
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-3">Inquilinos ativos</p>
            {initialInquilinos.map(inq => {
              const vencidos = comprovantes.filter(c => c.inquilino_id === inq.id && c.situation === "expired").length;
              return (
                <button key={inq.id} onClick={() => setInquilinoSel(inq)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${inquilinoSel?.id === inq.id ? "border-primary bg-primary/5" : "border-border hover:border-border/80 hover:bg-muted/50"}`}>
                  <p className="text-sm font-medium">{inq.nome_completo}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{inq.imoveis?.titulo}</p>
                  <div className="flex gap-1.5 mt-1.5">
                    {vencidos > 0 && <span className="text-xs bg-red-50 dark:bg-red-950 text-red-600 px-2 py-0.5 rounded-full">{vencidos} vencida{vencidos>1?"s":""}</span>}
                    {vencidos === 0 && <span className="text-xs bg-green-50 dark:bg-green-950 text-green-600 px-2 py-0.5 rounded-full">em dia</span>}
                  </div>
                </button>
              );
            })}
          </div>

          {/* detalhe */}
          {!inquilinoSel && (
            <div className="flex items-center justify-center h-48 text-muted-foreground text-sm border rounded-lg">
              Selecione um inquilino para ver o histórico
            </div>
          )}
          {inquilinoSel && (
            <div>
              <Card>
                <div className="p-4 border-b flex items-center justify-between">
                  <div>
                    <p className="font-medium">{inquilinoSel.nome_completo}</p>
                    <p className="text-sm text-muted-foreground">
                      {inquilinoSel.imoveis?.titulo} · {inquilinoSel.tipo_pessoa==="juridica" ? `CNPJ ${inquilinoSel.cnpj}` : `CPF ${inquilinoSel.cpf}`} · {inquilinoSel.telefone}
                    </p>
                  </div>
                  <Button size="sm" onClick={() => abrirModal(inquilinoSel, compDoMes(inquilinoSel.id, mesAtual), mesAtual)}>
                    + Registrar pagamento
                  </Button>
                </div>
                <CardContent className="p-0">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-3 text-xs text-muted-foreground font-medium uppercase tracking-wide">Referência</th>
                        <th className="text-left p-3 text-xs text-muted-foreground font-medium uppercase tracking-wide">Vencimento</th>
                        <th className="text-left p-3 text-xs text-muted-foreground font-medium uppercase tracking-wide">Valor</th>
                        <th className="text-left p-3 text-xs text-muted-foreground font-medium uppercase tracking-wide">Forma</th>
                        <th className="text-left p-3 text-xs text-muted-foreground font-medium uppercase tracking-wide">Situação</th>
                        <th className="p-3"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {historico.length === 0 && (
                        <tr><td colSpan={6} className="text-center p-6 text-muted-foreground text-xs">Nenhum comprovante registrado</td></tr>
                      )}
                      {historico.map(c => (
                        <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="p-3 font-medium">{mesLabel(c.mes_referencia)}</td>
                          <td className="p-3 text-muted-foreground">{fmtData(c.data_vencimento)}</td>
                          <td className="p-3">
                            <span className={c.situation==="expired" ? "text-red-600" : ""}>{fmtBRL((c.valor||0)+(c.valor_multa||0)+(c.valor_juros||0))}</span>
                            {(c.valor_multa||0) > 0 && <span className="text-xs text-red-400 ml-1">(+enc.)</span>}
                          </td>
                          <td className="p-3 text-muted-foreground">{formaLabel(c.forma_pagamento)}</td>
                          <td className="p-3">
                            {c.situation==="billed" && <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50 dark:bg-green-950"><CheckCircle2 className="h-3 w-3 mr-1" />Pago {fmtData(c.data_pagamento)}</Badge>}
                            {c.situation==="expired" && <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50 dark:bg-red-950"><AlertCircle className="h-3 w-3 mr-1" />Vencido</Badge>}
                            {c.situation==="open" && <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50 dark:bg-blue-950"><Clock className="h-3 w-3 mr-1" />Em aberto</Badge>}
                          </td>
                          <td className="p-3">
                            <div className="flex gap-1.5 justify-end">
                              {c.situation !== "billed" && (
                                <Button size="sm" variant="outline" onClick={() => abrirModal(inquilinoSel, c, c.mes_referencia)}>Registrar</Button>
                              )}
                              {c.pdf_url && (
                                <a href={c.pdf_url} target="_blank" rel="noreferrer">
                                  <Button size="sm" variant="ghost"><FileText className="h-4 w-4" /></Button>
                                </a>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* modal */}
      {modalOpen && modalInq && (
        <RegistrarPagamentoModal
          open={modalOpen} onClose={() => setModalOpen(false)} onSuccess={recarregar}
          inquilino={modalInq} comprovante={modalComp} mesReferencia={modalMes}
        />
      )}
    </div>
  );
}
