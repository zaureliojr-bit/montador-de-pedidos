// Leitura da planilha do fornecedor: abre o arquivo, acha a linha de
// cabeçalho (nem sempre é a linha 1 — a planilha de exemplo tem um título
// mesclado na linha 1 e o cabeçalho de verdade só na linha 2) e sugere quais
// colunas são código/produto/preço comparando os títulos com uma lista de
// apelidos comuns entre fornecedores.

const ALIASES_COLUNA = {
  codigo: ['EAN', 'CODIGO', 'CODIGO DE BARRAS', 'COD BARRAS', 'COD', 'SKU', 'CODIGO BARRAS'],
  nome: ['APRESENTACAO', 'DESCRICAO', 'PRODUTO', 'ITEM', 'NOME', 'DESCRICAO DO PRODUTO'],
  preco: ['PRECO FINAL', 'PRECO', 'VALOR', 'PRECO UNITARIO', 'PRECO VENDA', 'PRECO LIQUIDO', 'VALOR UNITARIO'],
  precoTabela: ['PF', 'PRECO FABRICA', 'PRECO TABELA', 'PRECO BRUTO', 'PRECO DE TABELA'],
  desconto: ['DESCONTO', 'DESC', '% DESCONTO', 'PERCENTUAL DESCONTO']
};

function lerArquivoPlanilha(arquivo){
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = e => {
      try{
        const dados = new Uint8Array(e.target.result);
        const wb = XLSX.read(dados, { type: 'array' });
        const primeiraAba = wb.SheetNames[0];
        const linhas = XLSX.utils.sheet_to_json(wb.Sheets[primeiraAba], { header: 1, raw: true, defval: '' });
        resolve(linhas);
      } catch(err){
        reject(err);
      }
    };
    leitor.onerror = () => reject(new Error('Não foi possível ler o arquivo.'));
    leitor.readAsArrayBuffer(arquivo);
  });
}

// Procura, entre as primeiras linhas, a que mais bate com os apelidos de
// coluna conhecidos — essa é a linha de cabeçalho de verdade.
function detectarLinhaCabecalho(linhas){
  const todosAliases = Object.values(ALIASES_COLUNA).flat().map(normalizarTexto);
  let melhorLinha = 0;
  let melhorPontuacao = -1;
  const limite = Math.min(linhas.length, 15);

  for(let i = 0; i < limite; i++){
    const celulas = (linhas[i] || []).map(normalizarTexto);
    const pontuacao = celulas.filter(c => c && todosAliases.includes(c)).length;
    if(pontuacao > melhorPontuacao){
      melhorPontuacao = pontuacao;
      melhorLinha = i;
    }
  }
  return melhorLinha;
}

function sugerirColuna(headers, chave){
  const aliases = ALIASES_COLUNA[chave].map(normalizarTexto);
  return headers.findIndex(h => aliases.includes(normalizarTexto(h)));
}

// Quando nenhum título de coluna bate com os apelidos de "código" (planilha
// do fornecedor usa um nome fora do comum, ou nem tem título), tenta achar a
// coluna do código de barras pelo conteúdo: uma coluna (que não seja a do
// nome do produto) cujos valores preenchidos são só dígitos, no tamanho
// típico de EAN/SKU.
function sugerirColunaCodigoPorConteudo(linhas, linhaCabecalho, indiceNome){
  const amostra = linhas.slice(linhaCabecalho + 1, linhaCabecalho + 21).filter(l => l && l.length);
  if(!amostra.length) return -1;

  const numColunas = Math.max(...amostra.map(l => l.length));
  let melhorIdx = -1;
  let melhorPontuacao = 0;

  for(let col = 0; col < numColunas; col++){
    if(col === indiceNome) continue;
    let acertos = 0;
    let preenchidos = 0;
    amostra.forEach(l => {
      const valor = (l[col] ?? '').toString().trim();
      if(!valor) return;
      preenchidos++;
      if(/^\d{6,14}$/.test(valor)) acertos++;
    });
    if(preenchidos > 0 && acertos === preenchidos && acertos > melhorPontuacao){
      melhorPontuacao = acertos;
      melhorIdx = col;
    }
  }
  return melhorIdx;
}

function letraColuna(idx){
  let n = idx;
  let letra = '';
  do{
    letra = String.fromCharCode(65 + (n % 26)) + letra;
    n = Math.floor(n / 26) - 1;
  } while(n >= 0);
  return letra;
}

function rotuloColuna(headers, idx){
  if(idx < 0 || idx >= headers.length) return '';
  const titulo = (headers[idx] ?? '').toString().trim();
  return `${letraColuna(idx)}${titulo ? ' — ' + titulo : ''}`;
}

// Monta a lista final de produtos a partir das linhas cruas + mapeamento de
// colunas confirmado pelo usuário. Ignora linhas sem nome de produto (linha
// de rodapé com só o total, linhas em branco etc).
function construirProdutosDaPlanilha(linhas, linhaCabecalho, mapeamento){
  const produtos = [];

  for(let i = linhaCabecalho + 1; i < linhas.length; i++){
    const linha = linhas[i];
    if(!linha || !linha.length) continue;

    const nome = mapeamento.nome >= 0 ? (linha[mapeamento.nome] ?? '').toString().trim() : '';
    if(!nome) continue;

    let codigo = mapeamento.codigo >= 0 ? (linha[mapeamento.codigo] ?? '').toString().trim() : '';
    if(codigo && codigo === nome) codigo = ''; // coluna de código igual à de produto: não é um código de verdade

    let preco = mapeamento.preco >= 0 ? Number(linha[mapeamento.preco]) : NaN;
    if(!Number.isFinite(preco) || preco <= 0){
      const tabela = mapeamento.precoTabela >= 0 ? Number(linha[mapeamento.precoTabela]) : NaN;
      const desconto = mapeamento.desconto >= 0 ? Number(linha[mapeamento.desconto]) : 0;
      if(Number.isFinite(tabela)){
        preco = tabela - (tabela * (Number.isFinite(desconto) ? desconto : 0));
      }
    }
    if(!Number.isFinite(preco) || preco < 0) preco = 0;

    produtos.push({ codigo, nome, preco, qtd: 0 });
  }

  return produtos;
}
