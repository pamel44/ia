// Aula 03: o navegador mantém a conversa da sessão e chama o agente /chat.
const mensagens = [];
const chat = document.getElementById('chat');
const form = document.getElementById('form');
const pergunta = document.getElementById('pergunta');
const enviar = document.getElementById('enviar');
const welcome = document.getElementById('welcome');
function mostrar(classe, texto) {
  welcome.hidden = true;
  const div = document.createElement('div');
  div.className = classe;
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
  mostrar('msg user',texto);
  pergunta.value='';
  enviar.disabled=true;
  const balao=mostrar('msg assistant pensando','Consultando...');
  try {
    const resposta=await fetch('/chat',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({mensagens})
    });
    const dados=await resposta.json();
    if (!resposta.ok) throw new Error(dados.erro || 'HTTP '+resposta.status);
    mensagens.push({role:'assistant',content:dados.resposta});
    balao.textContent=dados.resposta;
    if(Array.isArray(dados.ferramentas) && dados.ferramentas.length)
      mostrar('ferramentas','Consultou: '+dados.ferramentas.join(', '));
  } catch(erro) {
    mensagens.pop();
    balao.textContent='Erro: '+erro.message;
  } finally {
    balao.classList.remove('pensando');
    enviar.disabled=false;
    pergunta.focus();
  }
});
