// Exportação do pedido pronto: planilha .xlsx (pra reenviar ao fornecedor) e
// texto formatado pra copiar ou abrir direto no WhatsApp.

function gerarTextoPedido(){
  const itens = itensComQuantidade();
  const total = calcularTotalPedido();

  let texto = `*Pedido*\n${new Date().toLocaleDateString('pt-BR')}\n\n`;
  itens.forEach(p => {
    texto += `${p.qtd}x ${p.nome}${p.codigo ? ' (' + p.codigo + ')' : ''} — ${formatarMoeda(p.preco)} = ${formatarMoeda(p.qtd * p.preco)}\n`;
  });
  texto += `\n*Total: ${formatarMoeda(total)}*`;
  return texto;
}

function exportarPedidoXlsx(){
  const itens = itensComQuantidade();
  const total = calcularTotalPedido();

  const linhas = [['Código', 'Produto', 'Preço', 'Quantidade', 'Subtotal']];
  itens.forEach(p => linhas.push([p.codigo, p.nome, p.preco, p.qtd, p.qtd * p.preco]));
  linhas.push(['', '', '', 'Total', total]);

  const ws = XLSX.utils.aoa_to_sheet(linhas);
  ws['!cols'] = [{ wch: 16 }, { wch: 42 }, { wch: 12 }, { wch: 12 }, { wch: 14 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Pedido');

  const dataArquivo = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `pedido-${dataArquivo}.xlsx`);
}

function copiarTextoPedido(){
  const texto = gerarTextoPedido();
  const status = document.getElementById('resumoStatusCopia');
  navigator.clipboard.writeText(texto)
    .then(() => { if(status){ status.textContent = 'Texto copiado!'; } })
    .catch(() => { if(status){ status.textContent = 'Não foi possível copiar automaticamente — selecione e copie manualmente.'; } });
}

function abrirWhatsappPedido(){
  const texto = gerarTextoPedido();
  window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank');
}
