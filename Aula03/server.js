// Aula 03 — Agente Ollama com function calling e acesso ao MySQL.
// Credenciais locais solicitadas: root / escola (não use root em produção).
const express = require('express');
const mysql = require('mysql2/promise');
const path = require('node:path');
const app = express();
const PORTA = 3002;
const URL_OLLAMA = 'http://localhost:11434/api/chat';
const MODELO = 'qwen2.5:3b';
const banco = mysql.createPool({host:'localhost',user:'root',password:'escola',database:'loja_ia'});
app.use(express.json({limit:'1mb'}));
app.use(express.static(path.join(__dirname,'public')));

const PROMPT_SISTEMA = `Você é o atendente virtual de uma loja de informática.
Responda sempre em português, de forma curta.
Para qualquer pergunta sobre produtos, clientes ou pedidos, use sempre uma ferramenta antes de responder.
Nunca invente dados da loja: responda com o que as ferramentas devolverem.
Liste os itens relevantes e informe quando o resultado estiver vazio.
Se a pergunta não for sobre a loja, diga que só pode ajudar com assuntos da loja.`;

const funcoes = {
  listar_produtos: async (args={}) => {
    let sql='SELECT * FROM produtos WHERE 1 = 1';
    const valores=[];
    if(args.categoria){sql+=' AND categoria = ?';valores.push(args.categoria);}
    if(args.sem_estoque === true) sql+=' AND estoque = 0';
    const [linhas]=await banco.query(sql,valores);
    return linhas;
  },
  listar_clientes: async (args={}) => {
    const [linhas] = args.cidade
      ? await banco.query('SELECT * FROM clientes WHERE cidade = ?',[args.cidade])
      : await banco.query('SELECT * FROM clientes');
    return linhas;
  },
  listar_pedidos: async (args={}) => {
    const filtro=args.status || null;
    const [linhas]=await banco.query(`
      SELECT pedidos.id, clientes.nome AS cliente, produtos.nome AS produto,
             pedidos.quantidade, produtos.preco * pedidos.quantidade AS total,
             DATE_FORMAT(pedidos.data_pedido,'%Y-%m-%d') AS data_pedido, pedidos.status
      FROM pedidos JOIN clientes ON clientes.id=pedidos.cliente_id
      JOIN produtos ON produtos.id=pedidos.produto_id
      WHERE ? IS NULL OR pedidos.status = ? ORDER BY pedidos.id`,[filtro,filtro]);
    return linhas;
  }
};

const ferramentas = [
  {type:'function',function:{name:'listar_produtos',description:'Lista os produtos da loja com nome, categoria, preço e estoque.',parameters:{type:'object',properties:{
    categoria:{type:'string',description:'Categoria: Periféricos, Áudio, Monitores, Armazenamento, Computadores ou Móveis'},
    sem_estoque:{type:'boolean',description:'True para filtrar somente produtos com estoque zero.'}
  }}}},
  {type:'function',function:{name:'listar_clientes',description:'Lista clientes da loja, opcionalmente por cidade.',parameters:{type:'object',properties:{cidade:{type:'string'}}}}},
  {type:'function',function:{name:'listar_pedidos',description:'Lista pedidos da loja, opcionalmente por status.',parameters:{type:'object',properties:{status:{type:'string',enum:['pendente','enviado','entregue','cancelado']}}}}}
];

async function rodarAgente(mensagens) {
  const usadas=[];
  for(let volta=0; volta<5; volta++) {
    const resposta=await fetch(URL_OLLAMA,{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({model:MODELO,messages:mensagens,tools:ferramentas,stream:false,options:{temperature:0}})
    });
    if(!resposta.ok) throw new Error('Ollama respondeu HTTP '+resposta.status);
    const msg=(await resposta.json()).message;
    mensagens.push(msg);
    if(!msg.tool_calls || msg.tool_calls.length===0) return {resposta:msg.content || '',ferramentas:usadas};
    for(const chamada of msg.tool_calls) {
      const nome=chamada.function.name;
      const fn=funcoes[nome];
      const resultado=fn ? await fn(chamada.function.arguments || {}) : {erro:'Ferramenta inexistente: '+nome};
      usadas.push(nome);
      mensagens.push({role:'tool',tool_name:nome,content:JSON.stringify(resultado)});
    }
  }
  return {resposta:'Não consegui chegar a uma resposta.',ferramentas:usadas};
}
app.post('/chat', async (req,res,next) => {
  try {
    const recebidas=Array.isArray(req.body?.mensagens) ? req.body.mensagens : [];
    const conversa=recebidas.filter(m=>['user','assistant'].includes(m.role) && typeof m.content === 'string' && m.content.length<=2000)
      .slice(-20).map(m=>({role:m.role,content:m.content}));
    if(!conversa.length) return res.status(400).json({erro:'Envie pelo menos uma mensagem.'});
    res.json(await rodarAgente([{role:'system',content:PROMPT_SISTEMA},...conversa]));
  } catch(erro){next(erro);}
});
app.use((erro,req,res,next) => {
  console.error(erro.message);
  res.status(500).json({erro:'Falha no servidor: '+erro.message});
});
app.listen(PORTA,()=>console.log('Aula 03: http://localhost:'+PORTA));
