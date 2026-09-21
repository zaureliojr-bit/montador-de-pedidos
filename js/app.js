// Orquestração: liga as 3 etapas (importar → confirmar colunas → montar
// pedido) e o modal de resumo/exportação.

let planilhaLinhas = null;
let linhaCabecalhoAtual = -1;

function mudarEtapa(nome){
  ['etapaImportar', 'etapaMapeamento', 'etapaPedido'].forEach(id => {
    document.getElementById(id).style.display = id === nome ? 'block' : 'none';
  });
  if(nome !== 'etapaPedido'){
    document.getElementById('resumoFixo').style.display = 'none';
  }
}

function popularSelectColuna(select, headers, valorAtual){
  select.innerHTML = '<option value="-1">Nenhuma</option>' +
    headers.map((h, i) => `<option value="${i}">${escapeHtml(rotuloColuna(headers, i))}</option>`).join('');
  select.value = String(valorAtual);
}

function renderPreviaLinhas(linhas, linhaCabecalho){
  const linhasPrevia = linhas.slice(linhaCabecalho, linhaCabecalho + 6);
  const html = `<table>${linhasPrevia.map((l, i) =>
    `<tr>${(l || []).map(c => `<${i === 0 ? 'th' : 'td'}>${escapeHtml((c ?? '').toString())}</${i === 0 ? 'th' : 'td'}>`).join('')}</tr>`
  ).join('')}</table>`;
  document.getElementById('previaLinhas').innerHTML = html;
}

async function processarArquivo(arquivo){
  const status = document.getElementById('importarStatus');
  status.classList.remove('erro');
  status.textContent = 'Lendo arquivo...';

  if(typeof XLSX === 'undefined'){
    status.classList.add('erro');
    status.textContent = 'Não foi possível carregar o leitor de planilhas. Verifique sua internet e recarregue a página.';
    return;
  }

  try{
    const linhas = await lerArquivoPlanilha(arquivo);
    if(!linhas.length) throw new Error('Planilha vazia.');

    planilhaLinhas = linhas;
    linhaCabecalhoAtual = detectarLinhaCabecalho(linhas);
    const headers = linhas[linhaCabecalhoAtual].map(h => (h ?? '').toString());

    const indiceNomeSugerido = sugerirColuna(headers, 'nome');
    let indiceCodigoSugerido = sugerirColuna(headers, 'codigo');
    if(indiceCodigoSugerido < 0){
      indiceCodigoSugerido = sugerirColunaCodigoPorConteudo(linhas, linhaCabecalhoAtual, indiceNomeSugerido);
    }

    popularSelectColuna(document.getElementById('mapCodigo'), headers, indiceCodigoSugerido);
    popularSelectColuna(document.getElementById('mapNome'), headers, indiceNomeSugerido);
    popularSelectColuna(document.getElementById('mapPreco'), headers, sugerirColuna(headers, 'preco'));
    popularSelectColuna(document.getElementById('mapPrecoTabela'), headers, sugerirColuna(headers, 'precoTabela'));
    popularSelectColuna(document.getElementById('mapDesconto'), headers, sugerirColuna(headers, 'desconto'));

    document.getElementById('infoDeteccao').textContent =
      `Cabeçalho identificado na linha ${linhaCabecalhoAtual + 1} de "${arquivo.name}". Confira se as colunas abaixo bateram certo.`;

    renderPreviaLinhas(linhas, linhaCabecalhoAtual);

    status.textContent = '';
    document.getElementById('mapeamentoStatus').textContent = '';
    mudarEtapa('etapaMapeamento');
  } catch(err){
    status.classList.add('erro');
    status.textContent = 'Erro ao ler o arquivo: ' + err.message;
  }
}

function lerMapeamentoForm(){
  return {
    codigo: Number(document.getElementById('mapCodigo').value),
    nome: Number(document.getElementById('mapNome').value),
    preco: Number(document.getElementById('mapPreco').value),
    precoTabela: Number(document.getElementById('mapPrecoTabela').value),
    desconto: Number(document.getElementById('mapDesconto').value)
  };
}

function confirmarMapeamento(){
  const mapeamento = lerMapeamentoForm();
  const status = document.getElementById('mapeamentoStatus');
  status.classList.remove('erro');

  if(mapeamento.nome < 0){
    status.classList.add('erro');
    status.textContent = 'Selecione qual coluna tem o nome do produto.';
    return;
  }
  if(mapeamento.preco < 0 && (mapeamento.precoTabela < 0 || mapeamento.desconto < 0)){
    status.classList.add('erro');
    status.textContent = 'Selecione a coluna de preço final, ou preço de tabela + desconto pra calcular sozinho.';
    return;
  }
  if(mapeamento.codigo >= 0 && mapeamento.codigo === mapeamento.nome){
    status.classList.add('erro');
    status.textContent = 'A coluna de Código não pode ser a mesma do Produto. Selecione a coluna certa (ou deixe "Nenhuma" se a planilha não tiver código de barras).';
    return;
  }

  produtosPedido = construirProdutosDaPlanilha(planilhaLinhas, linhaCabecalhoAtual, mapeamento);
  if(!produtosPedido.length){
    status.classList.add('erro');
    status.textContent = 'Nenhum produto encontrado com esse mapeamento. Confira as colunas selecionadas.';
    return;
  }

  document.getElementById('produtoBuscaPedido').value = '';
  salvarEstadoPedido();
  mudarEtapa('etapaPedido');
  renderListaPedido();
}

function iniciarNovaImportacao(){
  if(produtosPedido.length && itensComQuantidade().length){
    if(!confirm('Isso vai descartar o pedido atual (com quantidades já preenchidas). Continuar?')) return;
  }
  produtosPedido = [];
  planilhaLinhas = null;
  limparEstadoSalvo();
  document.getElementById('inputArquivo').value = '';
  document.getElementById('pedidoAnteriorCard').style.display = 'none';
  mudarEtapa('etapaImportar');
}

function abrirResumo(){
  const itens = itensComQuantidade();
  const total = calcularTotalPedido();

  const lista = document.getElementById('resumoLista');
  lista.innerHTML = itens.length
    ? itens.map(p => `<div class="linha-resumo"><span>${p.qtd}x ${escapeHtml(p.nome)}</span><span>${formatarMoeda(p.qtd * p.preco)}</span></div>`).join('')
    : '<div class="empty">Nenhum item com quantidade ainda.</div>';

  document.getElementById('resumoTotalModal').textContent = formatarMoeda(total);
  document.getElementById('resumoStatusCopia').textContent = '';
  document.getElementById('resumoOverlay').style.display = 'flex';
}

function fecharResumo(){
  document.getElementById('resumoOverlay').style.display = 'none';
}

function ligarEventosApp(){
  document.getElementById('inputArquivo').addEventListener('change', e => {
    const arquivo = e.target.files[0];
    if(arquivo) processarArquivo(arquivo);
  });

  document.getElementById('btnVoltarImportar').addEventListener('click', () => mudarEtapa('etapaImportar'));
  document.getElementById('btnConfirmarMapeamento').addEventListener('click', confirmarMapeamento);
  document.getElementById('btnNovaImportacao').addEventListener('click', iniciarNovaImportacao);

  document.getElementById('btnAbrirResumo').addEventListener('click', abrirResumo);
  document.getElementById('btnFecharResumo').addEventListener('click', fecharResumo);
  document.getElementById('btnExportarXlsx').addEventListener('click', exportarPedidoXlsx);
  document.getElementById('btnAbrirWhatsapp').addEventListener('click', abrirWhatsappPedido);
  document.getElementById('btnCopiarTexto').addEventListener('click', copiarTextoPedido);

  document.getElementById('btnContinuarPedido').addEventListener('click', () => {
    const salvo = lerEstadoSalvo();
    if(!salvo) return;
    produtosPedido = salvo.produtosPedido;
    document.getElementById('pedidoAnteriorCard').style.display = 'none';
    mudarEtapa('etapaPedido');
    renderListaPedido();
  });

  document.getElementById('btnDescartarPedido').addEventListener('click', () => {
    limparEstadoSalvo();
    document.getElementById('pedidoAnteriorCard').style.display = 'none';
  });

  ligarEventosPedido();
}

function init(){
  ligarEventosApp();

  const salvo = lerEstadoSalvo();
  if(salvo){
    const qtdItens = salvo.produtosPedido.filter(p => p.qtd > 0).length;
    document.getElementById('pedidoAnteriorInfo').textContent =
      `${salvo.produtosPedido.length} produtos, ${qtdItens} com quantidade preenchida. Salvo em ${new Date(salvo.salvoEm).toLocaleString('pt-BR')}.`;
    document.getElementById('pedidoAnteriorCard').style.display = 'block';
  }

  mudarEtapa('etapaImportar');
}

init();
