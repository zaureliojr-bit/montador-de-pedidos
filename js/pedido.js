// Estado do pedido em andamento: lista de produtos importados (com a
// quantidade que a pessoa for preenchendo), busca/filtro, totais, e um
// salvamento automático em localStorage pra não perder o trabalho se a
// página recarregar sem querer.

const ESTADO_STORAGE = 'pedidos_estado_v1';

let produtosPedido = [];

function salvarEstadoPedido(){
  try{
    localStorage.setItem(ESTADO_STORAGE, JSON.stringify({
      produtosPedido,
      salvoEm: new Date().toISOString()
    }));
  } catch(err){
    console.warn('Não foi possível salvar o progresso localmente:', err);
  }
}

function lerEstadoSalvo(){
  try{
    const bruto = localStorage.getItem(ESTADO_STORAGE);
    if(!bruto) return null;
    const dado = JSON.parse(bruto);
    if(!dado || !Array.isArray(dado.produtosPedido) || !dado.produtosPedido.length) return null;
    return dado;
  } catch(err){
    return null;
  }
}

function limparEstadoSalvo(){
  localStorage.removeItem(ESTADO_STORAGE);
}

function itensComQuantidade(){
  return produtosPedido.filter(p => p.qtd > 0);
}

function calcularTotalPedido(){
  return itensComQuantidade().reduce((soma, p) => soma + p.qtd * p.preco, 0);
}

function buscarProdutosPedido(termo){
  const t = normalizarTexto(termo);
  if(!t) return produtosPedido;
  return produtosPedido.filter(p =>
    normalizarTexto(p.nome).includes(t) || normalizarTexto(p.codigo).includes(t)
  );
}

function itemProdutoPedidoHtml(produto, idx){
  const temQtd = produto.qtd > 0;
  return `
    <div class="item-produto ${temQtd ? 'tem-qtd' : ''}" data-idx="${idx}">
      <div class="info">
        <div class="nome">${escapeHtml(produto.nome)}</div>
        <div class="meta">${produto.codigo ? escapeHtml(produto.codigo) + ' · ' : ''}${formatarMoeda(produto.preco)}${temQtd ? ' · Subtotal: ' + formatarMoeda(produto.qtd * produto.preco) : ''}</div>
      </div>
      <div class="qtd-control">
        <button type="button" class="btnMenosQtdPedido" aria-label="Diminuir">−</button>
        <input type="number" class="qtdInputPedido" min="0" step="1" value="${produto.qtd || ''}" placeholder="0" />
        <button type="button" class="btnMaisQtdPedido" aria-label="Aumentar">+</button>
      </div>
    </div>`;
}

let indicesVisiveis = [];

function renderListaPedido(){
  const termo = document.getElementById('produtoBuscaPedido').value;
  const filtrados = buscarProdutosPedido(termo);
  indicesVisiveis = filtrados.map(p => produtosPedido.indexOf(p));

  const container = document.getElementById('listaProdutosPedido');
  const vazio = document.getElementById('listaProdutosVazia');

  if(!filtrados.length){
    container.innerHTML = '';
    vazio.style.display = 'block';
  } else {
    vazio.style.display = 'none';
    container.innerHTML = filtrados.map((p, i) => itemProdutoPedidoHtml(p, indicesVisiveis[i])).join('');
  }

  document.getElementById('totalProdutosInfo').textContent =
    `${produtosPedido.length} produto(s) na planilha${termo ? ` · ${filtrados.length} encontrado(s)` : ''}`;

  renderResumoFixo();
}

function renderResumoFixo(){
  const itens = itensComQuantidade();
  const total = calcularTotalPedido();
  document.getElementById('resumoItens').textContent = `${itens.length} ite${itens.length === 1 ? 'm' : 'ns'}`;
  document.getElementById('resumoTotal').textContent = formatarMoeda(total);
  document.getElementById('resumoFixo').style.display = itens.length ? 'flex' : 'none';
}

function alterarQuantidade(idx, novaQtd){
  const produto = produtosPedido[idx];
  if(!produto) return;
  produto.qtd = Math.max(0, Math.floor(Number(novaQtd) || 0));
  salvarEstadoPedido();
}

function ligarEventosPedido(){
  document.getElementById('produtoBuscaPedido').addEventListener('input', renderListaPedido);

  document.getElementById('listaProdutosPedido').addEventListener('click', e => {
    const linha = e.target.closest('.item-produto');
    if(!linha) return;
    const idx = Number(linha.dataset.idx);

    if(e.target.closest('.btnMaisQtdPedido')){
      alterarQuantidade(idx, produtosPedido[idx].qtd + 1);
      renderListaPedido();
    } else if(e.target.closest('.btnMenosQtdPedido')){
      alterarQuantidade(idx, produtosPedido[idx].qtd - 1);
      renderListaPedido();
    }
  });

  document.getElementById('listaProdutosPedido').addEventListener('input', e => {
    const input = e.target.closest('.qtdInputPedido');
    if(!input) return;
    const linha = input.closest('.item-produto');
    const idx = Number(linha.dataset.idx);
    alterarQuantidade(idx, input.value);
    linha.classList.toggle('tem-qtd', produtosPedido[idx].qtd > 0);
    const meta = linha.querySelector('.meta');
    const produto = produtosPedido[idx];
    meta.textContent = `${produto.codigo ? produto.codigo + ' · ' : ''}${formatarMoeda(produto.preco)}${produto.qtd > 0 ? ' · Subtotal: ' + formatarMoeda(produto.qtd * produto.preco) : ''}`;
    renderResumoFixo();
  });
}
