// Front-end compartilhado entre as três variantes; mantém o protocolo da Aula 04.
const chat = document.getElementById('chat');
const form = document.getElementById('form');
const pergunta = document.getElementById('pergunta');
const enviar = document.getElementById('enviar');
const nova = document.getElementById('nova');
const listaConversas = document.getElementById('lista-conversas');
const sidebar = document.getElementById('sidebar');
const abrirSidebar = document.getElementById('abrir-sidebar');
const fecharSidebar = document.getElementById('fechar-sidebar');
const welcome = document.getElementById('welcome');
const statusTexto = document.getElementById('status-texto');

function obterJsonLocal(chave, padrao) {
  try { return JSON.parse(localStorage.getItem(chave) || JSON.stringify(padrao)); }
  catch { return padrao; }
}

function gerarId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const n = Math.floor(Math.random() * 16);
    return (c === 'x' ? n : (n & 3 | 8)).toString(16);
  });
}

let conversa = localStorage.getItem('conversa');
if (!conversa) {
  conversa = gerarId();
  localStorage.setItem('conversa', conversa);
}
let conversasSalvas = obterJsonLocal('conversas_salvas', []);
if (!Array.isArray(conversasSalvas)) conversasSalvas = [];
let carregamentoAtual = 0;
let enviando = false;

function atualizarVazio() {
  welcome.hidden = chat.querySelectorAll('.msg').length > 0;
  document.body.classList.toggle('has-messages', welcome.hidden);
}

function salvarConversaNaLista(id, titulo) {
  if (!conversasSalvas.some(c => c.id === id)) {
    conversasSalvas.unshift({ id, titulo });
    localStorage.setItem('conversas_salvas', JSON.stringify(conversasSalvas));
  }
  renderizarSidebar();
}

function renderizarSidebar() {
  listaConversas.textContent = '';
  const exibidas = [...conversasSalvas];
  if (!exibidas.some(c => c.id === conversa)) exibidas.unshift({ id: conversa, titulo: 'Nova conversa' });
  for (const item of exibidas) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'item-conversa' + (item.id === conversa ? ' ativa' : '');
    btn.textContent = item.titulo || 'Conversa';
    btn.title = item.titulo || 'Conversa';
    btn.addEventListener('click', () => {
      if (item.id === conversa) { fecharMenu(); return; }
      conversa = item.id;
      localStorage.setItem('conversa', conversa);
      renderizarSidebar();
      fecharMenu();
      carregarHistorico();
    });
    listaConversas.appendChild(btn);
  }
}

function mostrar(classe, texto) {
  const div = document.createElement('div');
  div.className = classe;
  div.textContent = texto;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
  atualizarVazio();
  return div;
}

function fecharMenu() {
  sidebar.classList.remove('aberta');
  abrirSidebar.setAttribute('aria-expanded', 'false');
}

async function carregarHistorico() {
  const idAtual = conversa;
  const requisicao = ++carregamentoAtual;
  chat.textContent = '';
  atualizarVazio();
  statusTexto.textContent = 'Carregando histórico…';
  try {
    const resposta = await fetch('/historico/' + encodeURIComponent(idAtual));
    const mensagens = await resposta.json();
    if (!resposta.ok) throw new Error(mensagens.erro || 'Falha ao buscar histórico');
    if (requisicao !== carregamentoAtual || conversa !== idAtual) return;
    for (const m of mensagens) mostrar('msg ' + m.role, m.content);
    const primeira = mensagens.find(m => m.role === 'user');
    if (primeira) salvarConversaNaLista(idAtual, primeira.content.slice(0, 32));
    statusTexto.textContent = 'Seu espaço de conversa';
  } catch (erro) {
    if (requisicao !== carregamentoAtual || conversa !== idAtual) return;
    statusTexto.textContent = 'Sem conexão com o servidor';
    mostrar('msg assistant', 'Não foi possível carregar o histórico. Confirme que o servidor e o MySQL estão ativos.');
  }
}

nova.addEventListener('click', () => {
  conversa = gerarId();
  localStorage.setItem('conversa', conversa);
  carregamentoAtual++;
  chat.textContent = '';
  atualizarVazio();
  statusTexto.textContent = 'Seu espaço de conversa';
  renderizarSidebar();
  fecharMenu();
  pergunta.focus();
});

abrirSidebar.addEventListener('click', () => {
  const aberta = sidebar.classList.toggle('aberta');
  abrirSidebar.setAttribute('aria-expanded', String(aberta));
});
fecharSidebar.addEventListener('click', fecharMenu);

for (const botao of document.querySelectorAll('[data-sugestao]')) {
  botao.addEventListener('click', () => {
    pergunta.value = botao.dataset.sugestao;
    pergunta.focus();
  });
}

form.addEventListener('submit', async evento => {
  evento.preventDefault();
  const texto = pergunta.value.trim();
  if (!texto || enviando) return;
  enviando = true;
  enviar.disabled = true;
  const idEnviado = conversa;
  salvarConversaNaLista(idEnviado, texto.slice(0, 32));
  mostrar('msg user', texto);
  pergunta.value = '';
  const balao = mostrar('msg assistant pensando', 'Preparando uma resposta…');
  statusTexto.textContent = 'Gerando resposta…';
  try {
    const resposta = await fetch('/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversa: idEnviado, texto })
    });
    const dados = await resposta.json();
    if (!resposta.ok) throw new Error(dados.erro || 'Falha no servidor');
    if (conversa === idEnviado) {
      balao.textContent = dados.resposta || 'Sem resposta recebida.';
      balao.classList.remove('pensando');
      if (dados.ferramentas && dados.ferramentas.length)
        mostrar('ferramentas', 'Consulta ao banco: ' + dados.ferramentas.join(', '));
    }
  } catch (erro) {
    if (conversa === idEnviado) {
      balao.textContent = 'Não foi possível enviar: ' + erro.message;
      balao.classList.remove('pensando');
    }
  } finally {
    enviando = false;
    enviar.disabled = false;
    statusTexto.textContent = 'Seu espaço de conversa';
    pergunta.focus();
  }
});

renderizarSidebar();
carregarHistorico();
