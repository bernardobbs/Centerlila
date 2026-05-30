// Based on Lugo — Copyright (c) 2024 Renilson Medeiros — MIT License

export type TipoImovel =
  // Residencial
  | 'casa'
  | 'apartamento'
  // Center Lila (comercial)
  | 'loja'
  | 'box'
  | 'sala'
  | 'quiosque'
  | 'deposito';

export type StatusImovel = 'disponivel' | 'alugado' | 'manutencao';

export type TipoPessoa = 'fisica' | 'juridica';

export type SituacaoParcela = 'open' | 'expired' | 'billed';

export type CorrecaoMonetaria = 'igpm' | 'ipca' | 'inpc' | 'manual' | 'nenhuma';

export type GarantiaLocaticia =
  | 'nenhuma'
  | 'caucao'
  | 'fiador'
  | 'seguro_fianca'
  | 'titulo_capitalizacao';

export interface Imovel {
  id: string;
  tipo: TipoImovel;
  descricao?: string;
  fotos?: string[];
  status: StatusImovel;
  do_center: boolean;

  // endereço (residenciais)
  endereco?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  cep?: string;

  // unidade comercial (Center Lila)
  numero_unidade?: string;
  andar?: string;

  // características
  area_m2?: number;
  quartos?: number;
  banheiros?: number;
  vagas?: number;
  valor_aluguel: number;
  valor_condominio?: number;

  created_at: string;
  updated_at: string;
}

export interface Locatario {
  id: string;
  imovel_id: string;
  tipo_pessoa: TipoPessoa;

  // PF
  nome_completo: string;
  cpf?: string;
  rg?: string;

  // PJ
  cnpj?: string;
  razao_social?: string;
  nome_fantasia?: string;
  ramo_atividade?: string;

  // contato
  telefone: string;
  email?: string;

  // locação
  data_inicio: string;
  data_fim?: string;
  valor_aluguel: number;
  dia_vencimento: number;

  // encargos
  multa_percentual: number;
  juros_percentual: number;
  correcao_monetaria: CorrecaoMonetaria;
  garantia: GarantiaLocaticia;

  numero_contrato?: string;
  fotos_contrato?: string[];
  observacoes?: string;
  status: 'ativo' | 'inativo';

  notificacao_wa_em?: string;
  notificacao_wa_por?: string;

  created_at: string;
  updated_at: string;
}

export interface Comprovante {
  id: string;
  locatario_id: string;
  imovel_id: string;
  tipo: 'pagamento' | 'locacao';
  mes_referencia: string;

  valor_base: number;
  valor_multa: number;
  valor_juros: number;
  valor_desconto: number;
  valor_total: number;

  situation: SituacaoParcela;
  data_vencimento: string;
  data_pagamento?: string;

  descricao?: string;
  pdf_url?: string;

  created_by?: string;
  created_at: string;
}

// =====================================================
// Aliases de compatibilidade com o Lugo original
// =====================================================

/** Alias de Imovel para compatibilidade com componentes do Lugo */
export type Property = Imovel & {
  // campos extras usados nos componentes de detalhe público
  titulo?: string;
  preco?: number;
  proprietario_id?: string;
};

export interface HistoricalTenant {
  id: string;
  imovel_id: string;
  nome_completo: string;
  cpf?: string;
  cnpj?: string;
  telefone: string;
  email?: string;
  data_inicio: string;
  data_fim?: string;
  valor_aluguel: number;
  status: 'ativo' | 'inativo';
  created_at: string;
}
