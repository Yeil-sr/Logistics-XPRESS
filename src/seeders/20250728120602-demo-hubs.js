'use strict';

module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.bulkInsert('Hubs', [
      {
        nome: 'Centro de Distribuição Serra',
        endereco_id: 101,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Centro de Transferência Vitória',
        endereco_id: 102,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'CD Ambev - Guarulhos',
        endereco_id: 101,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'CD Coca-Cola - Rio de Janeiro',
        endereco_id: 102,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'CD Nestlé - Jundiaí',
        endereco_id: 103,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Centro Logístico Unilever - BH',
        endereco_id: 104,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'CD BRF - Volta Redonda',
        endereco_id: 105,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'CD Carrefour - Contagem',
        endereco_id: 106,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Centro Distribuição GPA - São José dos Campos',
        endereco_id: 107,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Base Magazine Luiza - Rio de Janeiro',
        endereco_id: 108,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Hub Mercado Livre - Vitória',
        endereco_id: 109,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'CD Amazon BR - Campinas',
        endereco_id: 110,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Terminal DHL - Belo Horizonte',
        endereco_id: 111,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Base FedEx - Rio de Janeiro',
        endereco_id: 112,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'CD TNT Express - Cotia',
        endereco_id: 113,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Centro Jadlog - Novo Hamburgo',
        endereco_id: 114,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Unit Correios - São Paulo',
        endereco_id: 115,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'CD Heineken - Mairiporã',
        endereco_id: 116,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Centro P&G - Rio de Janeiro',
        endereco_id: 117,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'CD JBS - Barueri',
        endereco_id: 118,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Terminal Votorantim - Belo Horizonte',
        endereco_id: 119,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'CD Vale - Serra',
        endereco_id: 120,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Base Gerdau - Santa Luzia',
        endereco_id: 121,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'CD CSN - Pindamonhangaba',
        endereco_id: 122,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Terminal ArcelorMittal - Porto Alegre',
        endereco_id: 123,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'CD Tigre - Barra Mansa',
        endereco_id: 124,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Base Embraer - São José dos Campos',
        endereco_id: 125,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'CD Marcopolo - Juiz de Fora',
        endereco_id: 126,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Terminal Itambé - Uberlândia',
        endereco_id: 127,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'CD Laticínios Bela Vista - Ribeirão Preto',
        endereco_id: 128,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Base Laticínios Scala - Niterói',
        endereco_id: 129,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'CD Coopercitrus - Bebedouro',
        endereco_id: 130,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Distribuidora de Bebidas SP - São Bernardo',
        endereco_id: 131,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'CD Distribuidora Supérbia - Teresópolis',
        endereco_id: 132,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Terminal Atacadão - Belo Horizonte',
        endereco_id: 133,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'CD Assaí Atacadista - Atibaia',
        endereco_id: 134,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Base Distribuidora Pirajá - Duque de Caxias',
        endereco_id: 135,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'CD Extra - Jundiaí',
        endereco_id: 136,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Terminal Pão de Açúcar - Vitória',
        endereco_id: 137,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'CD Walmart - São José dos Campos',
        endereco_id: 138,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Base Sam\'s Club - Rio de Janeiro',
        endereco_id: 139,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'CD Dia Supermercados - Divinópolis',
        endereco_id: 140,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Terminal Carrefour - Vitória',
        endereco_id: 141,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'CD GPA - Campinas',
        endereco_id: 142,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Hub Mercado Livre - Rio de Janeiro',
        endereco_id: 143,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'CD Amazon - São José dos Campos',
        endereco_id: 144,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Base Magazine Luiza - Belo Horizonte',
        endereco_id: 145,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Terminal DHL - Vitória',
        endereco_id: 146,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'CD FedEx - Guarulhos',
        endereco_id: 147,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Centro Jadlog - São Paulo',
        endereco_id: 148,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Unit Correios - Rio de Janeiro',
        endereco_id: 149,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Hub Logístico Sudeste - Região Metropolitana',
        endereco_id: 150,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]);
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('Hubs', null, {});
  }
};