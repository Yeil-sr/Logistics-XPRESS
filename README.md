# logistics-xpress

## Sobre o projeto

API completa para gestão logística integrada, oferecendo controle de pedidos, estoque, transportes, coletas, conferências, transferências e rastreamento. O sistema gerencia todo o fluxo desde a criação de pedidos até a entrega, com módulos para clientes, produtos, hubs, motoristas e manifestos.

## Tecnologias

* Node.js
* Express
* Sequelize (ORM)
* SQLite (banco de dados principal)
* JWT (JSON Web Tokens)
* bcrypt (hash de senhas)
* Docker
* CORS

## Arquitetura

O projeto segue a arquitetura MVC (Model-View-Controller) com uma camada de Services adicional para encapsular a lógica de negócio:

* **Models**: Definem a estrutura das tabelas no banco de dados e seus relacionamentos
* **Controllers**: Gerenciam as requisições HTTP, validam entradas e retornam respostas
* **Services**: Contêm a lógica de negócio complexa, operações em banco e regras específicas
* **Routes**: Mapeiam os endpoints da API para os controllers correspondentes

## Estrutura de pastas

```
src/
├── config/              # Configurações do banco de dados (Sequelize)
├── models/              # Modelos de dados e relacionamentos
├── controllers/         # Controladores HTTP para cada entidade
├── services/           # Lógica de negócio e operações de banco
├── routes/             # Definição de rotas da API
├── middlewares/        # Middlewares (autenticação, etc.)
├── views/              # Arquivos HTML para dashboards
└── public/             # Arquivos estáticos
```

## Requisitos

* Node.js (versão 14+)
* SQLite
* Docker (opcional, para containerização)

## Instalação

1. Clone o repositório:

```bash
git clone <repository-url>
cd logistics-xpress
```

2. Instale as dependências:

```bash
npm install
```

3. Configure as variáveis de ambiente (crie um arquivo `.env` na raiz):

```bash
JWT_SECRET=seu_segredo_jwt
SYSTEM_USER_ID=1
SYSTEM_CLIENTE_ID=1
```

4. Inicie o servidor:

```bash
npm start
```

5. Acesse a aplicação em `http://localhost:8080`

## Variáveis de ambiente

| Variável            | Descrição                                        | Exemplo               | Obrigatória |
| ------------------- | ------------------------------------------------ | --------------------- | ----------- |
| `JWT_SECRET`        | Segredo para assinatura de tokens JWT            | `minha_chave_secreta` | Sim         |
| `SYSTEM_USER_ID`    | ID do usuário sistema para operações automáticas | `1`                   | Sim         |
| `SYSTEM_CLIENTE_ID` | ID do cliente padrão para pedidos automáticos    | `1`                   | Sim         |
| `NODE_ENV`          | Ambiente de execução                             | `development`         | Não         |

## Banco de dados

O projeto utiliza **SQLite** como banco de dados principal, configurado via Sequelize. As migrations são executadas automaticamente na inicialização.

**Principais entidades identificadas (inferido dos endpoints):**

* **Clientes**: Usuários do sistema
* **Produtos**: Itens gerenciados no estoque
* **Hubs**: Centros de distribuição/armazenamento
* **Estoques**: Controle de quantidades por hub
* **Pedidos**: Solicitações de clientes
* **PedidosItens**: Itens específicos de cada pedido
* **Conferências**: Verificação de pedidos
* **Coletas**: Agendamentos de coleta
* **Motoristas**: Responsáveis por transportes
* **Transportes**: Movimentações entre hubs
* **Rotas**: Trajetos para transportes
* **Paradas**: Pontos específicos nas rotas
* **Recebimentos**: Entradas no sistema
* **Transferências**: Movimentações internas
* **Separacoes**: Separação de pedidos
* **Manifestos**: Documentos fiscais
* **NotasFiscais**: Documentação fiscal
* **NotasItens**: Itens das notas fiscais
* **Expedição**: Processo de envio
* **Exceções**: Ocorrências fora do padrão
* **Rastreamento**: Monitoramento de pedidos
* **Endereços**: Localizações cadastradas

Para sincronizar o banco de dados:

```bash
# O Sequelize sincroniza automaticamente na inicialização
npm start
```

### Autenticação

* `POST /usuarios/login` – Autenticação de usuário

### Pedidos

* `GET /pedidos` – Lista todos os pedidos com filtros
* `POST /pedidos` – Cria um novo pedido com itens
* `GET /pedidos/:id` – Obtém detalhes de um pedido específico
* `PUT /pedidos/:id` – Atualiza um pedido
* `POST /pedidos/:id/associar-transporte` – Associa pedidos a um transporte
* `GET /pedidos/contadores` – Obtém contadores de pedidos por status (inferido)
* `GET /pedidos/:id/rastreamento` – Obtém rastreamentos do pedido (inferido)
* `DELETE /pedidos/:id` – Exclui pedido (inferido)
* `POST /pedidos/:id/remover-transporte` – Remove associação com transporte (inferido)
* `GET /pedidos/codigo/:codigoPedido` – Obtém pedido por código (inferido)
* `POST /pedidos/recebimentos/:id/associar-pedido` – Associa pedido a recebimento (inferido)
* `POST /pedidos/recebimentos/:id/remover-pedido/:pedidoId` – Remove associação com recebimento (inferido)
* `POST /pedidos/transferencias/:id/associar-pedido` – Associa pedido a transferência (inferido)
* `POST /pedidos/transferencias/:id/remover-pedido/:pedidoId` – Remove associação com transferência (inferido)
* `POST /pedidos/conferencias/:id/associar-pedido` – Associa pedido a conferência (inferido)
* `POST /pedidos/conferencias/:id/remover-pedido/:pedidoId` – Remove associação com conferência (inferido)

### Pedidos Itens

* `GET /pedidos-itens` – Lista todos os itens de pedidos (inferido)
* `GET /pedidos-itens/:id` – Obtém item de pedido por ID (inferido)
* `POST /pedidos-itens` – Cria novo item de pedido (inferido)
* `PUT /pedidos-itens/:id` – Atualiza item de pedido (inferido)
* `DELETE /pedidos-itens/:id` – Exclui item de pedido (inferido)
* `GET /pedidos-itens/by-pedido/:pedidoId` – Obtém itens por pedido (inferido)
* `POST /pedidos-itens/:pedidoId/bulk` – Cria múltiplos itens para um pedido (inferido)

### Estoques

* `GET /estoques` – Consulta estoques com filtros
* `POST /estoques/entrada` – Registra entrada de estoque
* `POST /estoques/saida` – Registra saída de estoque
* `POST /estoques/transferir` – Transfere estoque entre hubs
* `GET /estoques/low-stock` – Obtém itens com estoque baixo (inferido)
* `GET /estoques/summary` – Obtém resumo do estoque (inferido)
* `GET /estoques/movimentacao` – Obtém movimentações por query (inferido)
* `GET /estoques/:id/movimentacoes` – Obtém movimentações por ID de estoque (inferido)
* `GET /estoques/:id` – Obtém estoque por ID (inferido)
* `POST /estoques/reservar` – Reserva estoque (inferido)
* `POST /estoques/liberar-reserva` – Libera reserva de estoque (inferido)
* `POST /estoques/ajustar` – Ajusta estoque (inferido)

### Transportes

* `GET /transportes` – Lista transportes
* `POST /transportes` – Cria novo transporte
* `POST /transportes/:id/iniciar` – Inicia um transporte
* `POST /transportes/:id/atribuir-motorista` – Atribui motorista ao transporte

### Conferências

* `GET /conferencias` – Lista conferências
* `POST /conferencias` – Cria nova conferência com pedidos
* `POST /conferencias/:id/concluir` – Conclui uma conferência
* `POST /conferencias/:id/pedido/:pedidoId/validar` – Valida pedido na conferência
* `GET /conferencias/search` – Busca conferências (inferido)
* `POST /conferencias/:id/pedido/:pedidoId/invalidar` – Invalida pedido na conferência (inferido)
* `GET /conferencias/:id/pedidos` – Obtém pedidos da conferência (inferido)
* `GET /conferencias/:id/pedidos-validados` – Obtém pedidos validados da conferência (inferido)
* `PUT /conferencias/:id` – Atualiza conferência (inferido)
* `DELETE /conferencias/:id` – Exclui conferência (inferido)

### Coletas

* `GET /coletas` – Lista coletas
* `POST /coletas` – Cria nova coleta
* `PUT /coletas/:id/coletar` – Marca coleta como realizada
* `GET /coletas/:id` – Obtém coleta por ID (inferido)
* `PUT /coletas/:id` – Atualiza coleta (inferido)
* `DELETE /coletas/:id` – Exclui coleta (inferido)
* `GET /coletas/pendentes` – Lista coletas pendentes (inferido)

### Manifestos

* `GET /manifestos` – Lista manifestos
* `POST /manifestos` – Cria novo manifesto
* `POST /manifestos/from-pedidos` – Cria manifesto a partir de pedidos
* `PUT /manifestos/:id` – Atualiza manifesto (inferido)
* `DELETE /manifestos/:id` – Exclui manifesto (inferido)
* `POST /manifestos/:id/associate-notas` – Associa notas fiscais ao manifesto (inferido)
* `GET /manifestos/:id/notas` – Obtém notas do manifesto (inferido)

### Clientes

* `GET /clientes` – Lista todos os clientes (inferido)
* `GET /clientes/:id` – Obtém cliente por ID (inferido)
* `POST /clientes` – Cria novo cliente (inferido)
* `POST /clientes/:id/restaura` – Restaura cliente excluído (inferido)
* `PUT /clientes/:id` – Atualiza cliente (inferido)
* `DELETE /clientes/:id` – Exclui cliente (inferido)

### Dashboard / Views públicas

* `GET /dashboard/diagrama` – Serve página de diagrama (HTML)
* `GET /dashboard/diagrama-bpmn` – Serve página de diagrama BPMN (HTML)
* `GET /dashboard/rota` – Serve página de rota (HTML)
* `GET /` – Página de login (HTML)
* `GET /gerar/mdf-e` – Página para gerar MDF-e (HTML)
* `GET /gerar/nf-e` – Página para gerar NF-e (HTML)

### Endereços

* `GET /enderecos` – Lista todos os endereços (inferido)
* `GET /enderecos/:id` – Obtém endereço por ID (inferido)
* `POST /enderecos` – Cria novo endereço (inferido)
* `PUT /enderecos/:id` – Atualiza endereço (inferido)
* `DELETE /enderecos/:id` – Exclui endereço (inferido)

### Exceções

* `GET /excecoes` – Lista todas as exceções (inferido)
* `GET /excecoes/:id` – Obtém exceção por ID (inferido)
* `POST /excecoes` – Cria nova exceção (inferido)
* `PUT /excecoes/:id` – Atualiza exceção (inferido)
* `DELETE /excecoes/:id` – Exclui exceção (inferido)

### Expedição

* `GET /expedicao` – Lista todas as expedições (inferido)
* `GET /expedicao/:id` – Obtém expedição por ID (inferido)
* `POST /expedicao/:pedidoId` – Cria expedição para pedido (inferido)
* `PUT /expedicao/:id` – Atualiza expedição (inferido)
* `DELETE /expedicao/:id` – Exclui expedição (inferido)

### Hubs

* `POST /hubs` – Cria novo hub (inferido)
* `GET /hubs/:id` – Obtém hub por ID (inferido)
* `GET /hubs` – Lista todos os hubs (inferido)
* `DELETE /hubs/:id` – Exclui hub (inferido)

### Motoristas

* `GET /motoristas` – Lista todos os motoristas (inferido)
* `GET /motoristas/:id` – Obtém motorista por ID (inferido)
* `GET /motoristas/:id/coletas` – Obtém coletas do motorista (inferido)
* `POST /motoristas` – Cria novo motorista (inferido)
* `PUT /motoristas/:id` – Atualiza motorista (inferido)
* `DELETE /motoristas/:id` – Exclui motorista (inferido)

### Notas Fiscais

* `GET /notas-fiscais` – Lista todas as notas fiscais (inferido)
* `GET /notas-fiscais/:id` – Obtém nota fiscal por ID (inferido)
* `POST /notas-fiscais` – Cria nova nota fiscal (inferido)
* `PUT /notas-fiscais/:id` – Atualiza nota fiscal (inferido)
* `DELETE /notas-fiscais/:id` – Exclui nota fiscal (inferido)
* `GET /notas-fiscais/by-pedido/:pedidoId` – Obtém notas fiscais por pedido (inferido)
* `GET /notas-fiscais/:id/itens` – Obtém itens da nota fiscal (inferido)

### Notas Itens

* `GET /notas-itens` – Lista todos os itens de notas fiscais (inferido)
* `GET /notas-itens/:id` – Obtém item de nota por ID (inferido)
* `POST /notas-itens` – Cria novo item de nota (inferido)
* `PUT /notas-itens/:id` – Atualiza item de nota (inferido)
* `DELETE /notas-itens/:id` – Exclui item de nota (inferido)
* `GET /notas-itens/by-nota/:notaId` – Obtém itens por nota fiscal (inferido)
* `POST /notas-itens/bulk` – Cria múltiplos itens de nota (inferido)

### Paradas

* `GET /paradas` – Lista todas as paradas (inferido)
* `GET /paradas/:id` – Obtém parada por ID (inferido)
* `POST /paradas` – Cria nova parada (inferido)
* `PUT /paradas/:id` – Atualiza parada (inferido)
* `DELETE /paradas/:id` – Exclui parada (inferido)

### Produtos

* `GET /produtos` – Lista todos os produtos (inferido)
* `GET /produtos/:id` – Obtém produto por ID (inferido)
* `GET /produtos/:id/summary` – Obtém resumo do produto (inferido)
* `POST /produtos` – Cria novo produto (inferido)
* `PUT /produtos/:id` – Atualiza produto (inferido)
* `DELETE /produtos/:id` – Exclui produto (inferido)
* `GET /produtos/:id/pedido` – Obtém pedidos do produto (inferido)

### Rastreamento

* `GET /rastreamento` – Lista todos os rastreamentos (inferido)
* `GET /rastreamento/:id` – Obtém rastreamento por ID (inferido)
* `POST /rastreamento` – Cria novo rastreamento (inferido)
* `PUT /rastreamento/:id` – Atualiza rastreamento (inferido)
* `DELETE /rastreamento/:id` – Exclui rastreamento (inferido)

### Recebimento

* `GET /recebimentos` – Lista todos os recebimentos (inferido)
* `GET /recebimentos/:id` – Obtém recebimento por ID (inferido)
* `POST /recebimentos` – Cria novo recebimento (inferido)
* `POST /recebimentos/:id/concluir` – Conclui recebimento (inferido)
* `GET /recebimentos/:id/pedidos` – Obtém pedidos do recebimento (inferido)
* `GET /recebimentos/:id/pedidos/count` – Conta pedidos do recebimento (inferido)
* `PUT /recebimentos/:id` – Atualiza recebimento (inferido)

## Exemplos de uso

### 1. Criar um pedido

```bash
curl -X POST http://localhost:8080/pedidos \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "codigo_pedido": "PED12345",
    "cliente_id": 1,
    "endereco_id": 1,
    "itens": [
      {
        "produto_id": 1,
        "quantidade": 2,
        "valor_unitario": 50.00
      }
    ]
  }'
```

### 2. Registrar entrada no estoque

```bash
curl -X POST http://localhost:8080/estoques/entrada \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "produto_id": 1,
    "hub_id": 1,
    "quantidade": 100,
    "usuario_id": 1
  }'
```

### 3. Criar conferência

```bash
curl -X POST http://localhost:8080/conferencias \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "tipo": "INBOUND",
    "operador_id": 1,
    "pedidos": [1, 2, 3],
    "nome_estacao": "Recebimento Principal"
  }'
```

## Testes

O projeto não inclui uma suíte de testes automatizada identificável nos arquivos fornecidos. Para implementar testes, recomenda-se:

* Configurar Jest ou Mocha para testes unitários
* Criar testes para services críticos
* Implementar testes de integração para endpoints principais

## Boas práticas e segurança

1. **Autenticação JWT**: Todos os endpoints (exceto login e páginas públicas) requerem token de autenticação.
2. **Validação de dados**: Controllers validam entradas antes de processar (quando aplicável).
3. **Transações**: Operações críticas usam transações do Sequelize para consistência.
4. **Separação de preocupações**: Lógica de negócio isolada em services.
5. **Tratamento de erros**: Middleware de erro centralizado.
6. **Proteção contra SQL injection**: Uso de ORM (Sequelize) com parâmetros parametrizados (quando aplicável).

## Licença

Este projeto está licenciado sob a licença MIT. Consulte o arquivo LICENSE para detalhes.

## Autor

Yale Designer

