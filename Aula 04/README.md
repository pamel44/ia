# Lumi IA — interface personalizada para a Aula 04

Projeto baseado na estrutura da Aula 04 do repositório `kauan-oss/IA`.

## Requisitos
- Node.js 18+ e npm.
- Ollama instalado e em execução com modelo `qwen2.5:3b` (`ollama pull qwen2.5:3b`).
- MySQL em execução, banco `loja_ia` com as tabelas `produtos`, `clientes`, `pedidos`.

## Banco e servidor
O `server.js` foi configurado conforme solicitado:
- `host: localhost`
- `user: root`
- `password: escola`
- `database: loja_ia`

Se ainda não houver a tabela `mensagens`, importe o `memoria.sql` no banco `loja_ia` (por exemplo: `mysql -u root -p loja_ia < memoria.sql`, digitando `escola` quando solicitado).

## Como executar
1. Abra o terminal na pasta desta versão.
2. `npm install`
3. `npm start`
4. Acesse `http://localhost:3003`.

Os três projetos usam a mesma porta `3003`, então execute **apenas um de cada vez**. Para mudar a aparência, encerre o servidor com Ctrl+C e abra outra pasta.

**Atenção:** os previews em PNG usam mensagens simuladas para demonstrar o layout. O funcionamento real do chat depende de Ollama e MySQL. As credenciais hardcoded são adequadas apenas para uso local de estudos; não publique esse servidor em produção com acesso root.
