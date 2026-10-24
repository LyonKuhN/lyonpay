// Leitura de extratos bancários (OFX e CSV) direto no navegador: o arquivo não sai do aparelho,
// só os lançamentos escolhidos vão para a API.

export interface LinhaExtrato {
  /** Identificador estável do lançamento (evita importar duas vezes). */
  id: string;
  data: string; // AAAA-MM-DD
  descricao: string;
  /** Negativo = saída, positivo = entrada (como no extrato). */
  valor: number;
}

/** Lê o arquivo respeitando a codificação: bancos brasileiros ainda mandam OFX em Windows-1252. */
export async function lerTexto(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const utf8 = new TextDecoder('utf-8').decode(buf);
  const cabecalho = utf8.slice(0, 400).toUpperCase();
  if (utf8.includes('�') || /CHARSET:\s*1252|ENCODING="?WINDOWS-1252|ENCODING="?ISO-8859-1/.test(cabecalho)) {
    return new TextDecoder('windows-1252').decode(buf);
  }
  return utf8;
}

/** Número em qualquer formato comum: "-1.234,56", "1234.56", "R$ 12,00", "(12,00)". */
export function numero(texto: string): number {
  let s = String(texto ?? '').trim();
  const negativo = /^\(.*\)$/.test(s) || /^-/.test(s.replace(/^R\$\s*/i, '')) || /-$/.test(s);
  s = s.replace(/[^\d,.]/g, '');
  if (!s) return NaN;
  const ultimaVirgula = s.lastIndexOf(',');
  const ultimoPonto = s.lastIndexOf('.');
  if (ultimaVirgula > ultimoPonto) s = s.replace(/\./g, '').replace(',', '.');
  else s = s.replace(/,/g, '');
  const n = parseFloat(s);
  return isNaN(n) ? NaN : negativo ? -Math.abs(n) : n;
}

/** Datas "dd/mm/aaaa", "dd/mm/aa", "aaaa-mm-dd", "dd-mm-aaaa" e "aaaammdd" → "aaaa-mm-dd". */
export function dataISO(texto: string): string | null {
  const s = String(texto ?? '').trim();
  let m = /^(\d{4})-?(\d{2})-?(\d{2})/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/.exec(s);
  if (m) {
    const ano = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${ano}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }
  return null;
}

/** Hash curto e estável (FNV-1a) para montar identificadores de linhas de CSV. */
export function hash(texto: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

const limpar = (s: string) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();

/** OFX 1.x (SGML, sem fechar as tags) e 2.x (XML). */
export function lerOFX(texto: string): LinhaExtrato[] {
  const blocos = texto.split(/<STMTTRN>/i).slice(1);
  const linhas: LinhaExtrato[] = [];
  const campo = (bloco: string, tag: string) => {
    const m = new RegExp(`<${tag}>([^<\\r\\n]*)`, 'i').exec(bloco);
    return m ? limpar(m[1]) : '';
  };
  for (const b of blocos) {
    const bloco = b.split(/<\/STMTTRN>/i)[0];
    const data = dataISO(campo(bloco, 'DTPOSTED'));
    const valor = numero(campo(bloco, 'TRNAMT'));
    const memo = campo(bloco, 'MEMO');
    const nome = campo(bloco, 'NAME');
    const descricao = (memo && nome && !memo.includes(nome) ? `${nome} ${memo}` : memo || nome || campo(bloco, 'TRNTYPE')).slice(0, 200);
    const fitid = campo(bloco, 'FITID');
    if (!data || !Number.isFinite(valor) || valor === 0) continue;
    linhas.push({ id: fitid || hash(`${data}|${descricao}|${valor}`), data, descricao: descricao || 'Lançamento', valor });
  }
  return linhas;
}

/** Separa um CSV com aspas, detectando ; , ou tabulação. */
export function lerCSV(texto: string): string[][] {
  const amostra = texto.split(/\r?\n/).slice(0, 5).join('\n');
  const sep = [';', '\t', ','].map((s) => ({ s, n: amostra.split(s).length })).sort((a, b) => b.n - a.n)[0].s;
  const linhas: string[][] = [];
  let atual: string[] = [];
  let campo = '';
  let aspas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (aspas) {
      if (c === '"' && texto[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') aspas = false;
      else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === sep) { atual.push(campo); campo = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && texto[i + 1] === '\n') i++;
      atual.push(campo);
      if (atual.some((x) => x.trim())) linhas.push(atual.map((x) => x.trim()));
      atual = [];
      campo = '';
    } else campo += c;
  }
  atual.push(campo);
  if (atual.some((x) => x.trim())) linhas.push(atual.map((x) => x.trim()));
  return linhas;
}

export interface MapaCSV {
  data: number;
  descricao: number;
  /** Coluna única de valor (com sinal) ou -1 quando o banco separa débito e crédito. */
  valor: number;
  debito: number;
  credito: number;
  /** Fatura de cartão: valores positivos são compras (saídas). */
  positivoEhSaida: boolean;
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Adivinha as colunas pelo cabeçalho. */
export function adivinharMapa(cabecalho: string[]): MapaCSV {
  const h = cabecalho.map(norm);
  const achar = (...termos: string[]) => h.findIndex((c) => termos.some((t) => c.includes(t)));
  const valor = achar('valor', 'amount', 'quantia', 'montante');
  return {
    data: Math.max(0, achar('data', 'date', 'dt ')),
    descricao: Math.max(0, achar('descri', 'histor', 'lancamento', 'title', 'estabelec', 'memo', 'detalhe')),
    valor,
    debito: valor >= 0 ? -1 : achar('debito', 'saida'),
    credito: valor >= 0 ? -1 : achar('credito', 'entrada'),
    positivoEhSaida: h.some((c) => c === 'title' || c.includes('estabelecimento')),
  };
}

export function aplicarMapa(linhas: string[][], mapa: MapaCSV): LinhaExtrato[] {
  const contagem = new Map<string, number>();
  const saida: LinhaExtrato[] = [];
  for (const l of linhas) {
    const data = dataISO(l[mapa.data] ?? '');
    const descricao = limpar(l[mapa.descricao] ?? '').slice(0, 200);
    let valor: number;
    if (mapa.valor >= 0) {
      valor = numero(l[mapa.valor] ?? '');
      if (mapa.positivoEhSaida) valor = -valor;
    } else {
      const deb = numero(l[mapa.debito] ?? '');
      const cre = numero(l[mapa.credito] ?? '');
      valor = (Number.isFinite(cre) ? Math.abs(cre) : 0) - (Number.isFinite(deb) ? Math.abs(deb) : 0);
    }
    if (!data || !descricao || !Number.isFinite(valor) || valor === 0) continue;
    // Duas linhas iguais no mesmo dia (dois cafés) são lançamentos diferentes
    const base = `${data}|${descricao}|${valor}`;
    const n = (contagem.get(base) ?? 0) + 1;
    contagem.set(base, n);
    saida.push({ id: hash(`${base}|${n}`), data, descricao, valor });
  }
  return saida;
}

/** Termo para regra de categoria: sem números e símbolos, as primeiras palavras. */
export function termoDaDescricao(descricao: string): string {
  return norm(descricao)
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((p) => p.length > 1 && !['pix', 'ted', 'doc', 'compra', 'pagamento', 'pag', 'transf', 'debito', 'credito', 'cartao', 'de', 'do', 'da'].includes(p))
    .slice(0, 2)
    .join(' ');
}

export function categoriaPorRegras(regras: Array<{ termo: string; categoria: string; tipo?: string | null }>, descricao: string, tipo: 'despesa' | 'receita') {
  const d = norm(descricao);
  const ordenadas = [...regras].sort((a, b) => b.termo.length - a.termo.length);
  return ordenadas.find((r) => (!r.tipo || r.tipo === tipo) && d.includes(norm(r.termo)))?.categoria ?? null;
}
