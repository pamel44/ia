// Aula 01: histórico guardado apenas enquanto a página está aberta.
const MODELO = 'qwen2.5:3b';
const mensagens = [{role:'system',content:'Responda em português de forma objetiva e clara.'}];
const chat = document.getElementById('chat');
const form = document.getElementById('form');
const pergunta = document.getElementById('pergunta');
const enviar = document.getElementById('enviar');
const welcome = document.getElementById('welcome');

function mostrar(role, texto) {
  welcome.hidden = true;
  const div = document.createElement('div');
  div.className = 'msg ' + role;
  div.textContent = texto;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
  return div;
}

document.querySelectorAll('[data-sugestao]').forEach(btn => btn.addEventListener('click', () => {
  pergunta.value = btn.dataset.sugestao;
  pergunta.focus();
}));

form.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const texto = pergunta.value.trim();
  if (!texto) return;
  mensagens.push({role:'user',content:texto});
  mostrar('user', texto);
  pergunta.value = '';
  enviar.disabled = true;
  const balao = mostrar('assistant pensando','Pensando...');
  try {
    const resposta = await fetch('/api/chat', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({model:MODELO,messages:mensagens,stream:false})
    });
    const dados = await resposta.json();
    if (!resposta.ok || !dados.message) throw new Error(dados.erro || 'HTTP '+resposta.status);
    mensagens.push({role:'assistant',content:dados.message.content});
    balao.textContent = dados.message.content;
  } catch(erro) {
    mensagens.pop();
    balao.textContent = 'Erro ao consultar o Ollama: ' + erro.message;
  } finally {
    balao.classList.remove('pensando');
    enviar.disabled = false;
    pergunta.focus();
  }
});
