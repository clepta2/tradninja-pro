export interface TradNinjaOptions {
  baseUrl?: string;
}

export interface TranslateOptions {
  from?: string;
  to?: string;
}

export interface TranslateResult {
  ok: boolean;
  textoOriginal: string;
  textoTraduzido: string;
  idiomaOrigem: string;
  idiomaDestino: string;
  tempoMs: number;
  plano: string;
  timestamp: string;
}

export declare class TradNinjaClient {
  constructor(apiKey?: string, options?: TradNinjaOptions);
  translate(text: string, options?: TranslateOptions): Promise<TranslateResult>;
  translateBatch(phrases: string[], options?: TranslateOptions): Promise<any>;
}

export default TradNinjaClient;
