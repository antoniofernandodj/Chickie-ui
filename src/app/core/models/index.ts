// ─── Enums ───────────────────────────────────────────────────────────────────

export type ClasseUsuario =
  | 'cliente'
  | 'administrador'
  | 'funcionario'
  | 'entregador'
  | 'owner';

export type StatusPedido =
  | 'criado'
  | 'aguardando_confirmacao_de_loja'
  | 'confirmado_pela_loja'
  | 'em_preparo'
  | 'pronto'
  | 'saiu_para_entrega'
  | 'entregue'
  | 'cancelado';

export type TipoDesconto = 'percentual' | 'valor_fixo' | 'frete_gratis';
export type TipoEscopo   = 'loja' | 'produto' | 'categoria';
export type StatusCupom  = 'Ativo' | 'Inativo' | 'Expirado';
export type TipoCalculoPedido = 'MaisCaro' | 'MediaPonderada';

// ─── Configuração de Pedidos ─────────────────────────────────────────────────

export interface ConfiguracaoDePedidosLoja {
  uuid:         string;
  loja_uuid:    string;
  max_partes:   number;
  tipo_calculo: TipoCalculoPedido;
}

export interface UpdateConfigPedidoRequest {
  max_partes?:   number;
  tipo_calculo?: string;
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export interface SignupRequest {
  nome:        string;
  username:    string;
  senha:       string;
  email:       string;
  celular:     string;
  cpf:         string;
  auth_method: string;
  classe?:     ClasseUsuario;
}

export interface SignupResponse {
  message: string;
}

export interface ConfirmarEmailResponse {
  token:   string;
  usuario: Usuario;
}

export interface LoginRequest {
  identifier: string;
  senha: string;
}

export interface LoginResponse {
  access_token: string;
  token_type:   'Bearer';
}

// ─── Usuario ─────────────────────────────────────────────────────────────────

export interface Usuario {
  uuid:                       string;
  nome:                       string;
  username:                   string;
  email:                      string;
  celular:                    string;
  cpf:                        string;
  asaas_customer_id:          string | null;
  classe:                     ClasseUsuario;
  ativo:                      boolean;
  passou_pelo_primeiro_acesso:boolean;
  criado_em:                  string;
  atualizado_em:              string;
  modo_de_cadastro:           string;
  senha_hash?:                string;
}

// ─── Loja ─────────────────────────────────────────────────────────────────────

export interface Loja {
  uuid:                string;
  nome:                string;
  slug:                string;
  descricao:           string | null;
  email:               string;
  celular:             string | null;
  ativa:               boolean;
  logo_url:            string | null;
  banner_url:          string | null;
  horario_abertura:    string | null;
  horario_fechamento:  string | null;
  dias_funcionamento:  string | null;
  tempo_preparo_min:   number;
  taxa_entrega:        number;
  valor_minimo_pedido: number;
  raio_entrega_km:     number;
  nota_media:          number | null;
  aberta?:             boolean;
  criado_em:           string;
  atualizado_em:       string;
}

export interface CreateLojaRequest {
  nome:               string;
  slug:               string;
  email_contato:      string;
  descricao?:         string | null;
  celular?:           string | null;
  hora_abertura?:     string | null;
  hora_fechamento?:   string | null;
  dias_funcionamento?:string | null;
  tempo_medio:        number;
  nota_media:         number;
  taxa_entrega_base:  number;
  pedido_minimo:      number;
  max_partes:         number;
}

// ─── Funcionario ─────────────────────────────────────────────────────────────

export interface Funcionario {
  uuid:          string;
  loja_uuid:     string;
  usuario_uuid:  string;
  cargo:         string | null;
  salario:       number;
  data_admissao: string;
  criado_em:     string;
}

export interface CreateFuncionarioRequest {
  nome:          string;
  username:      string;
  email:         string;
  senha:         string;
  celular:       string;
  cargo?:        string | null;
  salario:       number;
  data_admissao: string;
}

export interface UpdateFuncionarioRequest {
  cargo?:         string | null;
  salario?:       number;
  data_admissao?: string;
}

// ─── Entregador ───────────────────────────────────────────────────────────────

export interface Entregador {
  uuid:         string;
  loja_uuid:    string;
  usuario_uuid: string;
  veiculo:      string | null;
  placa:        string | null;
  disponivel:   boolean;
  criado_em:    string;
}

export interface CreateEntregadorRequest {
  nome:     string;
  username: string;
  email:    string;
  senha:    string;
  celular:  string;
  veiculo?: string | null;
  placa?:   string | null;
}

export interface UpdateEntregadorRequest {
  veiculo?:  string | null;
  placa?:    string | null;
  disponivel?: boolean;
}

// ─── Cliente ──────────────────────────────────────────────────────────────────

export interface Cliente {
  uuid:         string;
  usuario_uuid: string;
  loja_uuid:    string;
  criado_em:    string;
}

export interface CreateClienteRequest {
  nome:     string;
  username: string;
  email:    string;
  senha:    string;
  celular:  string;
}

// ─── Produto ─────────────────────────────────────────────────────────────────

export interface Produto {
  uuid:             string;
  loja_uuid:        string;
  categoria_uuid:   string;
  nome:             string;
  descricao:        string | null;
  preco:            number;
  imagem_url:       string | null;
  disponivel:       boolean;
  tempo_preparo_min:number;
  destaque:         boolean;
  criado_em:        string;
  atualizado_em:    string;
}

export interface CreateProdutoRequest {
  uuid?:            string;
  categoria_uuid:   string;
  nome:             string;
  descricao?:       string | null;
  preco:            number;
  imagem_url?:      string | null;
  disponivel:       boolean;
  tempo_preparo_min:number;
  destaque:         boolean;
  criado_em?:       string;
  atualizado_em?:   string;
}

export interface UpdateProdutoRequest {
  nome:             string;
  descricao?:       string | null;
  preco:            number;
  categoria_uuid:   string;
  tempo_preparo_min:number;
}

// ─── Adicional ────────────────────────────────────────────────────────────────

export interface Adicional {
  uuid:      string;
  nome:      string;
  loja_uuid: string;
  disponivel:boolean;
  descricao: string;
  preco:     number;
  criado_em: string;
}

export interface CreateAdicionalRequest {
  nome:     string;
  descricao:string;
  preco:    number;
}

// ─── Categoria ────────────────────────────────────────────────────────────────

export interface CategoriaProdutos {
  uuid:       string;
  loja_uuid:  string | null;
  nome:       string;
  descricao:  string | null;
  ordem:      number;
  pizza_mode: boolean;
  drink_mode: boolean;
  criado_em:  string;
}

export interface CreateCategoriaRequest {
  nome:       string;
  descricao?: string | null;
  ordem:      number;
  pizza_mode: boolean;
  drink_mode: boolean;
}

export interface CreateCategoriaGlobalRequest {
  nome:       string;
  descricao?: string | null;
  pizza_mode: boolean;
  drink_mode: boolean;
}

export interface UpdateCategoriaGlobalRequest {
  nome:       string;
  descricao?: string | null;
  pizza_mode: boolean;
  drink_mode: boolean;
}

export interface CategoriaCobertura {
  uuid:        string;
  nome:        string;
  tem_produto: boolean;
}

export interface ProdutosPorLoja {
  uuid:     string;
  produtos: Produto[];
}

export interface CategoriaProdutosGlobalResponse {
  categoria_uuid: string;
  lojas:          ProdutosPorLoja[];
}

// ─── Pedido ──────────────────────────────────────────────────────────────────

export interface AdicionalDeItemDePedido {
  uuid:      string;
  item_uuid: string;
  loja_uuid: string;
  nome:      string;
  descricao: string;
  preco:     number;
}

export interface ParteDeItemPedido {
  uuid:          string;
  loja_uuid:     string;
  item_uuid:     string;
  produto_nome:  string;
  produto_uuid:  string;
  preco_unitario:number;
  posicao:       number;
  adicionais:    AdicionalDeItemDePedido[];
}

export interface ItemPedido {
  uuid:       string;
  loja_uuid:  string;
  pedido_uuid:string;
  quantidade: number;
  observacoes:string | null;
  adicionais: AdicionalDeItemDePedido[];
  partes:     ParteDeItemPedido[];
}

export interface KdsPayload {
  confirmados: Pedido[];
  em_preparo: Pedido[];
  prontos: Pedido[];
}

export interface Pedido {
  uuid:              string;
  codigo:            string;
  usuario_uuid:      string;
  loja_uuid:         string;
  status:            StatusPedido;
  pago:              boolean;
  total:             number;
  subtotal:          number;
  taxa_entrega:      number;
  desconto:          number;
  forma_pagamento:   string;
  observacoes:       string | null;
  contato:           string | null;
  tempo_estimado_min:number | null;
  criado_em:         string;
  atualizado_em:     string;
  itens:             ItemPedido[];
  partes:            ParteDeItemPedido[];
  endereco_entrega:  EnderecoEntrega | null;
}

export interface CreatePedidoItemRequest {
  quantidade:  number;
  observacoes?:string | null;
  partes: {
    produto_uuid: string;
    posicao:      number;
    adicionais?:  { adicional_uuid: string }[];
  }[];
}

export interface CreatePedidoRequest {
  loja_uuid?:      string;
  taxa_entrega:    number;
  forma_pagamento: string;
  observacoes?:    string | null;
  contato?:        string | null;
  codigo_cupom?:   string | null;
  itens:           CreatePedidoItemRequest[];
  endereco_entrega:{
    cep?:         string | null;
    logradouro:   string;
    numero:       string;
    complemento?: string | null;
    bairro:       string;
    cidade:       string;
    estado:       string;
  };
}

export interface CreatePedidoResponse {
  uuid:   string;
  codigo: string;
}

export interface StatusPedidoResponse {
  uuid:                  string;
  status:                StatusPedido;
  transicoes_permitidas: StatusPedido[];
}

export interface PedidoComEntrega {
  pedido:           Pedido;
  endereco_entrega: EnderecoEntrega | null;
}

export interface UpdateStatusPedidoRequest {
  novo_status: StatusPedido;
}

// ─── Endereço de Entrega ──────────────────────────────────────────────────────

export interface EnderecoEntrega {
  uuid:         string;
  loja_uuid:    string;
  pedido_uuid:  string;
  cep:          string | null;
  logradouro:   string;
  numero:       string;
  complemento:  string | null;
  bairro:       string;
  cidade:       string;
  estado:       string;
  latitude:     number | null;
  longitude:    number | null;
}

export interface EnderecoEntregaInput {
  cep?:         string | null;
  logradouro:   string;
  numero:       string;
  complemento?: string | null;
  bairro:       string;
  cidade:       string;
  estado:       string;
}

// ─── Endereço de Usuário ──────────────────────────────────────────────────────

export interface EnderecoUsuario {
  uuid:         string;
  usuario_uuid: string;
  cep:          string | null;
  logradouro:   string;
  numero:       string;
  complemento:  string | null;
  bairro:       string;
  cidade:       string;
  estado:       string;
  latitude:     number | null;
  longitude:    number | null;
}

export interface EnderecoUsuarioRequest {
  cep?:         string | null;
  logradouro:   string;
  numero:       string;
  complemento?: string | null;
  bairro:       string;
  cidade:       string;
  estado:       string;
}

// ─── Endereço de Loja ──────────────────────────────────────────────────────

export interface EnderecoLoja {
  uuid:        string;
  loja_uuid:   string;
  cep:         string | null;
  logradouro:  string;
  numero:      string;
  complemento: string | null;
  bairro:      string;
  cidade:      string;
  estado:      string;
  latitude:    number | null;
  longitude:   number | null;
}

export interface CreateEnderecoLojaRequest {
  cep?:         string | null;
  logradouro:   string;
  numero:       string;
  complemento?: string | null;
  bairro:       string;
  cidade:       string;
  estado:       string;
  latitude?:    number | null;
  longitude?:   number | null;
}

export interface UpdateEnderecoLojaRequest {
  cep?:         string | null;
  logradouro?:  string | null;
  numero?:      string | null;
  complemento?: string | null;
  bairro?:      string | null;
  cidade?:      string | null;
  estado?:      string | null;
  latitude?:    number | null;
  longitude?:   number | null;
}

// ─── Horário de Funcionamento ──────────────────────────────────────────────

export interface EnderecoFormValue {
  cep:         string;
  logradouro:  string;
  numero:      string;
  complemento: string;
  bairro:      string;
  cidade:      string;
  estado:      string;
}

export interface HorarioFuncionamento {
  uuid:       string;
  loja_uuid:  string;
  dia_semana: number;
  abertura:   string;
  fechamento: string;
  ativo:      boolean;
  criado_em:  string;
}

export interface StatusLojaAberta {
  aberta:     boolean;
  hora_atual: string;
  dia_semana: number;
  abertura:   string | null;
  fechamento: string | null;
}

export interface CreateHorarioFuncionamentoRequest {
  dia_semana:  number;
  abertura:    string;
  fechamento:  string;
  ativo:       boolean;
}

export interface UpdateHorarioFuncionamentoRequest {
  abertura?:   string;
  fechamento?: string;
}

// ─── Cupom ────────────────────────────────────────────────────────────────────

export interface Cupom {
  uuid:           string;
  loja_uuid:      string;
  codigo:         string;
  descricao:      string;
  tipo_desconto:  TipoDesconto;
  valor_desconto: number;
  valor_minimo:   number;
  data_validade:  string;
  limite_uso:     number;
  uso_atual:      number;
  status:         StatusCupom;
  criado_em:      string;
}

export interface CreateCupomRequest {
  codigo:         string;
  descricao:      string;
  tipo_desconto:  TipoDesconto;
  valor_desconto: number;
  valor_minimo:   number;
  data_validade:  string;
  limite_uso:     number;
}

export interface UpdateCupomRequest {
  loja_uuid?:       string;
  codigo?:          string;
  descricao?:       string;
  tipo_desconto?:   TipoDesconto;
  valor_desconto?:  number;
  valor_minimo?:    number;
  data_validade?:   string;
  limite_uso?:      number;
  status?:          StatusCupom;
}

// ─── Avaliação ────────────────────────────────────────────────────────────────

export interface AvaliacaoDeLoja {
  uuid:            string;
  loja_uuid:       string;
  usuario_uuid:    string;
  usuario_nome?:   string;
  usuario_email?:  string;
  nota:            number | string;
  comentario:      string | null;
  criado_em:       string;
}

export interface AvaliarLojaRequest {
  nota:       number;
  comentario?:string | null;
}

export interface AvaliacaoDeProduto {
  uuid:         string;
  usuario_uuid: string;
  loja_uuid:    string;
  produto_uuid: string;
  nota:         number;
  descricao:    string;
  comentario:   string | null;
  criado_em:    string;
}

export interface AvaliarProdutoRequest {
  produto_uuid:string;
  nota:        number;
  descricao:   string;
  comentario?: string | null;
}

// ─── Promoção ─────────────────────────────────────────────────────────────────

export interface Promocao {
  uuid:               string;
  loja_uuid:          string;
  nome:               string;
  descricao:          string;
  tipo_desconto:      TipoDesconto;
  valor_desconto:     number;
  valor_minimo:       number | null;
  data_inicio:        string;
  data_fim:           string;
  dias_semana_validos:number[];
  tipo_escopo:        TipoEscopo;
  produto_uuid:       string | null;
  categoria_uuid:     string | null;
  status:             string;
  prioridade:         number;
  criado_em:          string;
}

export interface CreatePromocaoRequest {
  nome:               string;
  descricao:          string;
  tipo_desconto:      TipoDesconto;
  valor_desconto:     number;
  valor_minimo?:      number | null;
  data_inicio:        string;
  data_fim:           string;
  dias_semana_validos:number[];
  tipo_escopo:        TipoEscopo;
  produto_uuid?:      string | null;
  categoria_uuid?:    string | null;
  prioridade:         number;
}

// ─── Favoritos ────────────────────────────────────────────────────────────────

export interface LojaFavorita {
  uuid:         string;
  usuario_uuid: string;
  loja_uuid:    string;
  criado_em:    string;
}

// ─── Pagamentos ──────────────────────────────────────────────────────────────

export interface PagamentoPagador {
  nome: string;
  cpf:  string;
}

export interface CreatePagamentoRequest {
  pagador?: PagamentoPagador;
}

export interface CreatePagamentoResponse {
  payment_id:    string;
  qr_code_image: string;
  pix_copia_cola:string;
  vencimento:    string;
}

// ─── Genéricos ───────────────────────────────────────────────────────────────

export interface ApiError        { error:    string; }
export interface MessageResponse { message:  string; }
export interface FavoritaResponse{ favorita: boolean; }

// ─── Chat ────────────────────────────────────────────────────────────────────

export interface MensagemChat {
  uuid:           string;
  pedido_uuid:    string | null;
  loja_uuid:      string;
  usuario_uuid:   string;
  remetente_uuid: string;
  texto:          string;
  lida:           boolean;
  criado_em:      string;
}

export interface CreateMensagemRequest {
  loja_uuid:      string;
  usuario_uuid:   string;
  texto:          string;
  pedido_uuid?:   string | null;
}
