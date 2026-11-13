-- Memória das conversas. Execute uma vez dentro do banco loja_ia.
-- Este script não apaga mensagens existentes.
USE loja_ia;
CREATE TABLE IF NOT EXISTS mensagens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  conversa VARCHAR(36) NOT NULL,
  role VARCHAR(10) NOT NULL,
  content TEXT NOT NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX (conversa)
);
