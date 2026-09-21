// Helpers de formatação usados pelo app.

function formatarMoeda(valor){
  return (Number(valor) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function escapeHtml(texto){
  const div = document.createElement('div');
  div.textContent = texto ?? '';
  return div.innerHTML;
}

// Maiúsculo, sem acento, sem espaço nas pontas — pra comparar texto de
// cabeçalho de planilha sem se importar com acentuação/caixa.
function normalizarTexto(texto){
  return (texto ?? '').toString()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase().trim();
}
