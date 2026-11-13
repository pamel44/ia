// Aula 02 — API REST de loja de informática, com Express e MySQL.
// Credenciais locais solicitadas: root / escola (não use root em produção).
const express = require('express');
const mysql = require('mysql2/promise');
const path = require('node:path');
const app = express();
const PORTA = 3002;
const banco = mysql.createPool({host:'localhost',user:'root',password:'escola',database:'loja_ia'});

app.use(express.static(path.join(__dirname,'public')));
app.get('/api', (req,res) => res.json({
  mensagem:'API da loja no ar',
  rotas:['/produtos','/produtos/1','/produtos?categoria=Áudio','/clientes','/pedidos']
}));
app.get('/produtos', async (req,res,next) => {
  try {
    const categoria = req.query.categoria;
    const [linhas] = categoria
      ? await banco.query('SELECT * FROM produtos WHERE categoria = ?', [categoria])
      : await banco.query('SELECT * FROM produtos');
    res.json(linhas);
  } catch(erro) { next(erro); }
});
app.get('/produtos/:id', async (req,res,next) => {
  try {
    const [linhas] = await banco.query('SELECT * FROM produtos WHERE id = ?', [req.params.id]);
    if (!linhas.length) return res.status(404).json({erro:'Produto não encontrado'});
    res.json(linhas[0]);
  } catch(erro) { next(erro); }
});
app.get('/clientes', async (req,res,next) => {
  try { const [linhas] = await banco.query('SELECT * FROM clientes'); res.json(linhas); }
  catch(erro) { next(erro); }
});
app.get('/pedidos', async (req,res,next) => {
  try {
    const [linhas] = await banco.query(`
      SELECT pedidos.id, clientes.nome AS cliente, produtos.nome AS produto,
             pedidos.quantidade, produtos.preco * pedidos.quantidade AS total,
             DATE_FORMAT(pedidos.data_pedido,'%Y-%m-%d') AS data_pedido, pedidos.status
      FROM pedidos
      JOIN clientes ON clientes.id = pedidos.cliente_id
      JOIN produtos ON produtos.id = pedidos.produto_id
      ORDER BY pedidos.id`);
    res.json(linhas);
  } catch(erro) { next(erro); }
});
app.use((erro,req,res,next) => {
  console.error('Erro de banco:',erro.message);
  res.status(500).json({erro:'Falha ao acessar o MySQL. Confira as credenciais, a tabela e o servidor.'});
});
app.listen(PORTA,()=>console.log('Aula 02: http://localhost:'+PORTA));
