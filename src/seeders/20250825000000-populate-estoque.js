
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert('Estoques', [
      {
        produto_id: 15,
        pedido_id: null,
        hub_id: 1,
        quantidade: 45,
        localizacao: 'A01-B02',
        data_entrada: new Date('2024-07-15'),
        data_saida: null,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        produto_id: 87,
        pedido_id: null,
        hub_id: 2,
        quantidade: 32,
        localizacao: 'C03-D01',
        data_entrada: new Date('2024-08-20'),
        data_saida: null,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        produto_id: 42,
        pedido_id: null,
        hub_id: 3,
        quantidade: 67,
        localizacao: 'B02-A04',
        data_entrada: new Date('2024-06-10'),
        data_saida: new Date('2024-09-05'),
        createdAt: new Date(),
        updatedAt: new Date()
      },
      // {
      //   produto_id: 156,
      //   pedido_id: null,
      //   hub_id: 4,
      //   quantidade: 23,
      //   localizacao: 'D05-C02',
      //   data_entrada: new Date('2024-09-12'),
      //   data_saida: null,
      //   createdAt: new Date(),
      //   updatedAt: new Date()
      // },
      {
        produto_id: 8,
        pedido_id: null,
        hub_id: 5,
        quantidade: 89,
        localizacao: 'E01-F03',
        data_entrada: new Date('2024-05-22'),
        data_saida: null,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        produto_id: 134,
        pedido_id: null,
        hub_id: 6,
        quantidade: 54,
        localizacao: 'F04-E02',
        data_entrada: new Date('2024-10-03'),
        data_saida: null,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        produto_id: 76,
        pedido_id: null,
        hub_id: 7,
        quantidade: 31,
        localizacao: 'G01-H05',
        data_entrada: new Date('2024-07-30'),
        data_saida: new Date('2024-11-15'),
        createdAt: new Date(),
        updatedAt: new Date()
      },
      // {
      //   produto_id: 189,
      //   pedido_id: null,
      //   hub_id: 8,
      //   quantidade: 42,
      //   localizacao: 'H03-G04',
      //   data_entrada: new Date('2024-08-17'),
      //   data_saida: null,
      //   createdAt: new Date(),
      //   updatedAt: new Date()
      // },
      {
        produto_id: 23,
        pedido_id: null,
        hub_id: 9,
        quantidade: 78,
        localizacao: 'I02-J01',
        data_entrada: new Date('2024-06-25'),
        data_saida: null,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      // {
      //   produto_id: 167,
      //   pedido_id: null,
      //   hub_id: 10,
      //   quantidade: 29,
      //   localizacao: 'J04-I03',
      //   data_entrada: new Date('2024-09-08'),
      //   data_saida: new Date('2024-12-01'),
      //   createdAt: new Date(),
      //   updatedAt: new Date()
      // },
      {
        produto_id: 55,
        pedido_id: null,
        hub_id: 11,
        quantidade: 63,
        localizacao: 'K01-L02',
        data_entrada: new Date('2024-07-11'),
        data_saida: null,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        produto_id: 98,
        pedido_id: null,
        hub_id: 12,
        quantidade: 47,
        localizacao: 'L05-K03',
        data_entrada: new Date('2024-08-28'),
        data_saida: null,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        produto_id: 121,
        pedido_id: null,
        hub_id: 13,
        quantidade: 85,
        localizacao: 'M02-N01',
        data_entrada: new Date('2024-05-14'),
        data_saida: new Date('2024-10-22'),
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        produto_id: 33,
        pedido_id: null,
        hub_id: 14,
        quantidade: 36,
        localizacao: 'N03-M04',
        data_entrada: new Date('2024-09-19'),
        data_saida: null,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        produto_id: 144,
        pedido_id: null,
        hub_id: 15,
        quantidade: 71,
        localizacao: 'O01-P02',
        data_entrada: new Date('2024-06-08'),
        data_saida: null,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        produto_id: 67,
        pedido_id: null,
        hub_id: 16,
        quantidade: 28,
        localizacao: 'P04-O03',
        data_entrada: new Date('2024-10-11'),
        data_saida: null,
        createdAt: new Date(),
        updatedAt: new Date()
       },
      // {
      //   produto_id: 199,
      //   pedido_id: null,
      //   hub_id: 17,
      //   quantidade: 52,
      //   localizacao: 'Q02-R01',
      //   data_entrada: new Date('2024-07-24'),
      //   data_saida: new Date('2024-11-30'),
      //   createdAt: new Date(),
      //   updatedAt: new Date()
      // },
      {
        produto_id: 11,
        pedido_id: null,
        hub_id: 18,
        quantidade: 39,
        localizacao: 'R03-Q04',
        data_entrada: new Date('2024-08-05'),
        data_saida: null,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      // {
      //   produto_id: 178,
      //   pedido_id: null,
      //   hub_id: 19,
      //   quantidade: 64,
      //   localizacao: 'S01-T02',
      //   data_entrada: new Date('2024-05-29'),
      //   data_saida: null,
      //   createdAt: new Date(),
      //   updatedAt: new Date()
      // },
      {
        produto_id: 44,
        pedido_id: null,
        hub_id: 20,
        quantidade: 43,
        localizacao: 'T05-S03',
        data_entrada: new Date('2024-09-14'),
        data_saida: null,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        produto_id: 92,
        pedido_id: null,
        hub_id: 21,
        quantidade: 77,
        localizacao: 'U02-V01',
        data_entrada: new Date('2024-06-18'),
        data_saida: new Date('2024-12-10'),
        createdAt: new Date(),
        updatedAt: new Date()
      },
      // {
      //   produto_id: 155,
      //   pedido_id: null,
      //   hub_id: 22,
      //   quantidade: 34,
      //   localizacao: 'V03-U04',
      //   data_entrada: new Date('2024-10-25'),
      //   data_saida: null,
      //   createdAt: new Date(),
      //   updatedAt: new Date()
      // },
      {
        produto_id: 27,
        pedido_id: null,
        hub_id: 23,
        quantidade: 58,
        localizacao: 'W01-X02',
        data_entrada: new Date('2024-07-07'),
        data_saida: null,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      // {
      //   produto_id: 166,
      //   pedido_id: null,
      //   hub_id: 24,
      //   quantidade: 41,
      //   localizacao: 'X04-W03',
      //   data_entrada: new Date('2024-08-31'),
      //   data_saida: null,
      //   createdAt: new Date(),
      //   updatedAt: new Date()
      // },
      {
        produto_id: 73,
        pedido_id: null,
        hub_id: 25,
        quantidade: 69,
        localizacao: 'Y02-Z01',
        data_entrada: new Date('2024-05-05'),
        data_saida: new Date('2024-11-20'),
        createdAt: new Date(),
        updatedAt: new Date()
      },
      // {
      //   produto_id: 188,
      //   pedido_id: null,
      //   hub_id: 26,
      //   quantidade: 26,
      //   localizacao: 'Z03-Y04',
      //   data_entrada: new Date('2024-09-27'),
      //   data_saida: null,
      //   createdAt: new Date(),
      //   updatedAt: new Date()
      // },
      {
        produto_id: 19,
        pedido_id: null,
        hub_id: 27,
        quantidade: 83,
        localizacao: 'AA01-BB02',
        data_entrada: new Date('2024-06-30'),
        data_saida: null,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        produto_id: 147,
        pedido_id: null,
        hub_id: 28,
        quantidade: 37,
        localizacao: 'BB04-AA03',
        data_entrada: new Date('2024-10-08'),
        data_saida: null,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        produto_id: 61,
        pedido_id: null,
        hub_id: 29,
        quantidade: 72,
        localizacao: 'CC02-DD01',
        data_entrada: new Date('2024-07-19'),
        data_saida: new Date('2024-12-05'),
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        produto_id: 132,
        pedido_id: null,
        hub_id: 30,
        quantidade: 48,
        localizacao: 'DD03-CC04',
        data_entrada: new Date('2024-08-12'),
        data_saida: null,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        produto_id: 84,
        pedido_id: null,
        hub_id: 31,
        quantidade: 55,
        localizacao: 'EE01-FF02',
        data_entrada: new Date('2024-05-26'),
        data_saida: null,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      // {
      //   produto_id: 175,
      //   pedido_id: null,
      //   hub_id: 32,
      //   quantidade: 33,
      //   localizacao: 'FF04-EE03',
      //   data_entrada: new Date('2024-09-03'),
      //   data_saida: null,
      //   createdAt: new Date(),
      //   updatedAt: new Date()
      // },
      {
        produto_id: 38,
        pedido_id: null,
        hub_id: 33,
        quantidade: 79,
        localizacao: 'GG02-HH01',
        data_entrada: new Date('2024-06-14'),
        data_saida: new Date('2024-11-25'),
        createdAt: new Date(),
        updatedAt: new Date()
      },
      // {
      //   produto_id: 193,
      //   pedido_id: null,
      //   hub_id: 34,
      //   quantidade: 44,
      //   localizacao: 'HH03-GG04',
      //   data_entrada: new Date('2024-10-17'),
      //   data_saida: null,
      //   createdAt: new Date(),
      //   updatedAt: new Date()
      // },
      {
        produto_id: 52,
        pedido_id: null,
        hub_id: 35,
        quantidade: 66,
        localizacao: 'II01-JJ02',
        data_entrada: new Date('2024-07-02'),
        data_saida: null,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        produto_id: 127,
        pedido_id: null,
        hub_id: 36,
        quantidade: 25,
        localizacao: 'JJ04-II03',
        data_entrada: new Date('2024-08-23'),
        data_saida: null,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        produto_id: 96,
        pedido_id: null,
        hub_id: 37,
        quantidade: 81,
        localizacao: 'KK02-LL01',
        data_entrada: new Date('2024-05-09'),
        data_saida: new Date('2024-12-15'),
        createdAt: new Date(),
        updatedAt: new Date()
      },
      // {
      //   produto_id: 169,
      //   pedido_id: null,
      //   hub_id: 38,
      //   quantidade: 38,
      //   localizacao: 'LL03-KK04',
      //   data_entrada: new Date('2024-09-21'),
      //   data_saida: null,
      //   createdAt: new Date(),
      //   updatedAt: new Date()
      // },
      {
        produto_id: 29,
        pedido_id: null,
        hub_id: 39,
        quantidade: 59,
        localizacao: 'MM01-NN02',
        data_entrada: new Date('2024-06-27'),
        data_saida: null,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      // {
      //   produto_id: 182,
      //   pedido_id: null,
      //   hub_id: 40,
      //   quantidade: 46,
      //   localizacao: 'NN04-MM03',
      //   data_entrada: new Date('2024-10-29'),
      //   data_saida: null,
      //   createdAt: new Date(),
      //   updatedAt: new Date()
      // },
      {
        produto_id: 71,
        pedido_id: null,
        hub_id: 41,
        quantidade: 74,
        localizacao: 'OO02-PP01',
        data_entrada: new Date('2024-07-13'),
        data_saida: new Date('2024-11-10'),
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        produto_id: 138,
        pedido_id: null,
        hub_id: 42,
        quantidade: 35,
        localizacao: 'PP03-OO04',
        data_entrada: new Date('2024-08-09'),
        data_saida: null,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        produto_id: 47,
        pedido_id: null,
        hub_id: 43,
        quantidade: 68,
        localizacao: 'QQ01-RR02',
        data_entrada: new Date('2024-05-31'),
        data_saida: null,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      // {
      //   produto_id: 194,
      //   pedido_id: null,
      //   hub_id: 44,
      //   quantidade: 27,
      //   localizacao: 'RR04-QQ03',
      //   data_entrada: new Date('2024-09-16'),
      //   data_saida: null,
      //   createdAt: new Date(),
      //   updatedAt: new Date()
      // },
      {
        produto_id: 63,
        pedido_id: null,
        hub_id: 45,
        quantidade: 53,
        localizacao: 'SS02-TT01',
        data_entrada: new Date('2024-06-22'),
        data_saida: new Date('2024-12-20'),
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        produto_id: 125,
        pedido_id: null,
        hub_id: 46,
        quantidade: 49,
        localizacao: 'TT03-SS04',
        data_entrada: new Date('2024-10-01'),
        data_saida: null,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        produto_id: 88,
        pedido_id: null,
        hub_id: 47,
        quantidade: 76,
        localizacao: 'UU01-VV02',
        data_entrada: new Date('2024-07-26'),
        data_saida: null,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      // {
      //   produto_id: 172,
      //   pedido_id: null,
      //   hub_id: 48,
      //   quantidade: 31,
      //   localizacao: 'VV04-UU03',
      //   data_entrada: new Date('2024-08-14'),
      //   data_saida: null,
      //   createdAt: new Date(),
      //   updatedAt: new Date()
      // },
      {
        produto_id: 35,
        pedido_id: null,
        hub_id: 49,
        quantidade: 62,
        localizacao: 'WW02-XX01',
        data_entrada: new Date('2024-05-12'),
        data_saida: new Date('2024-11-05'),
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ], {});
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('Estoques', null, {});
  }
};
