// Based on Lugo — Copyright (c) 2024 Renilson Medeiros — MIT License
"use client";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface Inquilino {
  id: string; nome_completo: string; cpf: string; cnpj: string;
  tipo_pessoa: string; telefone: string; valor_aluguel: number;
  dia_vencimento: number; multa_percentual: number; juros_percentual: number;
  imovel_id: string; imoveis: { id: string; titulo: string; endereco_rua: string; endereco_numero: string; };
}

interface Comprovante {
  id: string; inquilino_id: string; mes_referencia: string; valor: number;
  valor_multa: number; valor_juros: number; situation: string;
  data_vencimento: string; data_pagamento: string | null;
  forma_pagamento: string | null; pdf_url: string | null; descricao: string | null;
}

interface Props {
  open: boolean; onClose: () => void; onSuccess: () => void;
  inquilino: Inquilino; comprovante: Comprovante | null;
  mesReferencia: string;
}

function calcEncargos(valor: number, multa: number, juros: number, diasAtraso: number) {
  if (diasAtraso <= 0) return { multa: 0, juros: 0, total: valor };
  const v_multa = valor * (multa / 100);
  const v_juros = valor * (juros / 100 / 30) * diasAtraso;
  return { multa: v_multa, juros: v_juros, total: valor + v_multa + v_juros };
}

function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function mesLabel(iso: string) {
  const [y, m] = iso.split("-");
  const meses = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  return `${meses[parseInt(m) - 1]}/${y}`;
}

export default function RegistrarPagamentoModal({ open, onClose, onSuccess, inquilino, comprovante, mesReferencia }: Props) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [dataPag, setDataPag] = useState(() => new Date().toISOString().split("T")[0]);
  const [forma, setForma] = useState("pix");
  const [obs, setObs] = useState("");
  const [aplicarEncargos, setAplicarEncargos] = useState(true);

  const vencimento = comprovante?.data_vencimento
    ? new Date(comprovante.data_vencimento)
    : (() => { const d = new Date(mesReferencia); d.setDate(inquilino.dia_vencimento); return d; })();

  const hoje = new Date();
  const diasAtraso = Math.max(0, Math.floor((hoje.getTime() - vencimento.getTime()) / 86400000));
  const atrasado = diasAtraso > 0;
  const enc = calcEncargos(inquilino.valor_aluguel, inquilino.multa_percentual, inquilino.juros_percentual, diasAtraso);
  const totalFinal = aplicarEncargos && atrasado ? enc.total : inquilino.valor_aluguel;

  async function confirmar() {
    if (!user) return;
    try {
      setLoading(true);
      const v_multa = aplicarEncargos && atrasado ? enc.multa : 0;
      const v_juros = aplicarEncargos && atrasado ? enc.juros : 0;

      let compId = comprovante?.id;

      if (compId) {
        // Atualizar existente
        await supabase.from("comprovantes").update({
          valor: inquilino.valor_aluguel, valor_multa: v_multa, valor_juros: v_juros,
          situation: "billed", data_pagamento: dataPag,
          forma_pagamento: forma, descricao: obs || null,
        }).eq("id", compId);
      } else {
        // Criar novo
        const venc = new Date(mesReferencia);
        venc.setDate(inquilino.dia_vencimento);
        const { data: novo } = await supabase.from("comprovantes").insert({
          inquilino_id: inquilino.id, imovel_id: inquilino.imovel_id,
          tipo: "pagamento", mes_referencia: mesReferencia,
          valor: inquilino.valor_aluguel, valor_multa: v_multa, valor_juros: v_juros,
          situation: "billed", data_vencimento: venc.toISOString().split("T")[0],
          data_pagamento: dataPag, forma_pagamento: forma, descricao: obs || null,
        }).select().single();
        compId = novo?.id;
      }

      // Gerar PDF
      if (compId && user) {
        const res = await fetch("/api/pdf/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: user.id, propertyId: inquilino.imovel_id,
            data: {
              referenceMonth: mesReferencia.split("-")[1],
              referenceYear: mesReferencia.split("-")[0],
              tenantName: inquilino.nome_completo,
              tenantCpf: inquilino.tipo_pessoa === "juridica" ? inquilino.cnpj : inquilino.cpf,
              propertyName: inquilino.imoveis?.titulo || "",
              propertyAddress: `${inquilino.imoveis?.endereco_rua}, ${inquilino.imoveis?.endereco_numero}`,
              rentValue: fmtBRL(inquilino.valor_aluguel),
              totalValue: fmtBRL(totalFinal),
              paymentDate: dataPag,
              observations: obs || undefined,
            },
          }),
        });
        const pdf = await res.json();
        if (pdf.success && pdf.pdfUrl) {
          await supabase.from("comprovantes").update({ pdf_url: pdf.pdfUrl }).eq("id", compId);
          window.open(pdf.pdfUrl, "_blank");
        }
      }

      toast.success("Pagamento registrado!", { description: `${mesLabel(mesReferencia)} · ${fmtBRL(totalFinal)}` });
      onSuccess();
      onClose();
    } catch (e) {
      toast.error("Erro ao registrar pagamento");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar pagamento</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {inquilino.nome_completo} · {inquilino.imoveis?.titulo} · {mesLabel(mesReferencia)}
          </p>
        </DialogHeader>
        <div className="space-y-4">
          {/* Encargos */}
          {atrasado && (
            <div className="rounded-lg bg-muted p-3 space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Encargos por atraso — {diasAtraso} dias</p>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span>Aluguel base</span><span>{fmtBRL(inquilino.valor_aluguel)}</span></div>
                <div className="flex justify-between text-destructive"><span>Multa ({inquilino.multa_percentual}%)</span><span>{fmtBRL(enc.multa)}</span></div>
                <div className="flex justify-between text-destructive"><span>Juros ({inquilino.juros_percentual}%/mês pro rata)</span><span>{fmtBRL(enc.juros)}</span></div>
                <div className="flex justify-between font-semibold border-t pt-1 mt-1" style={{color: aplicarEncargos ? "var(--destructive)" : undefined}}>
                  <span>Total</span><span>{fmtBRL(totalFinal)}</span>
                </div>
              </div>
              <div className="flex items-center justify-between pt-1">
                <Label className="text-xs">Aplicar encargos</Label>
                <Switch checked={aplicarEncargos} onCheckedChange={setAplicarEncargos} />
              </div>
            </div>
          )}
          {!atrasado && (
            <div className="rounded-lg bg-muted p-3">
              <div className="flex justify-between text-sm font-medium">
                <span>Valor do aluguel</span><span>{fmtBRL(inquilino.valor_aluguel)}</span>
              </div>
            </div>
          )}

          {/* Data */}
          <div className="space-y-1">
            <Label>Data do pagamento</Label>
            <input type="date" value={dataPag} onChange={e => setDataPag(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          </div>

          {/* Forma */}
          <div className="space-y-1">
            <Label>Forma de pagamento</Label>
            <Select value={forma} onValueChange={setForma}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pix">Pix</SelectItem>
                <SelectItem value="dinheiro">Dinheiro</SelectItem>
                <SelectItem value="transferencia">Transferência</SelectItem>
                <SelectItem value="cartao">Cartão</SelectItem>
                <SelectItem value="cheque">Cheque</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Observação */}
          <div className="space-y-1">
            <Label>Observação <span className="text-muted-foreground font-normal">(opcional)</span></Label>
            <Textarea value={obs} onChange={e => setObs(e.target.value)}
              placeholder="Ex: pagamento parcial, acordo, etc." className="min-h-[60px]" />
          </div>

          {/* Botões */}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
            <Button onClick={confirmar} disabled={loading}>
              {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Salvando...</> : "Confirmar pagamento"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
