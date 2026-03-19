# 📄 Especificação de Requisitos — logistics-xpress

## 1. Visão Geral

O **logistics-xpress** é uma API para gestão logística integrada, responsável por controlar o fluxo completo de pedidos, desde a entrada (recebimento) até a saída (expedição), incluindo controle de estoque por SKU e rastreamento operacional.

O sistema deve operar com alta confiabilidade, suportar cargas variáveis e garantir consistência em operações críticas.

---

## 2. Escopo do Sistema

O sistema contempla:

* Gestão de pedidos
* Controle de estoque por SKU e hub
* Recebimentos (INBOUND)
* Expedição (OUTBOUND)
* Transferências entre hubs
* Conferência de pedidos
* Transporte e logística
* Notas fiscais
* Rastreamento
* Gestão de clientes, produtos e endereços

---

## 3. Requisitos Funcionais

### 3.1 Autenticação e Segurança

* RF01: O sistema deve permitir autenticação via JWT.
* RF02: O sistema deve proteger endpoints com autenticação.
* RF03: O sistema deve validar dados de entrada.

---

### 3.2 Pedidos

* RF04: Criar pedidos com múltiplos itens.
* RF05: Atualizar pedidos.
* RF06: Excluir pedidos (soft delete).
* RF07: Consultar pedidos por ID, código ou filtros.
* RF08: Atualizar status do pedido.
* RF09: Associar pedidos a transportes, recebimentos, transferências e conferências.

---

### 3.3 Itens de Pedido

* RF10: Adicionar itens ao pedido.
* RF11: Atualizar itens do pedido.
* RF12: Remover itens.
* RF13: Calcular automaticamente o valor total do pedido.

---

### 3.4 Estoque

* RF14: Registrar entrada de estoque.
* RF15: Registrar saída de estoque.
* RF16: Reservar estoque.
* RF17: Liberar reserva.
* RF18: Transferir estoque entre hubs.
* RF19: Ajustar estoque manualmente.
* RF20: Consultar estoque por SKU e hub.
* RF21: Identificar estoque baixo.

---

### 3.5 Recebimentos

* RF22: Criar recebimentos.
* RF23: Associar pedidos ao recebimento.
* RF24: Registrar dados de transporte.
* RF25: Associar manifestos e notas fiscais.
* RF26: Concluir recebimento.

---

### 3.6 Conferência

* RF27: Criar conferência.
* RF28: Validar pedidos.
* RF29: Invalidar pedidos.
* RF30: Concluir conferência.

---

### 3.7 Transportes

* RF31: Criar transportes.
* RF32: Atribuir motorista.
* RF33: Iniciar transporte.
* RF34: Atualizar status logístico.

---

### 3.8 Transferências

* RF35: Criar transferências entre hubs.
* RF36: Associar pedidos.
* RF37: Registrar movimentação de estoque.

---

### 3.9 Expedição

* RF38: Criar expedição.
* RF39: Atualizar status de envio.
* RF40: Finalizar entrega.

---

### 3.10 Notas Fiscais

* RF41: Criar notas fiscais.
* RF42: Atualizar notas fiscais.
* RF43: Consultar notas fiscais por pedido.
* RF44: Associar notas a manifestos.
* RF45: Gerenciar itens da nota fiscal.

---

### 3.11 Rastreamento

* RF46: Registrar eventos de rastreamento.
* RF47: Consultar histórico de pedidos.

---

### 3.12 Exceções

* RF48: Registrar exceções operacionais.
* RF49: Atualizar exceções.
* RF50: Consultar exceções.

---

## 4. Requisitos Não Funcionais

### 4.1 Desempenho

* RNF01: Suportar entre 5.000 e 25.000 requisições diárias.
* RNF02: Suportar picos de até 55.000 requisições semanais.
* RNF03: Tempo médio de resposta inferior a 500ms.
* RNF04: Operações críticas devem manter performance sob carga.

---

### 4.2 Escalabilidade

* RNF05: O sistema deve suportar escalabilidade horizontal.
* RNF06: Deve permitir balanceamento de carga.
* RNF07: Deve suportar separação futura de leitura e escrita.

---

### 4.3 Consistência

* RNF08: Operações críticas devem ser transacionais.
* RNF09: Não permitir estoque negativo.
* RNF10: Garantir integridade entre entidades relacionadas.
* RNF11: Evitar duplicidade de dados.

---

### 4.4 Disponibilidade

* RNF12: Disponibilidade mínima de 99%.
* RNF13: Consultas devem permanecer disponíveis sob falhas parciais.

---

### 4.5 Segurança

* RNF14: Autenticação via JWT.
* RNF15: Hash de senha com bcrypt.
* RNF16: Proteção contra SQL Injection.
* RNF17: Validação de inputs.

---

### 4.6 Observabilidade

* RNF18: Logging centralizado.
* RNF19: Monitoramento de erros.
* RNF20: Rastreabilidade de operações.

---

### 4.7 Confiabilidade

* RNF21: Uso de transações em operações críticas.
* RNF22: Tolerância a falhas parciais.
* RNF23: Operações idempotentes quando necessário.

---

## 5. Regras de Negócio

### 5.1 Estoque

* RN01: Toda saída deve refletir no estoque.
* RN02: Reserva deve ocorrer antes da expedição.
* RN03: Não permitir saída sem estoque disponível.

---

### 5.2 Pedidos

* RN04: Pedido deve respeitar fluxo de status.
* RN05: Pedido não pode ser expedido sem conferência (quando aplicável).

---

### 5.3 Recebimento

* RN06: Entrada de estoque apenas após conferência.
* RN07: Notas fiscais devem estar associadas.

---

### 5.4 Consistência

* RN08: Operações de pedido + estoque devem ser atômicas.

---

