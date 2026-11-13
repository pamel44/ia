// Aula 02: painel de testes das rotas GET da API REST.
const saida = document.getElementById('saida');
const status = document.getElementById('api-status');
const rota = document.getElementById('rota-atual');
const botoes = [...document.querySelectorAll('[data-rota]')];
const total = document.getElementById('total-registros');

async function consultar(url) {
  rota.textContent = 'GET ' + url;
  status.textContent = 'Consultando...';
  saida.textContent = 'Carregando dados do MySQL...';
  botoes.forEach(btn => { btn.disabled = true; btn.classList.toggle('selected',btn.dataset.rota === url); });
  try {
    const resposta = await fetch(url);
    const dados = await resposta.json();
    if (!resposta.ok) throw new Error(dados.erro || 'HTTP ' + resposta.status);
    saida.textContent = JSON.stringify(dados,null,2);
    total.textContent = Array.isArray(dados) ? dados.length + ' registros' : '1 registro';
    status.textContent = 'Resposta HTTP ' + resposta.status;
  } catch(erro) {
    saida.textContent = JSON.stringify({erro:erro.message},null,2);
    total.textContent = '—';
    status.textContent = 'Falha na consulta';
  } finally { botoes.forEach(btn=>btn.disabled=false); }
}
botoes.forEach(btn => btn.addEventListener('click',()=>consultar(btn.dataset.rota)));
consultar('/produtos');
