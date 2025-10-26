'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
     await queryInterface.bulkInsert('Clientes', [
      {
       nome: 'John Doe',
       email:'johndoe@email.com',
       telefone:'999999999',
       createdAt: new Date(),
       updatedAt: new Date()

     },
     {
        nome: 'Ana Souza',
        email: 'ana@ana.com',
        telefone:'27999885501',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Marcos Cintra',
        email: 'marcos@marcos.com',
        telefone:'27999785511',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Felipe Cardoso',
        email: 'felipe@felipe.com',
        telefone:'27999784511',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Sandra Gomes',
        email: 'sandra@sandra.com',
        telefone:'27998785411',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Paula Morais',
        email: 'paula@paula.com',
        telefone:'27999785511',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Sergio Lopes',
        email: 'sergio@sergio.com',
        telefone:'27997885531',
        createdAt: new Date(),
        updatedAt: new Date()
      }

    ], {});
  },

  async down (queryInterface, Sequelize) {
  
      await queryInterface.bulkDelete('Clientes', null, {});
     
  }
};
