// Agente Ollama com memória persistente no MySQL.
// Credenciais locais solicitadas: root / escola | Banco: loja_ia
// Execute com Node.js 18+ e o Ollama + MySQL ativos.

const express = require('express');
const mysql = require('mysql2/promise');
const path = require('path');

const app = express();
const PORTA = 3003;
const URL_OLLAMA = 'http://localhost:11434/api/chat';
const MODELO = 'qwen2.5:3b';
const LIMITE_HISTORICO = 20;

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// IMPORTANTE: configuração para ambiente local de estudos.
// Em produção, use um usuário MySQL com permissões mínimas e variáveis de ambiente.
const banco = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: 'escola',
  database: 'loja_ia',
  waitForConnections: true,
  connectionLimit: 10
});

const PROMPT_SISTEMA = `Você é o atendente virtual de uma loja de informática.
Responda sempre em português, de forma curta e objetiva.
Para perguntas sobre produtos, clientes ou pedidos, use uma ferramenta antes de responder.
Nunca invente dados da loja: utilize apenas os resultados das ferramentas.
Liste os itens relevantes retornados pela ferramenta.
Se a ferramenta retornar uma lista vazia, explique que não encontrou registros.
Lembre o que o cliente já contou nesta conversa (nome, preferências) e utilize isso ao responder.`;

async function lerHistorico(conversa) {
  const [linhas] = await banco.query(
    `SELECT role, content FROM (
       SELECT id, role, content FROM mensagens
       WHERE conversa = ? ORDER BY id DESC LIMIT ?
     ) AS ultimas ORDER BY id`,
    [conversa, LIMITE_HISTORICO]
  );
  return linhas;
}

async function salvarMensagem(conversa, role, content) {
  await banco.query(
    'INSERT INTO mensagens (conversa, role, content) VALUES (?, ?, ?)',
    [conversa, role, content]
  );
}

const funcoes = {
  listar_produtos: async (args = {}) => {
    let sql = 'SELECT * FROM produtos WHERE 1 = 1';
    const valores = [];
    if (args.categoria) { sql += ' AND categoria = ?'; valores.push(args.categoria); }
    if (args.sem_estoque === true) sql += ' AND estoque = 0';
    const [linhas] = await banco.query(sql, valores);
    return linhas;
  },
  listar_clientes: async (args = {}) => {
    const [linhas] = args.cidade
      ? await banco.query('SELECT * FROM clientes WHERE cidade = ?', [args.cidade])
      : await banco.query('SELECT * FROM clientes');
    return linhas;
  },
  listar_pedidos: async (args = {}) => {
    const status = args.status || null;
    const [linhas] = await banco.query(`
      SELECT pedidos.id, clientes.nome AS cliente, produtos.nome AS produto,
             pedidos.quantidade, produtos.preco * pedidos.quantidade AS total,
             DATE_FORMAT(pedidos.data_pedido, '%Y-%m-%d') AS data_pedido,
             pedidos.status
        FROM pedidos
        JOIN clientes ON clientes.id = pedidos.cliente_id
        JOIN produtos ON produtos.id = pedidos.produto_id
       WHERE ? IS NULL OR pedidos.status = ?
       ORDER BY pedidos.id`, [status, status]);
    return linhas;
  }
};

const ferramentas = [
  { type: 'function', function: {
    name: 'listar_produtos', description: 'Lista produtos com nome, categoria, preço e estoque. Estoque 0 significa em falta.',
    parameters: { type: 'object', properties: {
      categoria: { type: 'string', description: 'Filtrar por categoria: Periféricos, Áudio, Monitores, Armazenamento, Computadores ou Móveis.' },
      sem_estoque: { type: 'boolean', description: 'Se true, exibe apenas produtos sem estoque.' }
    } }
  } },
  { type: 'function', function: {
    name: 'listar_clientes', description: 'Lista clientes da loja com nome, e-mail e cidade.',
    parameters: { type: 'object', properties: {
      cidade: { type: 'string', description: 'Filtrar clientes pela cidade.' }
    } }
  } },
  { type: 'function', function: {
    name: 'listar_pedidos', description: 'Lista pedidos com cliente, produto, quantidade, valor, data e status.',
    parameters: { type: 'object', properties: {
      status: { type: 'string', enum: ['pendente', 'enviado', 'entregue', 'cancelado'], description: 'Filtrar pelo status do pedido.' }
    } }
  } }
];

async function rodarAgente(mensagens) {
  const usadas = [];
  for (let volta = 0; volta < 5; volta++) {
    const resposta = await fetch(URL_OLLAMA, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODELO, messages: mensagens, tools: ferramentas,
        stream: false, options: { temperature: 0 }
      })
    });
    if (!resposta.ok) throw new Error('Ollama respondeu HTTP ' + resposta.status);
    const dados = await resposta.json();
    if (!dados.message) throw new Error('Ollama retornou uma resposta inesperada.');
    const mensagem = dados.message;
    mensagens.push(mensagem);
    if (!Array.isArray(mensagem.tool_calls) || mensagem.tool_calls.length === 0) {
      return { resposta: mensagem.content || '', ferramentas: usadas };
    }
    for (const chamada of mensagem.tool_calls) {
      const nome = chamada.function && chamada.function.name;
      const fn = funcoes[nome];
      const resultado = fn
        ? await fn(chamada.function.arguments || {})
        : { erro: 'Ferramenta não encontrada: ' + nome };
      usadas.push(nome || 'desconhecida');
      mensagens.push({ role: 'tool', tool_name: nome, content: JSON.stringify(resultado) });
    }
  }
  return { resposta: 'Não foi possível completar essa consulta. Tente reformular a pergunta.', ferramentas: usadas };
}

function entradaValida(conversa, texto) {
  return typeof conversa === 'string' && conversa.length > 0 && conversa.length <= 36 &&
    typeof texto === 'string' && texto.trim().length > 0 && texto.length <= 2000;
}

app.get('/historico/:conversa', async (req, res, next) => {
  try {
    if (req.params.conversa.length > 36) return res.status(400).json({ erro: 'ID inválido.' });
    res.json(await lerHistorico(req.params.conversa));
  } catch (erro) { next(erro); }
});

app.post('/chat', async (req, res, next) => {
  try {
    const { conversa, texto } = req.body || {};
    if (!entradaValida(conversa, texto)) return res.status(400).json({ erro: 'Envie conversa e texto válidos.' });
    const historico = await lerHistorico(conversa);
    // Mantém o formato de memória da Aula 04: o histórico textual acompanha o prompt.
    const textoHistorico = historico
      .map(m => (m.role === 'user' ? 'Cliente: ' : 'Atendente: ') + m.content)
      .join('\n');
    const mensagens = [
      { role: 'system', content: PROMPT_SISTEMA + (historico.length ? '\n\nConversa até agora:\n' + textoHistorico : '') },
      { role: 'user', content: texto }
    ];
    const resultado = await rodarAgente(mensagens);
    await salvarMensagem(conversa, 'user', texto);
    await salvarMensagem(conversa, 'assistant', resultado.resposta);
    res.json(resultado);
  } catch (erro) { next(erro); }
});

app.use((erro, req, res, next) => {
  console.error('[Servidor]', erro);
  res.status(500).json({ erro: 'Falha ao acessar o MySQL ou Ollama. Verifique se ambos estão ativos.' });
});

app.listen(PORTA, () => console.log('Lumi IA: http://localhost:' + PORTA));
