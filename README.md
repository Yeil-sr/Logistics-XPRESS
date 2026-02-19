# logistics-xpress

## Sobre o projeto

API completa para gestão logística integrada, oferecendo controle de pedidos, estoque, transportes, coletas, conferências, transferências e rastreamento. O sistema gerencia todo o fluxo desde a criação de pedidos até a entrega, com módulos para clientes, produtos, hubs, motoristas e manifestos.

## Tecnologias

* Node.js
* Express
* Sequelize (ORM)
* PostgreSQL (banco de dados principal)
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
*PostgreSQL
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

O projeto utiliza **PostgreSQL** como banco de dados principal, configurado via Sequelize. As migrations são executadas automaticamente na inicialização.

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

## Rotas da API

### Autenticação

* `POST /usuarios/login` – Autenticação de usuário

### Pedidos

* `GET /pedidos` – Lista todos os pedidos com filtros
* `POST /pedidos` – Cria um novo pedido com itens
* `GET /pedidos/:id` – Obtém detalhes de um pedido específico
* `PUT /pedidos/:id` – Atualiza um pedido
* `DELETE /pedidos/:id` – Exclui pedido
* `GET /pedidos/codigo/:codigoPedido` – Obtém pedido por código
* `POST /pedidos/:id/associar-transporte` – Associa pedidos a um transporte
* `POST /pedidos/:id/remover-transporte` – Remove associação com transporte
* `GET /pedidos/contadores` – Obtém contadores de pedidos por status
* `GET /pedidos/:id/rastreamento` – Obtém rastreamentos do pedido
* `POST /pedidos/recebimentos/:id/associar-pedido` – Associa pedido a recebimento
* `POST /pedidos/recebimentos/:id/remover-pedido/:pedidoId` – Remove associação com recebimento
* `POST /pedidos/transferencias/:id/associar-pedido` – Associa pedido a transferência
* `POST /pedidos/transferencias/:id/remover-pedido/:pedidoId` – Remove associação com transferência
* `POST /pedidos/conferencias/:id/associar-pedido` – Associa pedido a conferência
* `POST /pedidos/conferencias/:id/remover-pedido/:pedidoId` – Remove associação com conferência

### Pedidos Itens

* `GET /pedidos-itens` – Lista todos os itens de pedidos
* `GET /pedidos-itens/:id` – Obtém item de pedido por ID
* `POST /pedidos-itens` – Cria novo item de pedido
* `PUT /pedidos-itens/:id` – Atualiza item de pedido
* `DELETE /pedidos-itens/:id` – Exclui item de pedido
* `GET /pedidos-itens/by-pedido/:pedidoId` – Obtém itens por pedido
* `POST /pedidos-itens/:pedidoId/bulk` – Cria múltiplos itens para um pedido

### Estoques

* `GET /estoques` – Consulta estoques com filtros
* `GET /estoques/:id` – Obtém estoque por ID
* `GET /estoques/low-stock` – Obtém itens com estoque baixo
* `GET /estoques/summary` – Obtém resumo do estoque
* `GET /estoques/movimentacao` – Obtém movimentações por query
* `GET /estoques/:id/movimentacoes` – Obtém movimentações por ID de estoque
* `POST /estoques/entrada` – Registra entrada de estoque
* `POST /estoques/saida` – Registra saída de estoque
* `POST /estoques/transferir` – Transfere estoque entre hubs
* `POST /estoques/reservar` – Reserva estoque
* `POST /estoques/liberar-reserva` – Libera reserva de estoque
* `POST /estoques/ajustar` – Ajusta estoque

### Transportes

* `GET /transportes` – Lista transportes
* `POST /transportes` – Cria novo transporte
* `POST /transportes/:id/iniciar` – Inicia um transporte
* `POST /transportes/:id/atribuir-motorista` – Atribui motorista ao transporte

### Conferências

* `GET /conferencias` – Lista conferências
* `POST /conferencias` – Cria nova conferência com pedidos
* `GET /conferencias/search` – Busca conferências
* `GET /conferencias/:id` – Obtém conferência por ID
* `PUT /conferencias/:id` – Atualiza conferência
* `DELETE /conferencias/:id` – Exclui conferência
* `POST /conferencias/:id/concluir` – Conclui uma conferência
* `GET /conferencias/:id/pedidos` – Obtém pedidos da conferência
* `GET /conferencias/:id/pedidos-validados` – Obtém pedidos validados da conferência
* `POST /conferencias/:id/pedido/:pedidoId/validar` – Valida pedido na conferência
* `POST /conferencias/:id/pedido/:pedidoId/invalidar` – Invalida pedido na conferência

### Coletas

* `GET /coletas` – Lista coletas
* `POST /coletas` – Cria nova coleta
* `GET /coletas/:id` – Obtém coleta por ID
* `PUT /coletas/:id` – Atualiza coleta
* `DELETE /coletas/:id` – Exclui coleta
* `GET /coletas/pendentes` – Lista coletas pendentes
* `PUT /coletas/:id/coletar` – Marca coleta como realizada

### Manifestos

* `GET /manifestos` – Lista manifestos
* `POST /manifestos` – Cria novo manifesto
* `POST /manifestos/from-pedidos` – Cria manifesto a partir de pedidos
* `GET /manifestos/:id` – Obtém manifesto por ID
* `PUT /manifestos/:id` – Atualiza manifesto
* `DELETE /manifestos/:id` – Exclui manifesto
* `GET /manifestos/:id/notas` – Obtém notas do manifesto
* `POST /manifestos/:id/associate-notas` – Associa notas fiscais ao manifesto

### Clientes

* `GET /clientes` – Lista todos os clientes
* `GET /clientes/:id` – Obtém cliente por ID
* `POST /clientes` – Cria novo cliente
* `PUT /clientes/:id` – Atualiza cliente
* `DELETE /clientes/:id` – Exclui cliente
* `POST /clientes/:id/restaura` – Restaura cliente excluído

### Endereços

* `GET /enderecos` – Lista todos os endereços
* `GET /enderecos/:id` – Obtém endereço por ID
* `POST /enderecos` – Cria novo endereço
* `PUT /enderecos/:id` – Atualiza endereço
* `DELETE /enderecos/:id` – Exclui endereço

### Exceções

* `GET /excecoes` – Lista todas as exceções
* `GET /excecoes/:id` – Obtém exceção por ID
* `POST /excecoes` – Cria nova exceção
* `PUT /excecoes/:id` – Atualiza exceção
* `DELETE /excecoes/:id` – Exclui exceção

### Expedição

* `GET /expedicao` – Lista todas as expedições
* `GET /expedicao/:id` – Obtém expedição por ID
* `POST /expedicao/:pedidoId` – Cria expedição para pedido
* `PUT /expedicao/:id` – Atualiza expedição
* `DELETE /expedicao/:id` – Exclui expedição

### Hubs

* `GET /hubs` – Lista todos os hubs
* `GET /hubs/:id` – Obtém hub por ID
* `POST /hubs` – Cria novo hub
* `DELETE /hubs/:id` – Exclui hub

### Motoristas

* `GET /motoristas` – Lista todos os motoristas
* `GET /motoristas/:id` – Obtém motorista por ID
* `GET /motoristas/:id/coletas` – Obtém coletas do motorista
* `POST /motoristas` – Cria novo motorista
* `PUT /motoristas/:id` – Atualiza motorista
* `DELETE /motoristas/:id` – Exclui motorista

### Notas Fiscais

* `GET /notas-fiscais` – Lista todas as notas fiscais
* `GET /notas-fiscais/:id` – Obtém nota fiscal por ID
* `POST /notas-fiscais` – Cria nova nota fiscal
* `PUT /notas-fiscais/:id` – Atualiza nota fiscal
* `DELETE /notas-fiscais/:id` – Exclui nota fiscal
* `GET /notas-fiscais/by-pedido/:pedidoId` – Obtém notas fiscais por pedido
* `GET /notas-fiscais/:id/itens` – Obtém itens da nota fiscal

### Notas Itens

* `GET /notas-itens` – Lista todos os itens de notas fiscais
* `GET /notas-itens/:id` – Obtém item de nota por ID
* `POST /notas-itens` – Cria novo item de nota
* `PUT /notas-itens/:id` – Atualiza item de nota
* `DELETE /notas-itens/:id` – Exclui item de nota
* `GET /notas-itens/by-nota/:notaId` – Obtém itens por nota fiscal
* `POST /notas-itens/bulk` – Cria múltiplos itens de nota

### Paradas

* `GET /paradas` – Lista todas as paradas
* `GET /paradas/:id` – Obtém parada por ID
* `POST /paradas` – Cria nova parada
* `PUT /paradas/:id` – Atualiza parada
* `DELETE /paradas/:id` – Exclui parada

### Produtos

* `GET /produtos` – Lista todos os produtos
* `GET /produtos/:id` – Obtém produto por ID
* `GET /produtos/:id/summary` – Obtém resumo do produto
* `POST /produtos` – Cria novo produto
* `PUT /produtos/:id` – Atualiza produto
* `DELETE /produtos/:id` – Exclui produto
* `GET /produtos/:id/pedido` – Obtém pedidos do produto

### Rastreamento

* `GET /rastreamento` – Lista todos os rastreamentos
* `GET /rastreamento/:id` – Obtém rastreamento por ID
* `POST /rastreamento` – Cria novo rastreamento
* `PUT /rastreamento/:id` – Atualiza rastreamento
* `DELETE /rastreamento/:id` – Exclui rastreamento

### Recebimento

* `GET /recebimentos` – Lista todos os recebimentos
* `GET /recebimentos/:id` – Obtém recebimento por ID
* `POST /recebimentos` – Cria novo recebimento
* `PUT /recebimentos/:id` – Atualiza recebimento
* `POST /recebimentos/:id/concluir` – Conclui recebimento
* `GET /recebimentos/:id/pedidos` – Obtém pedidos do recebimento
* `GET /recebimentos/:id/pedidos/count` – Conta pedidos do recebimento

### Transferências

* `GET /transferencias` – Lista todas as transferências (inferido)
* `GET /transferencias/:id` – Obtém transferência por ID (inferido)
* `POST /transferencias` – Cria nova transferência
* `PUT /transferencias/:id` – Atualiza transferência (inferido)
* `DELETE /transferencias/:id` – Exclui transferência (inferido)

### Dashboard / Views públicas

* `GET /dashboard/diagrama` – Serve página de diagrama (HTML)
* `GET /dashboard/diagrama-bpmn` – Serve página de diagrama BPMN (HTML)
* `GET /dashboard/rota` – Serve página de rota (HTML)
* `GET /` – Página de login (HTML)
* `GET /gerar/mdf-e` – Página para gerar MDF-e (HTML)
* `GET /gerar/nf-e` – Página para gerar NF-e (HTML)

## Exemplos de uso detalhados

Abaixo estão exemplos completos de requisições e respostas para as principais operações do sistema.

### 1. Criar um recebimento

**Endpoint:** `POST /recebimentos`

**Payload de exemplo:**

```json
{
  "operador_id": 4,
  "usuario_id": 4,
  "tipo_tarefa": "INBOUND",
  "metodo_recebimento": "MANIFESTO",
  "origem_hub_nome": "Centro de Distribuição São Paulo",
  "destino_hub_nome": "Hub Regional Campinas",
  "recebimento": {
    "numero_recebimento": "REC-2026-0212-001",
    "numero_romaneio": "ROM-12345",
    "localizacao": "Doca 07 - Setor A",
    "observacoes": "Recebimento de eletrônicos - Notas com divergência parcial",
    "transporte": {
      "transportador_nome": "Transportadora Expressa Ltda",
      "cnpj_transportador": "12.345.678/0001-90",
      "placa_veiculo": "ABC1D23",
      "uf_veiculo": "SP",
      "frete_por_conta": "CIF",
      "quantidade_volume": 45,
      "especie_volumes": "CAIXAS",
      "marca_volumes": "HP",
      "numero_volumes": "VOL-001 a VOL-045",
      "peso_bruto": 720.5,
      "peso_liquido": 684.3,
      "informacoes_transporte": "NF-e 123456 vinculada ao manifesto"
    }
  },
  "manifestos": [
    {
      "numero_manifesto": "MAN-2026-0001",
      "serie": "1",
      "data_emissao": "2026-02-12T08:00:00.000Z",
      "origem_hub_nome": "Centro de Distribuição São Paulo",
      "destino_hub_nome": "Hub Regional Campinas",
      "observacoes": "Manifesto gerado automaticamente via recebimento",
      "notas": [
        {
          "numero": "123456",
          "serie": "1",
          "chave_nfe": "35200612345678901234567890123456789012345678",
          "data_emissao": "2026-02-10T14:30:00.000Z",
          "tipo": "NF-e",
          "itens": [
            {
              "produto": {
                "nome": "Notebook HP EliteBook 840 G9",
                "descricao": "Intel i7, 16GB RAM, 512GB SSD",
                "preco": 5899.99,
                "peso_kg": 1.8
              },
              "quantidade": 10,
              "valor_unitario": 5899.99
            },
            {
              "produto": {
                "nome": "Mouse Sem Fio HP 150",
                "descricao": "Preto, conectividade USB",
                "preco": 49.90,
                "peso_kg": 0.15
              },
              "quantidade": 20,
              "valor_unitario": 49.90
            }
          ]
        }
      ]
    }
  ],
  "pedidosDados": [
    {
      "codigo": "PED-HP-Z2-G9-76",
      "itens": [
        {
          "produto_id": 48,
          "quantidade": 1,
          "valor_unitario": 18599.99,
          "descricao": "HP Z2 G9 TWR i714700 32GB/2TB PC"
        }
      ],
      "meta": {
        "cliente_id": 8,
        "endereco_id": 8,
        "cliente": {
          "nome": "Empresa Tech Solutions",
          "cpf": null,
          "email": "compras@techsolutions.com.br",
          "telefone": "(11) 99999-8888"
        },
        "endereco": {
          "cep": "13000-000",
          "rua": "Avenida das Nações",
          "numero": "1500",
          "complemento": "Sala 302",
          "bairro": "Jardim Europa",
          "cidade": "Campinas",
          "estado": "SP"
        },
        "manifesto_numero": "MAN-2026-0001",
        "gerarNota": true,
        "notas": [
          {
            "numero": "789012",
            "serie": "1",
            "data_emissao": "2026-02-11T09:15:00.000Z",
            "itens": [
              {
                "produto": {
                  "nome": "HP Z2 G9 TWR i714700 32GB/2TB PC",
                  "descricao": "Workstation de alto desempenho",
                  "preco": 18599.99,
                  "peso_kg": 15.2
                },
                "quantidade": 1,
                "valor_unitario": 18599.99
              }
            ]
          }
        ]
      }
    },
    {
      "codigo": "PED-MON-27-4K",
      "itens": [
        {
          "produto": {
            "nome": "Monitor Profissional HP Z27 4K",
            "descricao": "27 polegadas, 4K UHD, HDR",
            "preco": 3299.90,
            "peso_kg": 6.5
          },
          "quantidade": 2,
          "valor_unitario": 3299.90
        }
      ],
      "meta": {
        "cliente": {
          "nome": "João da Silva",
          "cpf": "123.456.789-00",
          "email": "joao.silva@email.com",
          "telefone": "(19) 98888-7777"
        },
        "endereco": {
          "cep": "13070-000",
          "rua": "Rua das Flores",
          "numero": "123",
          "bairro": "Vila Nova",
          "cidade": "Campinas",
          "estado": "SP"
        },
        "gerarNota": true
      }
    }
  ]
}
```

**Resposta (exemplo):**

```json
{
  "message": "Recebimento criado com sucesso",
  "recebimento": {
    "id": 39,
    "operador_id": 4,
    "status": "PENDENTE",
    "data_criacao": "2026-02-13T14:54:50.300Z",
    "quantidade_pedidos": 2,
    "origem_hub_id": 56,
    "destino_hub_id": 59,
    "tipo_tarefa": "INBOUND",
    "metodo_recebimento": "MANIFESTO",
    "updatedAt": "2026-02-13T14:55:07.426Z",
    "createdAt": "2026-02-13T14:54:50.303Z",
    "numero_manifesto": null,
    "numero_recebimento": null,
    "numero_romaneio": null,
    "localizacao": null,
    "observacoes": null,
    "serie": null,
    "data_emissao": null,
    "data_conclusao": null,
    "deletedAt": null
  },
  "conferencia": {
    "id": 17,
    "transporte_id": 31,
    "manifesto_id": 32,
    "recebimento_id": 39,
    "operador_id": 4,
    "total_pedidos_iniciais": 2,
    "total_pedidos_finais": 2,
    "total_at_to": 0,
    "nome_estacao": "RECEBIMENTO",
    "status": "PENDENTE",
    "data_criacao": "2026-02-13T14:54:55.168Z",
    "data_termino": null,
    "percentual_validacao": "0.00",
    "pedidos_escaneados": 0,
    "tipo": "INBOUND",
    "updatedAt": "2026-02-13T14:54:55.171Z",
    "createdAt": "2026-02-13T14:54:55.171Z",
    "deletedAt": null
  },
  "pedidosCriados": [
    {
      "id": 37,
      "codigo_pedido": "PED-HP-Z2-G9",
      "criadoAgora": true
    },
    {
      "id": 38,
      "codigo_pedido": "PED-MON-27-4K",
      "criadoAgora": true
    }
  ],
  "manifestosCriados": [
    {
      "id": 32,
      "numero_manifesto": "MAN-2026-0001",
      "serie": "1",
      "data_emissao": "2026-02-12T08:00:00.000Z",
      "observacoes": "Manifesto gerado automaticamente via recebimento",
      "recebimento_id": 39,
      "origem_hub_id": 56,
      "destino_hub_id": 59,
      "valor_total": 59997.9,
      "quantidade_notas": 1,
      "updatedAt": "2026-02-13T14:54:54.094Z",
      "createdAt": "2026-02-13T14:54:52.596Z",
      "transporte_id": null,
      "transferencia_id": null,
      "deletedAt": null
    }
  ],
  "totalPedidos": 2,
  "totalNotas": 2,
  "valorTotal": 25199.79,
  "transporte": {
    "id": 31,
    "tipo_transporte": "TO",
    "numero_transporte": "TO-1770994494638",
    "recebimento_id": 39,
    "quantidade_total": 2,
    "peso_total_kg": "720.50",
    "volumetria_total": 45,
    "status_transporte": "CRIADO",
    "operador_id": 4,
    "direcao": "INBOUND",
    "data_criacao": "2026-02-13T14:54:54.639Z",
    "nome_transportador": "Transportadora Expressa Ltda",
    "cnpj_transportador": "12.345.678/0001-90",
    "endereco_transportador": null,
    "placa_veiculo": "ABC1D23",
    "uf_veiculo": "SP",
    "frete_por_conta": "CIF",
    "quantidade_volume": 45,
    "especie_volumes": "CAIXAS",
    "marca_volumes": "HP",
    "numero_volumes": "VOL-001 a VOL-045",
    "peso_bruto": "720.50",
    "peso_liquido": "684.30",
    "informacoes_transporte": "NF-e 123456 vinculada ao manifesto",
    "updatedAt": "2026-02-13T14:55:07.589Z",
    "createdAt": "2026-02-13T14:54:54.643Z",
    "recebedor_tipo": null,
    "hub_origem_id": null,
    "transferencia_id": null,
    "hub_destino_id": null,
    "motorista_id": null,
    "rota_id": null,
    "data_conclusao": null,
    "deletedAt": null
  }
}
```

### 2. Criar uma conferência

**Endpoint:** `POST /conferencias`

**Payload de exemplo:**

```json
{
  "tipo": "INBOUND",
  "operador_id": 4,
  "nome_estacao": "Doca 07 - Setor A",
  "manifestoId": 15,
  "pedidos": [
    "PED-HP-Z2-G9-TEST"
  ]
}
```

**Resposta (exemplo):**

```json
{
  "id": 15,
  "transporte_id": null,
  "recebimento_id": null,
  "nome_estacao": "Doca 07 - Setor A",
  "total_at_to": 0,
  "total_pedidos_iniciais": 1,
  "total_pedidos_finais": 1,
  "percentual_validacao": "0.00",
  "pedidos_escaneados": 0,
  "operador_id": 4,
  "manifesto_id": 15,
  "tipo": "INBOUND",
  "status": "PENDENTE",
  "data_criacao": "2026-02-13T14:51:42.324Z",
  "data_termino": null,
  "createdAt": "2026-02-13T14:51:42.324Z",
  "updatedAt": "2026-02-13T14:51:42.324Z",
  "deletedAt": null,
  "pedidos": [
    {
      "id": 14,
      "codigo_pedido": "PED-HP-Z2-G9-TEST",
      "quantidade": 2,
      "status": "AGUARDANDO_CONFERENCIA",
      "data_criacao": "2026-02-09T19:26:48.257Z",
      "cliente_id": 8,
      "endereco_id": 8,
      "recebimento_id": null,
      "transferencia_id": 24,
      "conferencia_id": 15,
      "etiqueta_qr": "QR17706652082567488",
      "manifesto_id": 15,
      "transporte_id": 6,
      "createdAt": "2026-02-09T19:26:48.408Z",
      "updatedAt": "2026-02-13T14:51:43.421Z",
      "deletedAt": null,
      "produtos": [
        {
          "id": 48,
          "nome": "HP Z2 G9 TWR i714700 32GB/2TB PC",
          "s_n": "SNZ2G9TWR202412345",
          "p_n": "5B6L1UT",
          "mac": null,
          "descricao": "Workstation HP Z2 G9 Tower com processador Intel Core i7-14700, 32GB RAM DDR5, 2TB SSD NVMe, NVIDIA RTX A2000 12GB",
          "preco": "18599.99",
          "altura": 45.5,
          "largura": 21.8,
          "volume": 42.7,
          "peso_kg": 15.2,
          "status": "ativo",
          "tipo_entrega": "transportadora",
          "estoque_minimo": 3,
          "createdAt": "2026-02-06T19:43:19.687Z",
          "updatedAt": "2026-02-06T19:43:19.687Z",
          "deletedAt": null,
          "PedidoItens": {
            "pedido_id": 14,
            "produto_id": 48,
            "descricao": "HP Z2 G9 TWR i714700 32GB/2TB PC",
            "quantidade": "2.0000",
            "valor_unitario": "18599.9900",
            "valor_total": "37199.9800",
            "createdAt": "2026-02-09T19:26:48.579Z",
            "updatedAt": "2026-02-09T19:26:48.579Z",
            "deletedAt": null
          }
        }
      ],
      "clientes": {
        "id": 8,
        "nome": "Rafael",
        "cpf": "123.789.456-00",
        "email": "rafaelteste@email.com",
        "telefone": "21999777745",
        "createdAt": "2026-02-06T17:25:01.586Z",
        "updatedAt": "2026-02-06T17:25:01.586Z",
        "deletedAt": null
      }
    }
  ],
  "Transporte": null,
  "manifesto": {
    "id": 15,
    "numero_manifesto": "MAN-1770740056260-0u8chviif",
    "serie": "1",
    "data_emissao": "2026-02-10T16:14:16.262Z",
    "origem_hub_id": null,
    "destino_hub_id": null,
    "transporte_id": null,
    "recebimento_id": null,
    "transferencia_id": null,
    "valor_total": "55799.97",
    "quantidade_notas": 1,
    "observacoes": null,
    "createdAt": "2026-02-10T16:14:16.268Z",
    "updatedAt": "2026-02-10T16:14:16.268Z",
    "deletedAt": null,
    "nota": [
      {
        "id": 7,
        "pedido_id": 14,
        "numero": "NF-COMPLETA-003",
        "serie": "1",
        "chave_nfe": "35240200000000000155550010000012341012345678",
        "data_emissao": "2024-01-15T10:00:00.000Z",
        "valor_total": "55799.97",
        "manifesto_id": 15,
        "tipo": "NF-e",
        "createdAt": "2026-02-10T16:13:56.440Z",
        "updatedAt": "2026-02-10T16:14:16.437Z",
        "deletedAt": null,
        "notaItens": [
          {
            "id": 5,
            "nota_id": 7,
            "produto_id": 48,
            "descricao": "HP Z2 G9 TWR i714700 32GB/2TB PC",
            "quantidade": 2,
            "valor_unitario": "18599.99",
            "cfop": "5102",
            "cest": "1234567",
            "createdAt": "2026-02-10T16:13:56.618Z",
            "updatedAt": "2026-02-10T16:13:56.618Z",
            "deletedAt": null
          },
          {
            "id": 6,
            "nota_id": 7,
            "produto_id": 48,
            "descricao": "HP Z2 G9 TWR i714700 32GB/2TB PC",
            "quantidade": 1,
            "valor_unitario": "18599.99",
            "cfop": "5102",
            "cest": "2345678",
            "createdAt": "2026-02-10T16:13:56.618Z",
            "updatedAt": "2026-02-10T16:13:56.618Z",
            "deletedAt": null
          }
        ]
      }
    ]
  },
  "transferencias": [
    {
      "id": 24,
      "numero_TO": "TO1770994302479",
      "conferencia_id": 15,
      "motorista_id": null,
      "origem_hub_id": null,
      "destino_hub_id": null,
      "tipo_recebedor": "HUB",
      "quantidade": 1,
      "peso_kg": "0.00",
      "direcao": "OUTBOUND",
      "operador_id": 4,
      "status": "CRIADO",
      "data_criacao": "2026-02-13T14:51:42.479Z",
      "data_inicio": null,
      "data_conclusao": null,
      "createdAt": "2026-02-13T14:51:42.480Z",
      "updatedAt": "2026-02-13T14:51:43.578Z",
      "deletedAt": null,
      "pedidos": [
        {
          "id": 14,
          "codigo_pedido": "PED-HP-Z2-G9-TEST",
          "quantidade": 2,
          "status": "AGUARDANDO_CONFERENCIA",
          "data_criacao": "2026-02-09T19:26:48.257Z",
          "cliente_id": 8,
          "endereco_id": 8,
          "recebimento_id": null,
          "transferencia_id": 24,
          "conferencia_id": 15,
          "etiqueta_qr": "QR17706652082567488",
          "manifesto_id": 15,
          "transporte_id": 6,
          "createdAt": "2026-02-09T19:26:48.408Z",
          "updatedAt": "2026-02-13T14:51:43.421Z",
          "deletedAt": null,
          "produtos": [
            {
              "id": 48,
              "nome": "HP Z2 G9 TWR i714700 32GB/2TB PC",
              "s_n": "SNZ2G9TWR202412345",
              "p_n": "5B6L1UT",
              "mac": null,
              "descricao": "Workstation HP Z2 G9 Tower com processador Intel Core i7-14700, 32GB RAM DDR5, 2TB SSD NVMe, NVIDIA RTX A2000 12GB",
              "preco": "18599.99",
              "altura": 45.5,
              "largura": 21.8,
              "volume": 42.7,
              "peso_kg": 15.2,
              "status": "ativo",
              "tipo_entrega": "transportadora",
              "estoque_minimo": 3,
              "createdAt": "2026-02-06T19:43:19.687Z",
              "updatedAt": "2026-02-06T19:43:19.687Z",
              "deletedAt": null,
              "PedidoItens": {
                "pedido_id": 14,
                "produto_id": 48,
                "descricao": "HP Z2 G9 TWR i714700 32GB/2TB PC",
                "quantidade": "2.0000",
                "valor_unitario": "18599.9900",
                "valor_total": "37199.9800",
                "createdAt": "2026-02-09T19:26:48.579Z",
                "updatedAt": "2026-02-09T19:26:48.579Z",
                "deletedAt": null
              }
            }
          ],
          "clientes": {
            "id": 8,
            "nome": "Rafael",
            "cpf": "123.789.456-00",
            "email": "rafaelteste@email.com",
            "telefone": "21999777745",
            "createdAt": "2026-02-06T17:25:01.586Z",
            "updatedAt": "2026-02-06T17:25:01.586Z",
            "deletedAt": null
          }
        }
      ],
      "origemHub": null,
      "destinoHub": null,
      "Motorista": null
    }
  ]
}
```

### 3. Criar uma transferência

**Endpoint:** `POST /transferencias`

**Payload de exemplo:**

```json
{
  "origem_hub_id": 55,
  "destino_hub_id": 58,
  "operador_id": 4,
  "motorista_id": null,
  "tipo_recebedor": "HUB",
  "direcao": "OUTBOUND",
  "numero_TO": "TO-2025-015",
  "pedidosIds": [20, 24],
  "peso_kg": 150.50,
  "quantidade": 10,
  "transportador_nome": "Transportadora Express LTDA",
  "cnpj_transportador": "12.345.678/0001-90",
  "endereco_transportador": "Rua das Transportadoras, 123 - Centro",
  "placa_veiculo": "ABC1D23",
  "uf_veiculo": "SP",
  "frete_por_conta": "EMITENTE",
  "quantidade_volume": 10,
  "especie_volumes": "Caixas",
  "marca_volumes": "LOG",
  "numero_volumes": "VOL-001-010",
  "peso_bruto": 200.00,
  "peso_liquido": 180.50,
  "informacoes_transporte": "Produtos frágeis - Cuidado com impacto"
}
```

**Resposta (exemplo – estrutura esperada):**

```json
{
  "id": 25,
  "numero_TO": "TO-2025-015",
  "origem_hub_id": 55,
  "destino_hub_id": 58,
  "operador_id": 4,
  "motorista_id": null,
  "tipo_recebedor": "HUB",
  "direcao": "OUTBOUND",
  "quantidade": 10,
  "peso_kg": "150.50",
  "status": "CRIADO",
  "data_criacao": "2026-02-13T15:00:00.000Z",
  "transportador_nome": "Transportadora Express LTDA",
  "cnpj_transportador": "12.345.678/0001-90",
  "endereco_transportador": "Rua das Transportadoras, 123 - Centro",
  "placa_veiculo": "ABC1D23",
  "uf_veiculo": "SP",
  "frete_por_conta": "EMITENTE",
  "quantidade_volume": 10,
  "especie_volumes": "Caixas",
  "marca_volumes": "LOG",
  "numero_volumes": "VOL-001-010",
  "peso_bruto": "200.00",
  "peso_liquido": "180.50",
  "informacoes_transporte": "Produtos frágeis - Cuidado com impacto",
  "createdAt": "2026-02-13T15:00:00.123Z",
  "updatedAt": "2026-02-13T15:00:00.123Z",
  "pedidos": [
    {
      "id": 20,
      "codigo_pedido": "PED123",
      "status": "EM_TRANSFERENCIA"
    },
    {
      "id": 24,
      "codigo_pedido": "PED456",
      "status": "EM_TRANSFERENCIA"
    }
  ]
}
```

### 4. Criar um pedido

**Endpoint:** `POST /pedidos`

**Payload de exemplo:**

```json
{
  "codigo_pedido": "PED-HP-Z2-G9-76",
  "quantidade": 1,
  "status": "VALIDADO",
  "data_criacao": "2026-02-12T10:15:30.123Z",
  "cliente_id": 8,
  "endereco_id": 8,
  "recebimento_id": null,
  "transferencia_id": 15,
  "conferencia_id": null,
  "etiqueta_qr": "QR17708339381063834",
  "manifesto_id": null,
  "transporte_id": 13,
  "itens": [
    {
      "pedido_id": 18,
      "produto_id": 48,
      "descricao": "HP Z2 G9 TWR i714700 32GB/2TB PC",
      "quantidade": "1.0000",
      "valor_unitario": "18599.9900",
      "valor_total": "18599.9900",
      "createdAt": "2026-02-12T10:15:30.567Z",
      "updatedAt": "2026-02-12T10:15:30.567Z",
      "deletedAt": null,
      "produtos": {
        "id": 48,
        "nome": "HP Z2 G9 TWR i714700 32GB/2TB PC",
        "peso_kg": 15.2,
        "preco": "18599.99",
        "status": "ativo",
        "tipo_entrega": "transportadora"
      }
    }
  ],
  "nota": [],
  "paradas": null
}
```

**Resposta (exemplo – estrutura esperada):**

```json
{
  "id": 37,
  "codigo_pedido": "PED-HP-Z2-G9-76",
  "quantidade": 1,
  "status": "VALIDADO",
  "data_criacao": "2026-02-12T10:15:30.123Z",
  "cliente_id": 8,
  "endereco_id": 8,
  "recebimento_id": null,
  "transferencia_id": 15,
  "conferencia_id": null,
  "etiqueta_qr": "QR17708339381063834",
  "manifesto_id": null,
  "transporte_id": 13,
  "createdAt": "2026-02-12T10:15:30.456Z",
  "updatedAt": "2026-02-12T10:15:30.456Z",
  "itens": [
    {
      "id": 19,
      "pedido_id": 37,
      "produto_id": 48,
      "descricao": "HP Z2 G9 TWR i714700 32GB/2TB PC",
      "quantidade": "1.0000",
      "valor_unitario": "18599.9900",
      "valor_total": "18599.9900",
      "createdAt": "2026-02-12T10:15:30.567Z",
      "updatedAt": "2026-02-12T10:15:30.567Z",
      "produto": {
        "id": 48,
        "nome": "HP Z2 G9 TWR i714700 32GB/2TB PC",
        "peso_kg": 15.2,
        "preco": "18599.99"
      }
    }
  ]
}
```
## Boas práticas e segurança

1. **Autenticação JWT**: Todos os endpoints (exceto login e páginas públicas) requerem token de autenticação.
2. **Validação de dados**: Controllers validam entradas antes de processar (quando aplicável).
3. **Transações**: Operações críticas usam transações do Sequelize para consistência.
4. **Separação de preocupações**: Lógica de negócio isolada em services.
5. **Tratamento de erros**: Middleware de erro centralizado.
6. **Proteção contra SQL injection**: Uso de ORM (Sequelize) com parâmetros parametrizados.

## Licença

Este projeto está licenciado sob a licença MIT. Consulte o arquivo LICENSE para detalhes.

## Autor

Yale Designer
