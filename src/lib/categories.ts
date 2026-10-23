import {
  Briefcase, Car, CircleDollarSign, CreditCard, Droplets, Dumbbell, Gamepad2, Gift, GraduationCap,
  HeartPulse, House, Landmark, PawPrint, Plane, Receipt, Repeat, Shirt, ShoppingBag, ShoppingCart,
  Smartphone, TrendingUp, UtensilsCrossed, Wifi, Wrench, Zap, Baby, Fuel, Coffee, Tag,
  type LucideIcon,
} from 'lucide-react';

const RULES: Array<[RegExp, LucideIcon]> = [
  [/salari|pro.?labore|holerite/, Briefcase],
  [/invest|rendiment|dividend|juros|poupanc/, TrendingUp],
  [/freela|servico|venda|extra|bonus|comiss/, CircleDollarSign],
  [/mercado|supermerc|feira|hortifr/, ShoppingCart],
  [/aliment|restaur|lanche|ifood|delivery|comida/, UtensilsCrossed],
  [/cafe|padaria/, Coffee],
  [/combust|gasolina|posto/, Fuel],
  [/transport|uber|carro|onibus|metro|estacion|veicul|ipva/, Car],
  [/morad|aluguel|condomin|casa|iptu|financiamento/, House],
  [/energia|luz|eletric/, Zap],
  [/agua|saneamento/, Droplets],
  [/internet|wi-?fi|fibra/, Wifi],
  [/telefon|celular|plano movel/, Smartphone],
  [/saude|medic|farmac|plano de saude|hospital|dentist/, HeartPulse],
  [/academia|esporte|treino/, Dumbbell],
  [/educa|escola|faculd|curso|livro/, GraduationCap],
  [/lazer|cinema|jogo|stream|netflix|spotify|diversao/, Gamepad2],
  [/assinatura|mensalidade|recorrent/, Repeat],
  [/cartao|fatura|credito/, CreditCard],
  [/imposto|taxa|tribut|banco|tarifa/, Landmark],
  [/roupa|vestu|moda|calcad/, Shirt],
  [/compra|shopping/, ShoppingBag],
  [/viage|hotel|passage|turismo/, Plane],
  [/presente|doac/, Gift],
  [/pet|cachorr|gato|veterin/, PawPrint],
  [/filho|crianc|bebe/, Baby],
  [/manutenc|reparo|reforma/, Wrench],
  [/conta|boleto/, Receipt],
];

function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function categoryIcon(categoria?: string | null): LucideIcon {
  if (!categoria) return Tag;
  const key = normalize(categoria);
  for (const [re, icon] of RULES) if (re.test(key)) return icon;
  return Tag;
}

/** Paleta para gráficos de categoria, legível nos dois temas. */
export const CHART_COLORS = ['#d4af5f', '#6ea8f7', '#3ccb7f', '#f0896d', '#a78bfa', '#4fc3c7', '#e57fb0', '#9ba1ad'];
