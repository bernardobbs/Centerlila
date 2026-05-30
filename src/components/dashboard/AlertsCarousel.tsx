// Based on Lugo — Copyright (c) 2024 Renilson Medeiros — MIT License
"use client";
import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Clock, ChevronLeft, ChevronRight, TrendingUp, MessageCircle } from "lucide-react";
import useEmblaCarousel from "embla-carousel-react";
import { cn } from "@/lib/utils";

interface DashboardAlert {
  id: string;
  tenantName: string;
  propertyName: string;
  dueDate: number;
  type: "upcoming" | "overdue";
  amount: number;
  diasAtraso?: number;
}

interface AlertsCarouselProps { alerts: DashboardAlert[]; }

function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function AlertsCarousel({ alerts }: AlertsCarouselProps) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, align: "start" });
  const [selectedIndex, setSelectedIndex] = useState(0);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onSelect);
  }, [emblaApi, onSelect]);

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  const vencidos = alerts.filter(a => a.type === "overdue");
  const emAberto = alerts.filter(a => a.type === "upcoming");

  if (alerts.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-tertiary" />
            Avisos e Pendências
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <div className="h-10 w-10 rounded-lg bg-green-50 flex items-center justify-center mb-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
            </div>
            <p className="text-sm font-medium text-green-700">Tudo em dia!</p>
            <p className="text-xs text-muted-foreground mt-1">Todos os pagamentos do mês estão confirmados.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-tertiary" />
          Avisos e Pendências
          <span className="ml-1 bg-red-100 text-red-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
            {alerts.length}
          </span>
        </CardTitle>
        {alerts.length > 1 && (
          <div className="flex gap-1">
            <button onClick={scrollPrev} className="h-6 w-6 rounded-full border flex items-center justify-center hover:bg-accent" aria-label="anterior">
              <ChevronLeft className="h-3 w-3" />
            </button>
            <button onClick={scrollNext} className="h-6 w-6 rounded-full border flex items-center justify-center hover:bg-accent" aria-label="próximo">
              <ChevronRight className="h-3 w-3" />
            </button>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-2 pb-3">
        {/* Sumário rápido */}
        {(vencidos.length > 0 || emAberto.length > 0) && (
          <div className="flex gap-2 mb-3">
            {vencidos.length > 0 && (
              <div className="flex-1 bg-red-50 rounded-md px-2.5 py-1.5 text-center">
                <p className="text-xs font-semibold text-red-700">{vencidos.length} vencido{vencidos.length > 1 ? "s" : ""}</p>
              </div>
            )}
            {emAberto.length > 0 && (
              <div className="flex-1 bg-amber-50 rounded-md px-2.5 py-1.5 text-center">
                <p className="text-xs font-semibold text-amber-700">{emAberto.length} em aberto</p>
              </div>
            )}
          </div>
        )}

        {/* Carrossel */}
        <div className="overflow-hidden" ref={emblaRef}>
          <div className="flex">
            {alerts.map((alert) => {
              const isOverdue = alert.type === "overdue";
              return (
                <div key={alert.id} className="flex-[0_0_100%] min-w-0 px-0.5">
                  <div className={cn(
                    "flex items-start gap-3 p-3 rounded-lg border",
                    isOverdue ? "bg-red-50 border-red-200" : "bg-amber-50 border-amber-200"
                  )}>
                    <div className={cn(
                      "mt-0.5 h-8 w-8 rounded-full flex items-center justify-center shrink-0",
                      isOverdue ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-600"
                    )}>
                      {isOverdue ? <AlertCircle className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={cn("text-sm font-semibold truncate", isOverdue ? "text-red-900" : "text-amber-900")}>
                        {isOverdue ? `Vencido há ${alert.diasAtraso}d` : `Vence dia ${alert.dueDate}`}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{alert.tenantName}</p>
                      <p className="text-xs text-muted-foreground truncate">{alert.propertyName}</p>
                      <p className={cn("text-xs font-semibold mt-1", isOverdue ? "text-red-700" : "text-amber-700")}>
                        {fmtBRL(alert.amount)}
                        {isOverdue && alert.diasAtraso && alert.diasAtraso > 0 && (
                          <span className="font-normal text-muted-foreground"> (c/ encargos)</span>
                        )}
                      </p>
                    </div>
                    <Link href="/dashboard/pagamentos" className={cn(
                      "shrink-0 text-xs font-medium px-2 py-1 rounded-md border transition-colors",
                      isOverdue ? "border-red-300 text-red-700 hover:bg-red-100" : "border-amber-300 text-amber-700 hover:bg-amber-100"
                    )}>
                      Pagar
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
          {alerts.length > 1 && (
            <div className="flex justify-center gap-1.5 mt-2">
              {alerts.map((_, i) => (
                <div key={i} className={cn("h-1 rounded-full transition-all", i === selectedIndex ? "w-4 bg-tertiary" : "w-1 bg-gray-300")} />
              ))}
            </div>
          )}
        </div>

        <Link href="/dashboard/pagamentos" className="block text-center text-xs text-muted-foreground hover:text-foreground pt-1 underline underline-offset-2">
          Ver todos os pagamentos →
        </Link>
      </CardContent>
    </Card>
  );
}
